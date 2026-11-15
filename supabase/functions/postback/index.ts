// supabase/functions/postback/index.ts
// Secured multi-network offerwall postback handler with cryptographic signatures, required txId, and replay protection

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { constantTimeCompare } from "../_shared/telegram-verification.ts";
import { md5Hex, sha256Hex, hmacSha256Hex } from "../_shared/crypto.ts";
import { logAuditEvent } from "../_shared/audit-log.ts";

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

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const url = new URL(req.url);
    const provider = (url.searchParams.get("provider") || "generic").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32) || "generic";
    const params = Object.fromEntries(url.searchParams.entries());

    let rawUserId = "";
    let rewardAmount = 0;
    let transactionId = "";
    let isSecure = false;
    let serverConfigured = false;

    // --- 1. AYET STUDIOS ---
    if (provider === "ayet") {
      rawUserId = params.uid ? params.uid.replace(/[\[\]{}"]/g, "") : "";
      rewardAmount = parseFloat(params.currency_amount || params.payout_usd || "0");
      transactionId = params.transaction_id || "";
      const ayetSecret = Deno.env.get("AYET_SECRET") || "";
      serverConfigured = Boolean(ayetSecret);

      if (ayetSecret) {
        const ayetSig = req.headers.get("X-Ayetstudios-Security-Hash") || req.headers.get("x-ayetstudios-security-hash") || "";
        if (ayetSig) {
          // ayeT official HMAC-SHA256 over sorted query string (excluding provider if routed internally)
          const sortedQuery = Object.keys(params)
            .filter((k) => k !== "provider")
            .sort()
            .map((k) => `${k}=${params[k]}`)
            .join("&");
          const expectedHmac = await hmacSha256Hex(ayetSecret, sortedQuery);
          isSecure = constantTimeCompare(ayetSig.toLowerCase(), expectedHmac.toLowerCase());
        } else if (params.secret) {
          isSecure = constantTimeCompare(params.secret, ayetSecret);
        }
      }
    }
    // --- 2. TOROX ---
    else if (provider === "torox") {
      rawUserId = params.user_id || "";
      rewardAmount = parseFloat(params.amount || "0");
      transactionId = params.tx_id || params.oid || "";
      const toroxSecret = Deno.env.get("TOROX_SECRET") || "";
      serverConfigured = Boolean(toroxSecret);

      if (toroxSecret) {
        if (params.sig && transactionId && rawUserId) {
          const expectedSig = md5Hex(`${transactionId}-${rawUserId}-${toroxSecret}`);
          isSecure = constantTimeCompare(params.sig.toLowerCase(), expectedSig.toLowerCase());
        } else if (params.secret) {
          isSecure = constantTimeCompare(params.secret, toroxSecret);
        }
      }
    }
    // --- 3. ADGATE MEDIA ---
    else if (provider === "adgate") {
      rawUserId = params.s1 || "";
      rewardAmount = parseFloat(params.points || params.payout || "0");
      transactionId = params.tx_id || "";
      const adgateSecret = Deno.env.get("ADGATE_SECRET") || "";
      serverConfigured = Boolean(adgateSecret);

      if (adgateSecret && params.secret) {
        isSecure = constantTimeCompare(params.secret, adgateSecret);
      }
    }
    // --- 4. LOOTABLY ---
    else if (provider === "lootably") {
      rawUserId = params.userID || "";
      rewardAmount = parseFloat(params.reward || "0");
      transactionId = params.transactionId || "";
      const lootablySecret = Deno.env.get("LOOTABLY_SECRET") || "";
      serverConfigured = Boolean(lootablySecret);

      if (lootablySecret && params.hash) {
        const expectedSha = await sha256Hex(`${rawUserId}${params.ip || ""}${params.reward || ""}${lootablySecret}`);
        const expectedMd5 = md5Hex(`${rawUserId}${params.ip || ""}${params.reward || ""}${lootablySecret}`);
        const providedLower = params.hash.toLowerCase();
        isSecure =
          constantTimeCompare(providedLower, expectedSha.toLowerCase()) ||
          constantTimeCompare(providedLower, expectedMd5.toLowerCase()) ||
          constantTimeCompare(params.hash, lootablySecret);
      }
    }
    // --- 5. CPX RESEARCH ---
    else if (provider === "cpx") {
      rawUserId = params.ext_user_id || params.user_id || "";
      rewardAmount = parseFloat(params.amount_local || params.amount || "0");
      transactionId = params.trans_id || "";
      const cpxSecret = Deno.env.get("CPX_SECRET") || "";
      serverConfigured = Boolean(cpxSecret);
      const providedHash = params.hash || params.secure_hash || "";

      if (cpxSecret && providedHash && transactionId) {
        const expectedMd5 = md5Hex(`${transactionId}-${cpxSecret}`);
        const expectedSha = await sha256Hex(`${transactionId}-${cpxSecret}`);
        const providedLower = providedHash.toLowerCase();
        isSecure =
          constantTimeCompare(providedLower, expectedMd5.toLowerCase()) ||
          constantTimeCompare(providedLower, expectedSha.toLowerCase()) ||
          constantTimeCompare(providedHash, cpxSecret);
      }
    } else {
      // Generic fallback: MUST supply a valid server generic secret
      const genericSecret = Deno.env.get("OFFERWALL_GENERIC_SECRET") || "";
      serverConfigured = Boolean(genericSecret);
      if (genericSecret && params.secret && constantTimeCompare(params.secret, genericSecret)) {
        rawUserId = params.user_id || params.subid || "";
        rewardAmount = parseFloat(params.payout || params.amount || "0");
        transactionId = params.tx_id || params.trans_id || "";
        isSecure = true;
      }
    }

    if (!serverConfigured) {
      console.error(`[POSTBACK_MISCONFIG] Secret missing for provider '${provider}'`);
      return new Response(`500 Server Misconfiguration - Secret not set for ${provider}`, { status: 500 });
    }

    if (!isSecure) {
      await logAuditEvent({
        actorType: "offerwall",
        action: "postback_invalid_signature",
        targetType: "postback",
        targetId: transactionId || "missing",
        details: { provider, rawUserId },
        ipAddress: clientIp,
      });
      return new Response(`403 Forbidden - Security Signature Mismatch for ${provider}`, { status: 403 });
    }

    if (!transactionId || transactionId.trim().length < 2) {
      return new Response("400 Bad Request - Missing required transactionId", { status: 400 });
    }

    if (!rawUserId || isNaN(rewardAmount) || !isFinite(rewardAmount) || rewardAmount <= 0 || rewardAmount > 1000) {
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
    const safeTxId = transactionId.trim();
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
    const { error: creditError } = await supabaseAdmin.rpc("atomic_wallet_credit", {
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
    return new Response("500 Internal Server Error", { status: 500 });
  }
});
