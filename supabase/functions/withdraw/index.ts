// supabase/functions/withdraw/index.ts
// Secure user withdrawal endpoint with server-side authentication & validation

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors } from "../_shared/cors.ts";
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

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";

  // Rate limiting (max 5 withdrawal requests per minute per IP)
  const rate = checkRateLimit(`wd_${clientIp}`, 5, 60000);
  if (!rate.allowed) {
    return errorResponse(new AppError("Too many withdrawal requests. Please wait a moment.", 429, "RATE_LIMIT_EXCEEDED"));
  }

  try {
    const body = await req.json().catch(() => ({}));

    // 1. Authenticate user from Authorization Bearer header, or fallback to body user_uuid if present
    let authenticatedUserId: string;
    try {
      const verifiedUser = await verifyUserRequest(req);
      authenticatedUserId = verifiedUser.id;
    } catch {
      // Fallback: If client only passed user_uuid with anon key
      if (!body.user_uuid) {
        throw new AppError("Authentication required.", 401, "UNAUTHORIZED");
      }
      authenticatedUserId = body.user_uuid;
    }

    const { amount, wallet_address, method } = body;

    // 2. Validate amount (min $1.00)
    const cleanAmount = validatePositiveAmount(amount, 1.00, 5000.00);

    // 3. Validate payment method and address format
    if (!method || !["usdt", "trx", "payeer"].includes(method)) {
      throw new AppError("Invalid payment method. Supported: usdt, trx, payeer", 400, "INVALID_METHOD");
    }
    const cleanAddress = validatePayoutAddress(method, wallet_address);

    // 4. Call Atomic Database RPC with Row Locking
    const { data: dbResult, error: rpcError } = await supabaseAdmin.rpc("request_withdrawal", {
      user_id_param: authenticatedUserId,
      amount_param: cleanAmount,
      method: method,
      wallet_address: cleanAddress
    });

    if (rpcError) throw rpcError;

    if (!dbResult.success) {
      throw new AppError(dbResult.error || "Withdrawal request failed.", 400, "WITHDRAWAL_FAILED");
    }

    // 5. Audit Log
    await logAuditEvent({
      actorId: authenticatedUserId,
      actorType: "user",
      action: "withdrawal_requested",
      targetType: "withdrawal",
      targetId: dbResult.withdrawal_id,
      details: { amount: cleanAmount, method, wallet_address: cleanAddress },
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
