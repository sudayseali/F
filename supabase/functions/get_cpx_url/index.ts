import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { verifyUserRequest } from "../_shared/auth.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { checkDistributedRateLimit, getClientIp } from "../_shared/rate-limit.ts";
import { md5Hex } from "../_shared/crypto.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const clientIp = getClientIp(req);

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      throw new AppError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const url = Deno.env.get("SUPABASE_URL") || "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (url && key) {
      const supabaseAdmin = createClient(url, key);
      const rate = await checkDistributedRateLimit(supabaseAdmin, `cpx_url_${clientIp}`, 20, 60);
      if (!rate.allowed) {
        throw new AppError("Too many requests. Please wait a moment.", 429, "RATE_LIMIT_EXCEEDED");
      }
    }

    const verifiedUser = await verifyUserRequest(req);
    const appId = Deno.env.get("CPX_APP_ID") || "24128";
    const cpxSecret = (Deno.env.get("CPX_SECRET") || "").trim();

    if (!cpxSecret) {
      throw new AppError("CPX Research offerwall is temporarily unavailable (configuration missing).", 500, "CONFIG_ERROR");
    }

    const secureHash = md5Hex(`${verifiedUser.id}-${cpxSecret}`);
    const cpxUrl = `https://offers.cpx-research.com/index.php?app_id=${encodeURIComponent(appId)}&ext_user_id=${encodeURIComponent(verifiedUser.id)}&secure_hash=${secureHash}`;

    return successResponse({ url: cpxUrl }, 200, req);
  } catch (error: any) {
    return errorResponse(error, req);
  }
});
