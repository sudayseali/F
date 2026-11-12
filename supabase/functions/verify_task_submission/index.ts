// supabase/functions/verify_task_submission/index.ts
// Secured administrative task submission review endpoint

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { verifyAdminRequest } from "../_shared/admin-auth.ts";
import { sanitizeString, isValidUuid } from "../_shared/validation.ts";

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

    // 2. Call Atomic Review RPC
    const { data: result, error: rpcError } = await supabaseAdmin.rpc("admin_review_submission", {
      p_admin_id: admin.id,
      p_submission_id: subId,
      p_decision: finalDecision,
      p_comment: sanitizeString(comment || "", 250)
    });

    if (rpcError) throw rpcError;
    if (!result?.success) throw new AppError(result?.error || "Review operation failed.", 400, "REVIEW_FAILED");

    return successResponse(result, 200, req);

  } catch (error) {
    return errorResponse(error, req);
  }
});
