// supabase/functions/verify_task_submission/index.ts
// Secured administrative task submission review endpoint

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { verifyAdminRequest } from "../_shared/admin-auth.ts";
import { sanitizeString, isValidUuid } from "../_shared/validation.ts";
import { sendUserAlert, notifyReferrerOfCommission } from "../_shared/alerts.ts";

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

  try {
    if (req.method !== "POST") {
      throw new AppError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    // 1. Enforce Administrator Authentication & Review Permission
    const admin = await verifyAdminRequest(req, "review_submissions");

    const body = await req.json().catch(() => ({}));
    const { submission_id, status, decision, comment } = body;

    const subId = submission_id || body.submissionId;
    const finalDecision = decision || status;

    if (!subId || !isValidUuid(subId)) {
      throw new AppError("A valid submission UUID is required.", 400, "INVALID_SUBMISSION_ID");
    }

    if (!["approved", "rejected"].includes(finalDecision)) {
      throw new AppError("Decision must be either 'approved' or 'rejected'.", 400, "INVALID_DECISION");
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Lookup submission + task before atomic review
    const { data: subInfo } = await supabaseAdmin
      .from("submissions")
      .select("user_id, task_id, task:tasks(title, reward)")
      .eq("id", subId)
      .maybeSingle();

    const cleanComment = sanitizeString(comment || "", 250);

    // 2. Call Atomic Review RPC
    const { data: result, error: rpcError } = await supabaseAdmin.rpc("admin_review_submission", {
      p_admin_id: admin.id,
      p_submission_id: subId,
      p_decision: finalDecision,
      p_comment: cleanComment
    });

    if (rpcError) throw rpcError;
    if (!result?.success) throw new AppError(result?.error || "Review operation failed.", 400, "REVIEW_FAILED");

    // 3. Dispatch Task Decision Alert & Referrer Commission Alert
    if (subInfo?.user_id) {
      const taskObj = Array.isArray(subInfo.task) ? subInfo.task[0] : subInfo.task;
      const taskTitle = taskObj?.title || "Micro-Task";
      const rewardNum = Number(taskObj?.reward || 0);

      if (finalDecision === "approved") {
        await sendUserAlert(supabaseAdmin, {
          userId: subInfo.user_id,
          category: "task",
          eventKey: "task_approved",
          title: "Task Approved!",
          message: `Your submission for "${taskTitle}" was approved and +$${rewardNum.toFixed(2)} was credited to your wallet.`,
          amount: rewardNum,
          actionUrl: "/wallet",
          ctaLabel: "💰 View Wallet",
          metadata: { submission_id: subId, task_id: subInfo.task_id },
        });
        await notifyReferrerOfCommission(supabaseAdmin, subInfo.user_id, rewardNum, `task "${taskTitle}"`);
      } else {
        await sendUserAlert(supabaseAdmin, {
          userId: subInfo.user_id,
          category: "task",
          eventKey: "task_rejected",
          title: "Task Submission Declined",
          message: cleanComment
            ? `Your submission for "${taskTitle}" was declined: ${cleanComment}`
            : `Your submission for "${taskTitle}" did not meet the proof requirements.`,
          actionUrl: subInfo.task_id ? `/tasks/${subInfo.task_id}` : "/tasks",
          ctaLabel: "📋 View Tasks",
          metadata: { submission_id: subId, task_id: subInfo.task_id },
        });
      }
    }

    return successResponse(result, 200, req);

  } catch (error) {
    return errorResponse(error, req);
  }
});
