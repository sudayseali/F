// supabase/functions/cpx_postback/index.ts
// Idempotent, secure CPX Research offerwall postback receiver

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CPX_SECRET = Deno.env.get("CPX_SECRET");

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const url = new URL(req.url);

    const status = url.searchParams.get("status"); // 1 = complete, 2 = chargeback
    const transId = url.searchParams.get("trans_id");
    const rawUserId = url.searchParams.get("user_id") || url.searchParams.get("sub_id") || url.searchParams.get("ext_user_id");
    const amountLocal = parseFloat(url.searchParams.get("amount_local") || url.searchParams.get("amount") || "0");
    const secureHash = url.searchParams.get("hash");

    if (!rawUserId) {
      return new Response("Missing User ID", { status: 400 });
    }

    if (!transId) {
      return new Response("Missing Transaction ID", { status: 400 });
    }

    // 1. Signature Verification (if secret configured)
    if (CPX_SECRET) {
      if (!secureHash) {
        return new Response("403 Forbidden - Missing required CPX hash parameter", { status: 403 });
      }

      const dataToHash = `${transId}-${CPX_SECRET}`;
      const cpxEncoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", cpxEncoder.encode(dataToHash));
      const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      let match = secureHash.toLowerCase() === hashHex.toLowerCase();
      // Also support MD5 if provider uses legacy MD5 hashing
      if (!match) {
        const md5Buffer = await crypto.subtle.digest("MD5", cpxEncoder.encode(dataToHash)).catch(() => null);
        if (md5Buffer) {
          const md5Hex = Array.from(new Uint8Array(md5Buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
          if (secureHash.toLowerCase() === md5Hex.toLowerCase()) {
            match = true;
          }
        }
      }

      if (!match) {
        console.warn(`[CPX_SECURITY_WARNING] Signature mismatch for trans_id ${transId}`);
        return new Response("403 Forbidden - Invalid signature hash", { status: 403 });
      }
    }

    // 2. Lookup User by UUID or Telegram ID
    let targetUserId: string | null = null;
    const isNumeric = /^\d+$/.test(rawUserId);

    if (isNumeric) {
      const { data: userByTg } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("telegram_id", parseInt(rawUserId, 10))
        .maybeSingle();
      if (userByTg) targetUserId = userByTg.id;
    } else {
      const { data: userByUuid } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("id", rawUserId)
        .maybeSingle();
      if (userByUuid) targetUserId = userByUuid.id;
    }

    if (!targetUserId) {
      return new Response("User not found in system", { status: 404 });
    }

    // 3. Replay Protection via offerwall_logs
    const idempotencyKey = `cpx_${transId}`;
    const { data: existingLog } = await supabaseAdmin
      .from("offerwall_logs")
      .select("id")
      .eq("provider", "cpx")
      .eq("external_transaction_id", transId)
      .maybeSingle();

    if (existingLog) {
      // Already credited - acknowledge callback with 200 to prevent provider retry spam
      return new Response("OK - Already processed", { status: 200 });
    }

    // 4. Atomic Financial Credit
    if (status === "1" && amountLocal > 0) {
      const { data: creditResult, error: creditError } = await supabaseAdmin.rpc("atomic_wallet_credit", {
        p_user_id: targetUserId,
        p_amount: amountLocal,
        p_type: "survey_reward",
        p_idempotency_key: idempotencyKey,
        p_reference_id: transId,
        p_description: `CPX Research Survey Reward (Tx: ${transId})`
      });

      if (creditError) throw creditError;

      // Log in offerwall_logs
      await supabaseAdmin.from("offerwall_logs").insert({
        provider: "cpx",
        external_transaction_id: transId,
        user_id: targetUserId,
        amount: amountLocal,
        status: "credited",
        raw_payload: Object.fromEntries(url.searchParams.entries())
      });
    }

    return new Response("OK", { status: 200 });

  } catch (error: any) {
    console.error("[CPX_POSTBACK_ERROR]", error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
});
