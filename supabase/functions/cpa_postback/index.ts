// supabase/functions/cpa_postback/index.ts
// Fail-closed CPA network postback receiver with strict secret check, required txId & atomic crediting

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { constantTimeCompare } from "../_shared/telegram-verification.ts";
import { logAuditEvent } from "../_shared/audit-log.ts";
import { sendUserAlert, notifyReferrerOfCommission } from "../_shared/alerts.ts";
import { getClientIp } from "../_shared/rate-limit.ts";

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const clientIp = getClientIp(req);
  const CPA_SECRET = Deno.env.get("CPA_SECRET") || "";

  // Fail-closed in ALL environments: never accept unsigned CPA postbacks
  if (!CPA_SECRET) {
    console.error("[CPA_MISCONFIG] CPA_SECRET is not configured");
    return new Response("500 Server Misconfiguration - CPA_SECRET not set", { status: 500 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return new Response("500 Server Misconfiguration", { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);
    const rawUserId = url.searchParams.get("subid") || url.searchParams.get("aff_sub") || url.searchParams.get("user_id");
    const payout = parseFloat(url.searchParams.get("payout") || url.searchParams.get("amount") || "0");
    const network = (url.searchParams.get("network") || "cpa").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32) || "cpa";
    const txId = url.searchParams.get("tx_id") || url.searchParams.get("conversion_id") || url.searchParams.get("id");
    const providedSecret = url.searchParams.get("secret") || req.headers.get("x-cpa-secret") || "";

    // 0. Strict Constant-Time Secret Verification
    if (!providedSecret || !constantTimeCompare(providedSecret, CPA_SECRET)) {
      await logAuditEvent({
        actorType: "offerwall",
        action: "cpa_invalid_secret",
        targetType: "postback",
        targetId: txId || "missing",
        details: { network, rawUserId },
        ipAddress: clientIp,
      });
      return new Response("403 Forbidden - Invalid CPA Security Secret", { status: 403 });
    }

    if (!rawUserId) {
      return new Response("Missing SubID / User ID", { status: 400 });
    }

    if (!txId || txId.trim().length < 2) {
      return new Response("Missing Transaction ID", { status: 400 });
    }

    if (isNaN(payout) || !isFinite(payout) || payout <= 0 || payout > 1000) {
      return new Response("Invalid payout amount", { status: 400 });
    }

    // 1. Resolve User (supports opaque pv_ click token, Telegram ID, or UUID)
    let targetUserId: string | null = null;
    const cleanId = rawUserId.replace(/[\[\]{}"]/g, "").trim();

    if (cleanId.startsWith("pv_")) {
      const { data: clickRow } = await supabaseAdmin
        .from("offer_clicks")
        .select("user_id")
        .eq("opaque_click_id", cleanId)
        .maybeSingle();
      if (clickRow) targetUserId = clickRow.user_id;
    } else if (/^\d+$/.test(cleanId)) {
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

    // 2. Replay check (always uses provider-supplied txId)
    const safeTxId = txId.trim();
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
    const { data: creditData, error: creditError } = await supabaseAdmin.rpc("atomic_wallet_credit", {
      p_user_id: targetUserId,
      p_amount: payout,
      p_type: "offer_reward",
      p_idempotency_key: idempotencyKey,
      p_reference_id: safeTxId,
      p_description: `${network.toUpperCase()} CPA Conversion (Tx: ${safeTxId})`
    });

    if (creditError) throw creditError;
    if (creditData?.already_processed) {
      return new Response("OK - Already processed", { status: 200 });
    }

    // 4. Record log & forensic provider_postbacks entry
    const { error: logErr } = await supabaseAdmin.from("offerwall_logs").insert({
      provider: network,
      external_transaction_id: safeTxId,
      user_id: targetUserId,
      amount: payout,
      status: "credited",
      raw_payload: { tx_id: safeTxId, network }
    });
    if (logErr && (logErr as any).code !== "23505") {
      console.error("[CPA_LOG_INSERT_ERROR]", logErr);
    }

    try {
      const { error: pbErr } = await supabaseAdmin.from("provider_postbacks").insert({
        external_transaction_id: safeTxId,
        event_type: "conversion",
        signature_valid: true,
        processing_status: "processed",
        payload_hash: `${network}:${safeTxId}`,
        processed_at: new Date().toISOString(),
      });
      if (pbErr) {
        console.warn("[CPA_POSTBACK_LOG_WARN]", {
          code: (pbErr as any).code ?? null,
          message: pbErr.message,
        });
      }
    } catch (pbEx: any) {
      console.warn("[CPA_POSTBACK_LOG_EXCEPTION]", pbEx?.message || pbEx);
    }

    await sendUserAlert(supabaseAdmin, {
      userId: targetUserId,
      category: "offer",
      eventKey: "offer_credited",
      title: `${network.toUpperCase()} Offer Reward Credited!`,
      message: `Your ${network.toUpperCase()} offer conversion was verified and +$${payout.toFixed(2)} has been added to your wallet.`,
      amount: payout,
      actionUrl: "/wallet",
      ctaLabel: "💰 View Wallet",
      metadata: { provider: network, tx_id: safeTxId },
    });

    await notifyReferrerOfCommission(supabaseAdmin, targetUserId, payout, `a ${network.toUpperCase()} offer`);

    return new Response("Postback Success", { status: 200 });
  } catch (error: any) {
    console.error("[CPA_POSTBACK_ERROR]", error);
    return new Response("Error Processing Postback", { status: 500 });
  }
});
