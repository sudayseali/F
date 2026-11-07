// supabase/functions/daily_checkin/index.ts
// Real, secure Daily Check-In Edge Function with JWT verification & 24h cooldown

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { verifyUserRequest } from "../_shared/auth.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // Rate Limiting: 6 daily check-in requests per minute per IP
  const rate = checkRateLimit(`daily_${clientIp}`, 6, 60000);
  if (!rate.allowed) {
    return errorResponse(new AppError("Too many daily check-in requests. Please wait a moment.", 429, "RATE_LIMIT_EXCEEDED"));
  }

  try {
    if (req.method !== "POST") {
      throw new AppError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    // 1. Authenticate user strictly via JWT
    const verifiedUser = await verifyUserRequest(req);
    const userId = verifiedUser.id;

    // 2. Call Atomic Database Procedure with 24-hour cooldown check
    const { data: result, error: rpcError } = await supabaseAdmin.rpc("claim_daily_reward", {
      p_user_id: userId
    });

    if (rpcError) {
      console.error("[DAILY_CHECKIN_RPC_ERROR]", rpcError);
      throw new AppError("Failed to claim daily reward. Please try again.", 500, "DB_ERROR");
    }

    if (!result?.success) {
      return errorResponse(new AppError(result?.error || "Daily reward already claimed.", 400, "ALREADY_CLAIMED"));
    }

    return successResponse({
      message: "Daily reward claimed successfully! +50 PTS ($0.05) added to your wallet balance.",
      reward_amount: result.reward_amount,
      points: result.points,
      new_balance: result.new_balance,
      claimed_at: result.claimed_at
    });

  } catch (err) {
    return errorResponse(err);
  }
});
