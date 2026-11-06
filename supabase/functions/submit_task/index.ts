// supabase/functions/submit_task/index.ts
// Secure user task submission endpoint with JWT authentication & rate limiting

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { verifyUserRequest } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { sanitizeString, isValidUuid } from "../_shared/validation.ts";
import { logAuditEvent } from "../_shared/audit-log.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // Rate Limiting: 10 task submissions per minute per IP
  const rate = checkRateLimit(`task_sub_${clientIp}`, 10, 60000);
  if (!rate.allowed) {
    return errorResponse(new AppError("Too many task submissions. Please wait a moment.", 429, "RATE_LIMIT_EXCEEDED"));
  }

  try {
    if (req.method !== "POST") {
      throw new AppError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    // 1. Verify User Authentication exclusively via JWT
    const verifiedUser = await verifyUserRequest(req);
    const userId = verifiedUser.id;

    const body = await req.json().catch(() => ({}));
    const { task_id, proof_text, proof_data } = body;

    // 2. Input Validation
    if (!task_id || !isValidUuid(task_id)) {
      throw new AppError("A valid task ID is required.", 400, "INVALID_TASK_ID");
    }

    const proofContent = (proof_text || proof_data || "").trim();
    if (!proofContent || proofContent.length < 3) {
      throw new AppError("Task proof is required (text or URL).", 400, "MISSING_PROOF");
    }

    if (proofContent.length > 2000) {
      throw new AppError("Proof content exceeds maximum length of 2,000 characters.", 400, "PROOF_TOO_LONG");
    }

    const cleanProof = sanitizeString(proofContent, 2000);

    // 3. Verify Task Exists and is Active
    const { data: task, error: taskErr } = await supabaseAdmin
      .from("tasks")
      .select("id, title, status, max_completions, current_completions")
      .eq("id", task_id)
      .maybeSingle();

    if (taskErr || !task) {
      throw new AppError("Task not found.", 404, "TASK_NOT_FOUND");
    }

    if (task.status !== "active") {
      throw new AppError("This task is currently paused or completed.", 400, "TASK_NOT_ACTIVE");
    }

    // 4. Check for Existing Duplicate Submission
    const { data: existingSub, error: subCheckErr } = await supabaseAdmin
      .from("submissions")
      .select("id, status")
      .eq("task_id", task_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (subCheckErr) throw subCheckErr;

    if (existingSub) {
      throw new AppError(
        `You have already submitted proof for this task (Status: ${existingSub.status}).`,
        400,
        "DUPLICATE_SUBMISSION"
      );
    }

    // 5. Insert Submission Record
    const { data: newSubmission, error: insertErr } = await supabaseAdmin
      .from("submissions")
      .insert({
        task_id: task_id,
        user_id: userId,
        proof_text: cleanProof,
        status: "pending",
        submitted_at: new Date().toISOString()
      })
      .select("id, status, submitted_at")
      .single();

    if (insertErr || !newSubmission) throw insertErr || new Error("Failed to record submission");

    // 6. Audit Log
    await logAuditEvent({
      actorId: userId,
      actorType: "user",
      action: "task_submitted",
      targetType: "task",
      targetId: task_id,
      details: { submissionId: newSubmission.id, taskTitle: task.title },
      ipAddress: clientIp,
    });

    return successResponse({
      message: "Proof submitted successfully and queued for review.",
      submission_id: newSubmission.id,
      status: "pending"
    });

  } catch (error) {
    return errorResponse(error);
  }
});
