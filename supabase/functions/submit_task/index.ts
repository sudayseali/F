// supabase/functions/submit_task/index.ts
// Secure user task submission endpoint with JWT authentication, quota check & distributed rate limiting

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { verifyUserRequest } from "../_shared/auth.ts";
import { checkDistributedRateLimit, getClientIp } from "../_shared/rate-limit.ts";
import { sanitizeString, isValidUuid } from "../_shared/validation.ts";
import { logAuditEvent } from "../_shared/audit-log.ts";
import { sendUserAlert } from "../_shared/alerts.ts";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) {
    throw new AppError("Server configuration missing database credentials", 500, "CONFIG_ERROR");
  }
  return createClient(url, key);
}

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const clientIp = getClientIp(req);

  try {
    if (req.method !== "POST") {
      throw new AppError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Distributed Rate Limiting: 10 task submissions per minute per IP
    const ipRate = await checkDistributedRateLimit(supabaseAdmin, `task_sub_ip_${clientIp}`, 10, 60);
    if (!ipRate.allowed) {
      throw new AppError("Too many task submissions. Please wait a moment.", 429, "RATE_LIMIT_EXCEEDED");
    }

    // 1. Verify User Authentication exclusively via JWT
    const verifiedUser = await verifyUserRequest(req);
    const userId = verifiedUser.id;

    const userRate = await checkDistributedRateLimit(supabaseAdmin, `task_sub_usr_${userId}`, 6, 60);
    if (!userRate.allowed) {
      throw new AppError("Please wait a moment before submitting another task.", 429, "RATE_LIMIT_EXCEEDED");
    }

    const body = await req.json().catch(() => ({}));
    const { task_id, proof_text, proof_data, proof, proof_url, telegram_username } = body;
    const proofContent = String(proof_text || proof_data || proof || proof_url || "").trim();

    // 2. Input Validation
    if (!task_id || !isValidUuid(task_id)) {
      throw new AppError("A valid task ID is required.", 400, "INVALID_TASK_ID");
    }

    if (!proofContent || proofContent.length < 3) {
      throw new AppError("Task proof is required (text or URL).", 400, "MISSING_PROOF");
    }

    if (proofContent.length > 2000) {
      throw new AppError("Proof content exceeds maximum length of 2,000 characters.", 400, "PROOF_TOO_LONG");
    }

    const cleanProof = sanitizeString(proofContent, 2000);
    const cleanTgUsername = sanitizeString(telegram_username || "", 64);

    // 3. Atomic task slot check, duplicate prevention & submission creation under FOR UPDATE lock
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc("submit_task_atomic", {
      p_user_id: userId,
      p_task_id: task_id,
      p_proof_text: cleanProof,
    });

    if (rpcErr) throw rpcErr;

    if (!rpcRes?.success) {
      const errCode = rpcRes?.code || "SUBMISSION_FAILED";
      const statusCode = errCode === "TASK_NOT_FOUND" ? 404 : errCode === "ACCOUNT_SUSPENDED" ? 403 : 400;
      throw new AppError(rpcRes?.error || "Failed to submit task proof.", statusCode, errCode);
    }

    const submissionId = rpcRes.submission_id;
    const taskTitle = rpcRes.task_title || "Task";

    // 4. Audit Log & In-App Task Alert
    await logAuditEvent({
      actorId: userId,
      actorType: "user",
      action: "task_submitted",
      targetType: "task",
      targetId: task_id,
      details: { submissionId, taskTitle, telegramUsername: cleanTgUsername || undefined },
      ipAddress: clientIp,
    });

    await sendUserAlert(supabaseAdmin, {
      userId,
      category: "task",
      eventKey: "task_submitted",
      title: "Task Proof Under Review",
      message: `Your proof for "${taskTitle}" was submitted and is awaiting verification.`,
      actionUrl: `/tasks/${task_id}`,
      ctaLabel: "📋 View Task",
      metadata: { task_id, submission_id: submissionId },
    });

    return successResponse({
      message: "Proof submitted successfully and queued for review.",
      submission_id: submissionId,
      status: "pending"
    }, 200, req);

  } catch (error) {
    return errorResponse(error, req);
  }
});
