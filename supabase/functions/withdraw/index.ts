// supabase/functions/withdraw/index.ts
// Secure user withdrawal endpoint with server-side authentication & validation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { verifyUserRequest } from "../_shared/auth.ts";
import { validatePositiveAmount, validatePayoutAddress } from "../_shared/validation.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { logAuditEvent } from "../_shared/audit-log.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // Rate limiting (max 5 withdrawal requests per minute per IP)
  const rate = checkRateLimit(`wd_${clientIp}`, 5, 60000);
  if (!rate.allowed) {
    return errorResponse(new AppError("Too many withdrawal requests. Please wait a moment.", 429, "RATE_LIMIT_EXCEEDED"));
  }

  try {
    if (req.method !== "POST") {
      throw new AppError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    // 1. SEC-01: Authenticate user exclusively via verified Supabase JWT
    // Never trust client-supplied user_uuid fallback
    const verifiedUser = await verifyUserRequest(req);
    const authenticatedUserId = verifiedUser.id;

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
    if (!method || !["usdt", "trx", "payeer"].includes(method)) {
      throw new AppError("Invalid payment method. Supported methods: USDT (TRC20), TRX, Payeer.", 400, "INVALID_METHOD");
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

    // Check optional idempotency key
    const safeIdempotencyKey = idempotency_key && typeof idempotency_key === "string" 
      ? idempotency_key.slice(0, 100) 
      : `wd_req_${authenticatedUserId}_${Date.now()}`;

    // 5. Call Atomic Database RPC with Row Locking (FOR UPDATE)
    // Ensures concurrent requests cannot double-spend or create negative balances
    const { data: dbResult, error: rpcError } = await supabaseAdmin.rpc("request_withdrawal", {
      user_id_param: authenticatedUserId,
      amount_param: cleanAmount,
      method: method,
      wallet_address: cleanAddress
    });

    if (rpcError) {
      console.error("[WITHDRAWAL_RPC_ERROR]", rpcError);
      throw new AppError("Unable to process withdrawal request. Please check your balance and try again.", 400, "WITHDRAWAL_FAILED");
    }

    if (!dbResult || !dbResult.success) {
      const safeErrorMessage = dbResult?.error || "Withdrawal failed due to insufficient balance or account restrictions.";
      throw new AppError(safeErrorMessage, 400, "WITHDRAWAL_FAILED");
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
    });

  } catch (error) {
    return errorResponse(error);
  }
});
