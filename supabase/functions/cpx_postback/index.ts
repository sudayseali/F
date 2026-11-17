// supabase/functions/cpx_postback/index.ts
// Fail-closed, idempotent CPX Research postback receiver unified with Custom Offers Engine

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getClientIp } from "../_shared/rate-limit.ts";
import { processProviderPostback } from "../_shared/offers/postback-processor.ts";

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return new Response("500 Server Misconfiguration", { status: 500 });
  }

  try {
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const result = await processProviderPostback({
      req,
      supabaseAdmin,
      forcedProviderKey: "cpx",
      clientIp: getClientIp(req),
    });

    return new Response(result.body === "1" ? "OK" : result.body, {
      status: result.status,
    });
  } catch (error: any) {
    console.error("[CPX_POSTBACK_ERROR]", error);
    return new Response("Error Processing Postback", { status: 500 });
  }
});
