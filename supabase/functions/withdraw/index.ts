// supabase/functions/withdraw/index.ts
// Secure user withdrawal endpoint with server-side authentication, distributed rate limiting & validation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { verifyUserRequest } from "../_shared/auth.ts";
import { validatePositiveAmount, validatePayoutAddress } from "../_shared/validation.ts";
import { checkDistributedRateLimit } from "../_shared/rate-limit.ts";
import { logAuditEvent } from "../_shared/audit-log.ts";

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

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    if (req.method !== "POST") {
      throw new AppError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Distributed rate limiting (max 5 withdrawal requests per 60s per IP)
    const ipRate = await checkDistributedRateLimit(supabaseAdmin, `wd_ip_${clientIp}`, 5, 60);
    if (!ipRate.allowed) {
      throw new AppError("Too many withdrawal requests. Please wait a moment.", 429, "RATE_LIMIT_EXCEEDED");
    }

    // 1. Authenticate user exclusively via verified Supabase JWT
    const verifiedUser = await verifyUserRequest(req);
    const authenticatedUserId = verifiedUser.id;

    // Per-user distributed rate limit (max 3 requests per 60s)
    const userRate = await checkDistributedRateLimit(supabaseAdmin, `wd_usr_${authenticatedUserId}`, 3, 60);
    if (!userRate.allowed) {
      throw new AppError("Please wait a minute before submitting another withdrawal.", 429, "RATE_LIMIT_EXCEEDED");
    }

    const body = await req.json().catch(() => ({}));
    const { amount, wallet_address, method, user_uuid, idempotency_key } = body;

    // Reject any attempt by client to specify another user's identity
    if (user_uuid && user_uuid !== authenticatedUserId) {
      await logAuditEvent({
        actorId: authenticatedUserId,
        actorType: "user",
        action: "suspicious_identity_mismatch_attempt",
        details: { attemptedUserId: user_uuid, realUserId: authenticatedUserId },
        ipAddress: clientIp,
      });
      throw new AppError("Identity mismatch: Cannot request withdrawal on behalf of another user.", 403, "FORBIDDEN_IDENTITY_MISMATCH");
    }

    // 2. Validate amount (minimum $1.00, maximum $5,000.00)
    const cleanAmount = validatePositiveAmount(amount, 1.00, 5000.00);

    // 3. Validate payment method and address format
    if (!method || !["usdt", "usdt_bep20", "trx", "payeer"].includes(method)) {
      throw new AppError("Invalid payment method. Supported methods: USDT (TRC20), USDT (BEP20), TRX, Payeer.", 400, "INVALID_METHOD");
    }
    const cleanAddress = validatePayoutAddress(method, wallet_address);

    // 4. Prevent Duplicate Requests: Check for existing pending withdrawal
    const { data: existingPending, error: pendingErr } = await supabaseAdmin
      .from("withdrawals")
      .select("id, amount, requested_at")
      .eq("user_id", authenticatedUserId)
      .eq("status", "pending")
      .maybeSingle();

    if (pendingErr) throw pendingErr;

    if (existingPending) {
      throw new AppError("You already have an active pending withdrawal in queue. Please wait for it to be processed.", 400, "DUPLICATE_PENDING_WITHDRAWAL");
    }

    // Validate optional client idempotency key
    let safeIdempotencyKey = `wd_req_${authenticatedUserId}_${crypto.randomUUID()}`;
    if (typeof idempotency_key === "string" && /^[a-zA-Z0-9_-]{8,100}$/.test(idempotency_key.trim())) {
      safeIdempotencyKey = `wd_${authenticatedUserId}_${idempotency_key.trim()}`;
    }

    // 5. Call Atomic Database RPC with Row Locking (FOR UPDATE) & Idempotency
    const { data: dbResult, error: rpcError } = await supabaseAdmin.rpc("request_withdrawal", {
      user_id_param: authenticatedUserId,
      amount_param: cleanAmount,
      method: method,
      wallet_address: cleanAddress,
      p_idempotency_key: safeIdempotencyKey,
    });

    if (rpcError) {
      console.error("[WITHDRAWAL_RPC_ERROR]", rpcError);
      throw new AppError("Unable to process withdrawal request. Please check your balance and try again.", 400, "WITHDRAWAL_FAILED");
    }

    if (!dbResult || !dbResult.success) {
      const safeErrorMessage = dbResult?.error || "Withdrawal failed due to insufficient balance or account restrictions.";
      throw new AppError(safeErrorMessage, 400, dbResult?.code || "WITHDRAWAL_FAILED");
    }

    // 6. Immutable Audit Log
    await logAuditEvent({
      actorId: authenticatedUserId,
      actorType: "user",
      action: "withdrawal_requested",
      targetType: "withdrawal",
      targetId: dbResult.withdrawal_id,
      details: { amount: cleanAmount, method, wallet_address: cleanAddress, idempotencyKey: safeIdempotencyKey },
      ipAddress: clientIp,
    });

    return successResponse({
      message: "Withdrawal request submitted successfully and queued for review.",
      withdrawal_id: dbResult.withdrawal_id,
      new_balance: dbResult.new_balance
    }, 200, req);

  } catch (error) {
    return errorResponse(error, req);
  }
});
