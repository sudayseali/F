// supabase/functions/tapjoy_webhook/index.ts
// Fail-closed Tapjoy Server-to-Server Callback with real MD5 verification & replay defense

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { constantTimeCompare } from "../_shared/telegram-verification.ts";
import { md5Hex } from "../_shared/crypto.ts";
import { logAuditEvent } from "../_shared/audit-log.ts";
import { sendUserAlert, notifyReferrerOfCommission } from "../_shared/alerts.ts";

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    const url = new URL(req.url);

    const userId = url.searchParams.get("snuid");
    const currency = url.searchParams.get("currency");
    const transactionId = url.searchParams.get("id");
    const verifier = url.searchParams.get("verifier");
    const tapjoySecret = Deno.env.get("TAPJOY_SECRET_KEY") || Deno.env.get("TAPJOY_SECRET");

    // Fail-closed: refuse callbacks if server secret is not configured
    if (!tapjoySecret) {
      console.error("[TAPJOY_MISCONFIG] TAPJOY_SECRET is not configured");
      return new Response("500 Server Misconfiguration - TAPJOY_SECRET not set", { status: 500 });
    }

    if (!userId || !currency || !transactionId) {
      return new Response("Missing required parameters (snuid, currency, or id)", { status: 400 });
    }

    if (!verifier) {
      return new Response("403 Forbidden - Missing required verifier signature", { status: 403 });
    }

    // Security Verification: Tapjoy official MD5(id:snuid:currency:secret_key)
    const rawString = `${transactionId}:${userId}:${currency}:${tapjoySecret}`;
    const expectedHash = md5Hex(rawString);

    if (!constantTimeCompare(verifier.toLowerCase(), expectedHash.toLowerCase())) {
      await logAuditEvent({
        actorType: "offerwall",
        action: "tapjoy_invalid_signature",
        targetType: "postback",
        targetId: transactionId,
        details: { userId, currency },
        ipAddress: clientIp,
      });
      return new Response("403 Forbidden - Invalid Tapjoy Verifier Signature", { status: 403 });
    }

    const payout = parseFloat(currency);
    if (isNaN(payout) || !isFinite(payout) || payout <= 0 || payout > 1000) {
      return new Response("Invalid payout amount", { status: 400 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceKey) {
      return new Response("500 Server Misconfiguration", { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Fetch user (support UUID or Telegram ID)
    let targetUserId: string | null = null;
    if (/^\d+$/.test(userId.trim())) {
      const { data: userByTg } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("telegram_id", parseInt(userId.trim(), 10))
        .maybeSingle();
      if (userByTg) targetUserId = userByTg.id;
    } else {
      const { data: userByUuid } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("id", userId.trim())
        .maybeSingle();
      if (userByUuid) targetUserId = userByUuid.id;
    }

    if (!targetUserId) {
      return new Response("User not found", { status: 404 });
    }

    // Replay defense via offerwall_logs
    const { data: existingLog } = await supabaseAdmin
      .from("offerwall_logs")
      .select("id")
      .eq("provider", "tapjoy")
      .eq("external_transaction_id", transactionId)
      .maybeSingle();

    if (existingLog) {
      return new Response("OK", { status: 200 });
    }

    const idempotencyKey = `tapjoy_${transactionId}`;
    const { error: creditError } = await supabaseAdmin.rpc("atomic_wallet_credit", {
      p_user_id: targetUserId,
      p_amount: payout,
      p_type: "offer_reward",
      p_idempotency_key: idempotencyKey,
      p_reference_id: transactionId,
      p_description: `Tapjoy Offer Reward (Tx: ${transactionId})`
    });

    if (creditError) throw creditError;

    await supabaseAdmin.from("offerwall_logs").insert({
      provider: "tapjoy",
      external_transaction_id: transactionId,
      user_id: targetUserId,
      amount: payout,
      status: "credited",
      raw_payload: Object.fromEntries(url.searchParams.entries()),
    });

    await sendUserAlert(supabaseAdmin, {
      userId: targetUserId,
      category: "offer",
      eventKey: "offer_credited",
      title: "Tapjoy Offer Reward Credited!",
      message: `Your Tapjoy offer reward of +$${payout.toFixed(2)} has been added to your Payvora wallet.`,
      amount: payout,
      actionUrl: "/wallet",
      ctaLabel: "💰 View Wallet",
      metadata: { provider: "tapjoy", transaction_id: transactionId },
    });

    await notifyReferrerOfCommission(supabaseAdmin, targetUserId, payout, "a Tapjoy offer");

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Tapjoy Postback error:", error);
    return new Response("Error Processing Postback", { status: 500 });
  }
});
