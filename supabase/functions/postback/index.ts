// supabase/functions/postback/index.ts
// Unified Multi-Provider S2S Postback Handler (GET, JSON POST, Form-UrlEncoded POST)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { constantTimeCompare } from "../_shared/telegram-verification.ts";
import { logAuditEvent } from "../_shared/audit-log.ts";
import { sendUserAlert, notifyReferrerOfCommission } from "../_shared/alerts.ts";
import { getClientIp } from "../_shared/rate-limit.ts";
import {
  extractPostbackContext,
  processProviderPostback,
} from "../_shared/offers/postback-processor.ts";
import { sha256Hex } from "../_shared/crypto.ts";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) {
    throw new Error("Server configuration missing database credentials");
  }
  return createClient(url, key);
}

serve(async (req) => {
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const clientIp = getClientIp(req);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const url = new URL(req.url);
    const providerParam = (url.searchParams.get("provider") || "").toLowerCase().trim();

    // Generic legacy fallback ONLY when explicitly targeting provider=generic with OFFERWALL_GENERIC_SECRET
    if (providerParam === "generic") {
      const ctx = await extractPostbackContext(req, clientIp);
      const genericSecret = (Deno.env.get("OFFERWALL_GENERIC_SECRET") || "").trim();
      if (!genericSecret) {
        return new Response("500 Server Misconfiguration - OFFERWALL_GENERIC_SECRET not set", { status: 500 });
      }
      if (!ctx.params.secret || !constantTimeCompare(ctx.params.secret, genericSecret)) {
        await logAuditEvent({
          actorType: "offerwall",
          action: "postback_invalid_signature",
          targetType: "postback",
          targetId: ctx.params.tx_id || "missing",
          details: { provider: "generic" },
          ipAddress: clientIp,
        });
        return new Response("403 Forbidden - Security Signature Mismatch for generic", { status: 403 });
      }

      const rawUserId = (ctx.params.user_id || ctx.params.subid || "").trim();
      const rewardAmount = parseFloat(ctx.params.payout || ctx.params.amount || "0");
      const safeTxId = (ctx.params.tx_id || ctx.params.trans_id || "").trim();

      if (!rawUserId || safeTxId.length < 2 || !Number.isFinite(rewardAmount) || rewardAmount <= 0 || rewardAmount > 1000) {
        return new Response("400 Bad Request - Missing or invalid parameters", { status: 400 });
      }

      let targetUserId: string | null = null;
      if (/^\d+$/.test(rawUserId)) {
        const { data: u } = await supabaseAdmin.from("users").select("id").eq("telegram_id", parseInt(rawUserId, 10)).maybeSingle();
        if (u) targetUserId = u.id;
      } else {
        const { data: u } = await supabaseAdmin.from("users").select("id").eq("id", rawUserId).maybeSingle();
        if (u) targetUserId = u.id;
      }

      if (!targetUserId) return new Response("404 User Not Found", { status: 404 });

      const { data: creditData, error: creditErr } = await supabaseAdmin.rpc("atomic_wallet_credit", {
        p_user_id: targetUserId,
        p_amount: Math.round(rewardAmount * 100) / 100,
        p_type: "offer_reward",
        p_idempotency_key: `generic_${safeTxId}`,
        p_reference_id: safeTxId,
        p_description: `Partner Offer Completion (Tx: ${safeTxId})`,
      });
      if (creditErr) throw creditErr;

      const payloadHash = await sha256Hex(JSON.stringify(ctx.params));
      try {
        const { error: pbErr } = await supabaseAdmin.from("provider_postbacks").insert({
          external_transaction_id: safeTxId,
          event_type: "conversion",
          signature_valid: true,
          processing_status: creditData?.already_processed ? "duplicate" : "processed",
          payload_hash: payloadHash,
          processed_at: new Date().toISOString(),
        });
        if (pbErr) {
          console.warn("[POSTBACK_FORENSIC_LOG_WARN]", {
            code: (pbErr as any).code ?? null,
            message: pbErr.message,
          });
        }
      } catch (pbEx: any) {
        console.warn("[POSTBACK_FORENSIC_LOG_EXCEPTION]", pbEx?.message || pbEx);
      }

      if (!creditData?.already_processed) {
        try {
          const { error: owErr } = await supabaseAdmin.from("offerwall_logs").insert({
            provider: "generic",
            external_transaction_id: safeTxId,
            user_id: targetUserId,
            amount: rewardAmount,
            status: "credited",
            raw_payload: { tx_id: safeTxId },
          });
          if (owErr && (owErr as any).code !== "23505") {
            console.warn("[POSTBACK_OFFERWALL_LOG_WARN]", {
              code: (owErr as any).code ?? null,
              message: owErr.message,
            });
          }
        } catch (owEx: any) {
          console.warn("[POSTBACK_OFFERWALL_LOG_EXCEPTION]", owEx?.message || owEx);
        }

        await sendUserAlert(supabaseAdmin, {
          userId: targetUserId,
          category: "offer",
          eventKey: "offer_credited",
          title: "Offer Reward Credited!",
          message: `Your partner offer completed and +$${rewardAmount.toFixed(2)} has been credited to your wallet.`,
          amount: rewardAmount,
          actionUrl: "/wallet",
          ctaLabel: "💰 View Wallet",
        });
        await notifyReferrerOfCommission(supabaseAdmin, targetUserId, rewardAmount, "a partner offer");
      }

      return new Response("1", { status: 200 });
    }

    const result = await processProviderPostback({
      req,
      supabaseAdmin,
      clientIp,
    });

    return new Response(result.body, { status: result.status });
  } catch (err: any) {
    console.error("[POSTBACK_ERROR]", err);
    return new Response("500 Internal Server Error", { status: 500 });
  }
});
