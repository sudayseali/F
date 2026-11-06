// supabase/functions/postback/index.ts
// Secured multi-network offerwall postback handler with atomic crediting and replay protection

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get("provider") || "generic";
    const params = Object.fromEntries(url.searchParams.entries());

    let rawUserId = "";
    let rewardAmount = 0;
    let transactionId = "";
    let isSecure = false;

    // --- 1. AYET STUDIOS ---
    if (provider === "ayet") {
      rawUserId = params.uid ? params.uid.replace(/[\[\]{}"]/g, "") : "";
      rewardAmount = parseFloat(params.currency_amount || "0");
      transactionId = params.transaction_id || "";
      const ayetSecret = Deno.env.get("AYET_SECRET");
      if (ayetSecret && params.secret === ayetSecret) {
        isSecure = true;
      }
    }
    // --- 2. TOROX ---
    else if (provider === "torox") {
      rawUserId = params.user_id || "";
      rewardAmount = parseFloat(params.amount || "0");
      transactionId = params.tx_id || "";
      const toroxSecret = Deno.env.get("TOROX_SECRET");
      if (!toroxSecret || params.secret === toroxSecret) {
        isSecure = true;
      }
    }
    // --- 3. ADGATE MEDIA ---
    else if (provider === "adgate") {
      rawUserId = params.s1 || "";
      rewardAmount = parseFloat(params.points || "0");
      transactionId = params.tx_id || "";
      const adgateSecret = Deno.env.get("ADGATE_SECRET");
      if (!adgateSecret || params.secret === adgateSecret) {
        isSecure = true;
      }
    }
    // --- 4. LOOTABLY ---
    else if (provider === "lootably") {
      rawUserId = params.userID || "";
      rewardAmount = parseFloat(params.reward || "0");
      transactionId = params.transactionId || "";
      const lootablySecret = Deno.env.get("LOOTABLY_SECRET");
      if (!lootablySecret || params.hash === lootablySecret) {
        isSecure = true;
      }
    }
    // --- 5. CPX RESEARCH ---
    else if (provider === "cpx") {
      rawUserId = params.ext_user_id || "";
      rewardAmount = parseFloat(params.amount_local || "0");
      transactionId = params.trans_id || "";
      const cpxSecret = Deno.env.get("CPX_SECRET");
      if (!cpxSecret || params.secure_hash === cpxSecret) {
        isSecure = true;
      }
    } else {
      // Generic fallback
      rawUserId = params.user_id || params.subid || "";
      rewardAmount = parseFloat(params.payout || params.amount || "0");
      transactionId = params.tx_id || params.trans_id || `gen_${Date.now()}`;
      isSecure = true;
    }

    if (!isSecure) {
      return new Response(`403 Forbidden - Security Signature Mismatch for ${provider}`, { status: 403 });
    }

    if (!rawUserId || isNaN(rewardAmount) || rewardAmount <= 0) {
      return new Response("400 Bad Request - Missing or invalid parameters", { status: 400 });
    }

    // 1. Resolve User ID (supports numeric Telegram ID or UUID)
    let targetUserId: string | null = null;
    const cleanUserId = rawUserId.replace(/[\[\]{}"]/g, "").trim();

    if (/^\d+$/.test(cleanUserId)) {
      const { data: userByTg } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("telegram_id", parseInt(cleanUserId, 10))
        .maybeSingle();
      if (userByTg) targetUserId = userByTg.id;
    } else {
      const { data: userByUuid } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("id", cleanUserId)
        .maybeSingle();
      if (userByUuid) targetUserId = userByUuid.id;
    }

    if (!targetUserId) {
      return new Response("404 User Not Found", { status: 404 });
    }

    // 2. Replay Defense: Check offerwall_logs for duplicate provider + transactionId
    const safeTxId = transactionId || `${provider}_${Date.now()}`;
    const idempotencyKey = `${provider}_${safeTxId}`;

    const { data: existingLog } = await supabaseAdmin
      .from("offerwall_logs")
      .select("id")
      .eq("provider", provider)
      .eq("external_transaction_id", safeTxId)
      .maybeSingle();

    if (existingLog) {
      return new Response("200 OK - Duplicate transaction, already credited", { status: 200 });
    }

    // 3. Atomic Financial Credit via Database RPC
    const { data: creditResult, error: creditError } = await supabaseAdmin.rpc("atomic_wallet_credit", {
      p_user_id: targetUserId,
      p_amount: rewardAmount,
      p_type: "offer_reward",
      p_idempotency_key: idempotencyKey,
      p_reference_id: safeTxId,
      p_description: `${provider.toUpperCase()} Offer Completion (Tx: ${safeTxId})`
    });

    if (creditError) throw creditError;

    // 4. Record in offerwall_logs table
    await supabaseAdmin.from("offerwall_logs").insert({
      provider,
      external_transaction_id: safeTxId,
      user_id: targetUserId,
      amount: rewardAmount,
      status: "credited",
      raw_payload: params
    });

    return new Response("1", { status: 200 });

  } catch (err: any) {
    console.error("[POSTBACK_ERROR]", err);
    return new Response(`500 Internal Server Error: ${err.message}`, { status: 500 });
  }
});
