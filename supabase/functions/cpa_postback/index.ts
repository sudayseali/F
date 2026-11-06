// supabase/functions/cpa_postback/index.ts
// Secure CPA network postback receiver with idempotency and atomic crediting

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const rawUserId = url.searchParams.get("subid") || url.searchParams.get("aff_sub") || url.searchParams.get("user_id");
    const payout = parseFloat(url.searchParams.get("payout") || url.searchParams.get("amount") || "0");
    const network = url.searchParams.get("network") || "cpa";
    const txId = url.searchParams.get("tx_id") || url.searchParams.get("conversion_id") || url.searchParams.get("id");

    if (!rawUserId) {
      return new Response("Missing SubID / User ID", { status: 400 });
    }

    if (payout <= 0) {
      return new Response("Invalid payout amount", { status: 400 });
    }

    // 1. Resolve User
    let targetUserId: string | null = null;
    const cleanId = rawUserId.replace(/[\[\]{}"]/g, "").trim();

    if (/^\d+$/.test(cleanId)) {
      const { data: userByTg } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("telegram_id", parseInt(cleanId, 10))
        .maybeSingle();
      if (userByTg) targetUserId = userByTg.id;
    } else {
      const { data: userByUuid } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("id", cleanId)
        .maybeSingle();
      if (userByUuid) targetUserId = userByUuid.id;
    }

    if (!targetUserId) {
      return new Response("User not found", { status: 404 });
    }

    // 2. Replay check
    const safeTxId = txId || `cpa_${Date.now()}`;
    const idempotencyKey = `cpa_${network}_${safeTxId}`;

    const { data: existingLog } = await supabaseAdmin
      .from("offerwall_logs")
      .select("id")
      .eq("provider", network)
      .eq("external_transaction_id", safeTxId)
      .maybeSingle();

    if (existingLog) {
      return new Response("OK - Already processed", { status: 200 });
    }

    // 3. Atomic credit
    const { data: creditResult, error: creditError } = await supabaseAdmin.rpc("atomic_wallet_credit", {
      p_user_id: targetUserId,
      p_amount: payout,
      p_type: "offer_reward",
      p_idempotency_key: idempotencyKey,
      p_reference_id: safeTxId,
      p_description: `${network.toUpperCase()} CPA Conversion (Tx: ${safeTxId})`
    });

    if (creditError) throw creditError;

    // 4. Record log
    await supabaseAdmin.from("offerwall_logs").insert({
      provider: network,
      external_transaction_id: safeTxId,
      user_id: targetUserId,
      amount: payout,
      status: "credited",
      raw_payload: Object.fromEntries(url.searchParams.entries())
    });

    return new Response("Postback Success", { status: 200 });
  } catch (error: any) {
    console.error("[CPA_POSTBACK_ERROR]", error);
    return new Response(`Error Processing Postback: ${error.message}`, { status: 500 });
  }
});
