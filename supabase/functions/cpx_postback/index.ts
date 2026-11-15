// supabase/functions/cpx_postback/index.ts
// Fail-closed, idempotent CPX Research offerwall postback receiver with real MD5 & SHA-256 verification

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { constantTimeCompare } from "../_shared/telegram-verification.ts";
import { md5Hex, sha256Hex } from "../_shared/crypto.ts";
import { logAuditEvent } from "../_shared/audit-log.ts";
import { sendUserAlert, notifyReferrerOfCommission } from "../_shared/alerts.ts";

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const CPX_SECRET = Deno.env.get("CPX_SECRET") || "";

  // Fail-closed: never accept unauthenticated CPX postbacks
  if (!CPX_SECRET) {
    console.error("[CPX_MISCONFIG] CPX_SECRET is not configured");
    return new Response("500 Server Misconfiguration - CPX_SECRET not set", { status: 500 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) {
    return new Response("500 Server Misconfiguration", { status: 500 });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  try {
    const url = new URL(req.url);

    const status = url.searchParams.get("status"); // 1 = complete, 2 = chargeback/reversal
    const transId = url.searchParams.get("trans_id");
    const rawUserId = url.searchParams.get("user_id") || url.searchParams.get("sub_id") || url.searchParams.get("ext_user_id");
    const amountLocal = parseFloat(url.searchParams.get("amount_local") || url.searchParams.get("amount") || "0");
    const secureHash = url.searchParams.get("hash") || url.searchParams.get("secure_hash");

    if (!rawUserId) {
      return new Response("Missing User ID", { status: 400 });
    }

    if (!transId) {
      return new Response("Missing Transaction ID", { status: 400 });
    }

    if (!secureHash) {
      return new Response("403 Forbidden - Missing required CPX hash parameter", { status: 403 });
    }

    // 1. Cryptographic Signature Verification (CPX supports MD5(trans_id-secret) or SHA-256(trans_id-secret))
    const dataToHash = `${transId}-${CPX_SECRET}`;
    const expectedSha256 = await sha256Hex(dataToHash);
    const expectedMd5 = md5Hex(dataToHash);
    const providedLower = secureHash.toLowerCase();

    const matched =
      constantTimeCompare(providedLower, expectedSha256.toLowerCase()) ||
      constantTimeCompare(providedLower, expectedMd5.toLowerCase());

    if (!matched) {
      console.warn(`[CPX_SECURITY_WARNING] Signature mismatch for trans_id ${transId}`);
      await logAuditEvent({
        actorType: "offerwall",
        action: "cpx_invalid_signature",
        targetType: "postback",
        targetId: transId,
        details: { rawUserId, status },
        ipAddress: clientIp,
      });
      return new Response("403 Forbidden - Invalid signature hash", { status: 403 });
    }

    // 2. Lookup User by UUID or Telegram ID
    let targetUserId: string | null = null;
    const cleanUserId = rawUserId.trim();
    const isNumeric = /^\d+$/.test(cleanUserId);

    if (isNumeric) {
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
      return new Response("User not found in system", { status: 404 });
    }

    // 3. Replay Protection via offerwall_logs
    const idempotencyKey = `cpx_${transId}`;
    const { data: existingLog } = await supabaseAdmin
      .from("offerwall_logs")
      .select("id, status")
      .eq("provider", "cpx")
      .eq("external_transaction_id", transId)
      .maybeSingle();

    if (existingLog) {
      return new Response("OK - Already processed", { status: 200 });
    }

    // 4. Atomic Financial Credit
    if (status === "1") {
      if (isNaN(amountLocal) || !isFinite(amountLocal) || amountLocal <= 0 || amountLocal > 1000) {
        return new Response("Invalid payout amount", { status: 400 });
      }

      const { error: creditError } = await supabaseAdmin.rpc("atomic_wallet_credit", {
        p_user_id: targetUserId,
        p_amount: amountLocal,
        p_type: "survey_reward",
        p_idempotency_key: idempotencyKey,
        p_reference_id: transId,
        p_description: `CPX Research Survey Reward (Tx: ${transId})`
      });

      if (creditError) throw creditError;

      await supabaseAdmin.from("offerwall_logs").insert({
        provider: "cpx",
        external_transaction_id: transId,
        user_id: targetUserId,
        amount: amountLocal,
        status: "credited",
        raw_payload: Object.fromEntries(url.searchParams.entries())
      });

      await sendUserAlert(supabaseAdmin, {
        userId: targetUserId,
        category: "offer",
        eventKey: "offer_credited",
        title: "CPX Survey Reward Credited!",
        message: `You completed a CPX Research survey and received +$${amountLocal.toFixed(2)} in your wallet.`,
        amount: amountLocal,
        actionUrl: "/wallet",
        ctaLabel: "💰 View Wallet",
        metadata: { provider: "cpx", trans_id: transId },
      });

      await notifyReferrerOfCommission(supabaseAdmin, targetUserId, amountLocal, "a CPX Research survey");
    } else if (status === "2") {
      await logAuditEvent({
        actorId: targetUserId,
        actorType: "offerwall",
        action: "cpx_chargeback_received",
        targetType: "postback",
        targetId: transId,
        details: { amountLocal },
        ipAddress: clientIp,
      });

      await sendUserAlert(supabaseAdmin, {
        userId: targetUserId,
        category: "offer",
        eventKey: "offer_chargeback",
        title: "CPX Survey Reversal Notice",
        message: `CPX Research reported a reversal for transaction ${transId}.`,
        actionUrl: "/offerwall",
        ctaLabel: "🎁 View Offers",
        metadata: { provider: "cpx", trans_id: transId, amount: amountLocal },
      });
    }

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("[CPX_POSTBACK_ERROR]", error);
    return new Response("Error Processing Postback", { status: 500 });
  }
});
