import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleCors } from "../_shared/cors.ts";
import { verifyUserRequest } from "../_shared/auth.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";

serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const verifiedUser = await verifyUserRequest(req);
    const appId = Deno.env.get("CPX_APP_ID") || "24128";

    const url = `https://offers.cpx-research.com/index.php?app_id=${appId}&ext_user_id=${verifiedUser.id}`;
    
    return successResponse({ url });
  } catch (error: any) {
    return errorResponse(error);
  }
});
