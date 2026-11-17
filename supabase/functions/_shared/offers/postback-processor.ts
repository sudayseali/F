// supabase/functions/_shared/offers/postback-processor.ts
// Hardened Multi-Provider Postback, Click Attribution, Reward Split, Reversal & Notification Engine

import { sha256Hex } from "../crypto.ts";
import { logAuditEvent } from "../audit-log.ts";
import { sendUserAlert, notifyReferrerOfCommission } from "../alerts.ts";
import { getProviderAdapter } from "../providers/registry.ts";
import type { PostbackRequestContext } from "../providers/types.ts";
import { buildRewardCalculator, loadCommissionConfig } from "./reward-engine.ts";
import { isValidUuid } from "../validation.ts";

export interface PostbackProcessOptions {
  req: Request;
  supabaseAdmin: any;
  forcedProviderKey?: string;
  clientIp: string;
}

export interface PostbackProcessResult {
  status: number;
  body: string;
}

export async function extractPostbackContext(
  req: Request,
  clientIp: string
): Promise<PostbackRequestContext> {
  const url = new URL(req.url);
  const params: Record<string, string> = {};

  for (const [k, v] of url.searchParams.entries()) {
    params[k] = v;
  }

  let rawBody = "";
  if (req.method === "POST" || req.method === "PUT") {
    rawBody = await req.text().catch(() => "");
    const contentType = (req.headers.get("content-type") || "").toLowerCase();

    if (rawBody.trim()) {
      if (contentType.includes("application/json") || rawBody.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(rawBody);
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
              if (v !== undefined && v !== null && typeof v !== "object") {
                params[k] = String(v);
              }
            }
          }
        } catch {
          // Malformed JSON ignored safely; verification will fail-closed if params missing
        }
      } else if (contentType.includes("application/x-www-form-urlencoded")) {
        const form = new URLSearchParams(rawBody);
        for (const [k, v] of form.entries()) {
          params[k] = v;
        }
      }
    }
  }

  return {
    method: req.method,
    url,
    params,
    headers: req.headers,
    rawBody,
    clientIp,
  };
}

async function resolveUserAndAttribution(
  supabaseAdmin: any,
  providerId: string | null,
  rawRef: string,
  opaqueClickId?: string,
  externalOfferId?: string
): Promise<{
  userId: string | null;
  offerId: string | null;
  clickId: string | null;
  offerTitle: string | null;
}> {
  const cleanRef = rawRef.replace(/[\[\]{}"]/g, "").trim();

  // 1. Primary path: Opaque Click ID attribution (pv_...)
  const clickCandidate = opaqueClickId || (cleanRef.startsWith("pv_") ? cleanRef : "");
  if (clickCandidate) {
    const { data: clickRow } = await supabaseAdmin
      .from("offer_clicks")
      .select("id, user_id, offer_id, provider_id, expires_at")
      .eq("opaque_click_id", clickCandidate)
      .maybeSingle();

    if (clickRow) {
      let offerTitle: string | null = null;
      if (clickRow.offer_id) {
        const { data: off } = await supabaseAdmin
          .from("offers")
          .select("title")
          .eq("id", clickRow.offer_id)
          .maybeSingle();
        offerTitle = off?.title || null;
      }
      return {
        userId: clickRow.user_id,
        offerId: clickRow.offer_id,
        clickId: clickRow.id,
        offerTitle,
      };
    }
  }

  // 2. Fallback attribution: Internal UUID or Telegram ID (for Hosted Partner Walls)
  let userId: string | null = null;
  if (/^\d+$/.test(cleanRef)) {
    const { data: userByTg } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("telegram_id", parseInt(cleanRef, 10))
      .maybeSingle();
    if (userByTg) userId = userByTg.id;
  } else if (isValidUuid(cleanRef)) {
    const { data: userByUuid } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", cleanRef)
      .maybeSingle();
    if (userByUuid) userId = userByUuid.id;
  }

  let offerId: string | null = null;
  let offerTitle: string | null = null;
  if (providerId && externalOfferId) {
    const { data: offerRow } = await supabaseAdmin
      .from("offers")
      .select("id, title")
      .eq("provider_id", providerId)
      .eq("external_offer_id", externalOfferId.trim())
      .maybeSingle();
    if (offerRow) {
      offerId = offerRow.id;
      offerTitle = offerRow.title;
    }
  }

  return { userId, offerId, clickId: null, offerTitle };
}

async function recordPostbackLog(
  supabaseAdmin: any,
  entry: {
    providerId: string | null;
    externalTransactionId: string;
    eventType: "conversion" | "reversal" | "pending" | "unknown";
    signatureValid: boolean;
    processingStatus: "processed" | "duplicate" | "rejected" | "error";
    payloadHash: string;
  }
) {
  try {
    await supabaseAdmin.from("provider_postbacks").insert({
      provider_id: entry.providerId,
      external_transaction_id: entry.externalTransactionId.slice(0, 180) || "missing",
      event_type: entry.eventType,
      signature_valid: entry.signatureValid,
      processing_status: entry.processingStatus,
      payload_hash: entry.payloadHash,
      processed_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[POSTBACK_AUDIT_LOG_WARN]", err);
  }
}

export async function processProviderPostback(
  opts: PostbackProcessOptions
): Promise<PostbackProcessResult> {
  const { req, supabaseAdmin, clientIp } = opts;
  const ctx = await extractPostbackContext(req, clientIp);

  const rawProvider =
    opts.forcedProviderKey || ctx.params.provider || ctx.url.searchParams.get("provider") || "";
  const providerKey = rawProvider
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 32);

  if (!providerKey) {
    return { status: 400, body: "400 Bad Request - Missing provider identifier" };
  }

  const payloadHash = await sha256Hex(
    `${ctx.method}|${ctx.url.pathname}|${JSON.stringify(ctx.params)}|${ctx.rawBody}`
  );

  const { data: providerRow } = await supabaseAdmin
    .from("offer_providers")
    .select("id, display_name, commission_override_percent")
    .eq("provider_key", providerKey)
    .maybeSingle();

  const providerId: string | null = providerRow?.id || null;
  const adapter = getProviderAdapter(providerKey);

  if (!adapter) {
    await recordPostbackLog(supabaseAdmin, {
      providerId,
      externalTransactionId: ctx.params.tx_id || ctx.params.trans_id || ctx.params.id || "unknown",
      eventType: "unknown",
      signatureValid: false,
      processingStatus: "rejected",
      payloadHash,
    });
    return { status: 400, body: `400 Bad Request - Unsupported provider '${providerKey}'` };
  }

  // 1. Strict Fail-Closed Signature Verification
  const verifyResult = await adapter.verifyPostback(ctx);
  if (!verifyResult.configured) {
    await recordPostbackLog(supabaseAdmin, {
      providerId,
      externalTransactionId: ctx.params.tx_id || ctx.params.trans_id || ctx.params.id || "unknown",
      eventType: "unknown",
      signatureValid: false,
      processingStatus: "error",
      payloadHash,
    });
    return { status: 500, body: `500 Server Misconfiguration - ${verifyResult.reason || "Secret missing"}` };
  }

  if (!verifyResult.valid) {
    await logAuditEvent({
      actorType: "offerwall",
      action: "postback_invalid_signature",
      targetType: "postback",
      targetId: ctx.params.tx_id || ctx.params.trans_id || ctx.params.id || "missing",
      details: { provider: providerKey, reason: verifyResult.reason },
      ipAddress: clientIp,
    });

    await recordPostbackLog(supabaseAdmin, {
      providerId,
      externalTransactionId: ctx.params.tx_id || ctx.params.trans_id || ctx.params.id || "invalid",
      eventType: "unknown",
      signatureValid: false,
      processingStatus: "rejected",
      payloadHash,
    });

    return { status: 403, body: `403 Forbidden - Signature mismatch for ${providerKey}` };
  }

  // 2. Check Reversal Event first
  const reversal = adapter.parseReversal(ctx);
  if (reversal) {
    const attr = await resolveUserAndAttribution(
      supabaseAdmin,
      providerId,
      reversal.rawUserOrClickRef,
      reversal.opaqueClickId
    );
    if (!attr.userId || !providerId) {
      await recordPostbackLog(supabaseAdmin, {
        providerId,
        externalTransactionId: reversal.externalTransactionId,
        eventType: "reversal",
        signatureValid: true,
        processingStatus: "rejected",
        payloadHash,
      });
      return { status: 404, body: "404 User or Provider Not Found" };
    }

    // Look up original completion so partial/full reversal uses exact user reward ratio
    const { data: origComp } = await supabaseAdmin
      .from("offer_completions")
      .select("provider_reward, user_reward")
      .eq("provider_id", providerId)
      .eq("external_transaction_id", reversal.externalTransactionId)
      .maybeSingle();

    let userReversalUsd = 0;
    if (origComp && Number(origComp.user_reward) > 0) {
      if (reversal.reversalAmount <= 0 || reversal.reversalAmount >= Number(origComp.provider_reward)) {
        userReversalUsd = Number(origComp.user_reward);
      } else if (Number(origComp.provider_reward) > 0) {
        const ratio = reversal.reversalAmount / Number(origComp.provider_reward);
        userReversalUsd = Math.round(Number(origComp.user_reward) * ratio * 100) / 100;
      }
    } else if (reversal.reversalAmount > 0) {
      const cfg = await loadCommissionConfig(supabaseAdmin);
      const calc = buildRewardCalculator(
        cfg,
        providerKey,
        providerRow?.commission_override_percent !== null
          ? Number(providerRow.commission_override_percent)
          : null
      );
      const split = calc(reversal.reversalAmount, { currency: reversal.currency });
      userReversalUsd = split ? split.userReward : Math.round(reversal.reversalAmount * 100) / 100;
    }

    const { data: revRes, error: revErr } = await supabaseAdmin.rpc(
      "process_offer_reversal_atomic",
      {
        p_provider_id: providerId,
        p_provider_key: providerKey,
        p_user_id: attr.userId,
        p_external_tx_id: reversal.externalTransactionId,
        p_reversal_user_amount: userReversalUsd,
        p_reversal_tx_id: reversal.reversalTransactionId || null,
      }
    );

    if (revErr) {
      await recordPostbackLog(supabaseAdmin, {
        providerId,
        externalTransactionId: reversal.externalTransactionId,
        eventType: "reversal",
        signatureValid: true,
        processingStatus: "error",
        payloadHash,
      });
      throw revErr;
    }

    const isDup = Boolean(revRes?.already_processed);
    await recordPostbackLog(supabaseAdmin, {
      providerId,
      externalTransactionId: reversal.externalTransactionId,
      eventType: "reversal",
      signatureValid: true,
      processingStatus: isDup ? "duplicate" : "processed",
      payloadHash,
    });

    if (!isDup && (Number(revRes?.deducted || 0) > 0 || revRes?.status === "reversed" || revRes?.status === "partially_reversed")) {
      await logAuditEvent({
        actorId: attr.userId,
        actorType: "offerwall",
        action: "offer_chargeback_processed",
        targetType: "offer_completion",
        targetId: reversal.externalTransactionId,
        details: revRes,
        ipAddress: clientIp,
      });

      await sendUserAlert(supabaseAdmin, {
        userId: attr.userId,
        category: "offer",
        eventKey: "offer_chargeback",
        title: `${adapter.displayName} Reward Reversed`,
        message: `A conversion (${reversal.externalTransactionId}) was reversed by ${adapter.displayName}. Adjusted amount: -$${Number(revRes.deducted || 0).toFixed(2)}.`,
        actionUrl: "/offerwall",
        ctaLabel: "🎁 View Offers",
        metadata: {
          provider: providerKey,
          tx_id: reversal.externalTransactionId,
          deducted: revRes.deducted,
          deficit: revRes.unrecovered_deficit,
        },
      });
    }

    return { status: 200, body: "OK" };
  }

  // 3. Parse Conversion Event
  const conv = adapter.parseConversion(ctx);
  if (!conv) {
    await recordPostbackLog(supabaseAdmin, {
      providerId,
      externalTransactionId: ctx.params.tx_id || ctx.params.trans_id || "invalid",
      eventType: "unknown",
      signatureValid: true,
      processingStatus: "rejected",
      payloadHash,
    });
    return { status: 400, body: "400 Bad Request - Missing or invalid conversion parameters" };
  }

  if (!conv.timestampValid) {
    await recordPostbackLog(supabaseAdmin, {
      providerId,
      externalTransactionId: conv.externalTransactionId,
      eventType: "conversion",
      signatureValid: false,
      processingStatus: "rejected",
      payloadHash,
    });
    return { status: 403, body: "403 Forbidden - Stale postback timestamp" };
  }

  const attr = await resolveUserAndAttribution(
    supabaseAdmin,
    providerId,
    conv.rawUserOrClickRef,
    conv.opaqueClickId,
    conv.externalOfferId
  );

  if (!attr.userId || !providerId) {
    await recordPostbackLog(supabaseAdmin, {
      providerId,
      externalTransactionId: conv.externalTransactionId,
      eventType: "conversion",
      signatureValid: true,
      processingStatus: "rejected",
      payloadHash,
    });
    return { status: 404, body: "404 User Not Found" };
  }

  // Handle Pending Conversion status cleanly without crediting yet
  if (conv.isPending) {
    if (attr.offerId) {
      await supabaseAdmin.from("offer_user_status").upsert(
        {
          user_id: attr.userId,
          offer_id: attr.offerId,
          click_id: attr.clickId,
          progress_status: "pending",
          status_note: `Pending confirmation from ${adapter.displayName}`,
          last_updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,offer_id" }
      );
    }

    await recordPostbackLog(supabaseAdmin, {
      providerId,
      externalTransactionId: conv.externalTransactionId,
      eventType: "pending",
      signatureValid: true,
      processingStatus: "processed",
      payloadHash,
    });

    await sendUserAlert(supabaseAdmin, {
      userId: attr.userId,
      category: "offer",
      eventKey: "offer_pending",
      title: `${adapter.displayName} Offer Pending`,
      message: `${attr.offerTitle || "Your offer"} is pending verification by ${adapter.displayName}. Rewards credit automatically upon confirmation.`,
      actionUrl: "/offerwall",
      ctaLabel: "🎁 View History",
    });

    return { status: 200, body: "OK - Pending" };
  }

  // 4. Server-side Decimal-Safe Commission & Reward Split
  const commissionConfig = await loadCommissionConfig(supabaseAdmin);
  const calc = buildRewardCalculator(
    commissionConfig,
    providerKey,
    providerRow?.commission_override_percent !== null
      ? Number(providerRow.commission_override_percent)
      : null
  );

  const split = calc(conv.providerReward, {
    currency: conv.currency,
    providerKey,
  });

  if (!split || split.userReward <= 0) {
    await recordPostbackLog(supabaseAdmin, {
      providerId,
      externalTransactionId: conv.externalTransactionId,
      eventType: "conversion",
      signatureValid: true,
      processingStatus: "rejected",
      payloadHash,
    });
    return { status: 400, body: "400 Bad Request - Reward out of permitted range" };
  }

  const txType = providerKey === "cpx" ? "survey_reward" : "offer_reward";
  const label = attr.offerTitle
    ? `${attr.offerTitle} (${adapter.displayName})`
    : `${adapter.displayName} Offer`;

  const { data: atomicRes, error: atomicErr } = await supabaseAdmin.rpc(
    "process_offer_conversion_atomic",
    {
      p_provider_id: providerId,
      p_provider_key: providerKey,
      p_user_id: attr.userId,
      p_offer_id: attr.offerId,
      p_click_id: attr.clickId,
      p_external_tx_id: conv.externalTransactionId,
      p_provider_reward: split.providerReward,
      p_user_reward: split.userReward,
      p_payvora_commission: split.payvoraCommission,
      p_tx_type: txType,
      p_description: `${label} (Tx: ${conv.externalTransactionId})`,
      p_raw_payload: { tx: conv.externalTransactionId, offer_id: conv.externalOfferId || null },
    }
  );

  if (atomicErr) {
    await recordPostbackLog(supabaseAdmin, {
      providerId,
      externalTransactionId: conv.externalTransactionId,
      eventType: "conversion",
      signatureValid: true,
      processingStatus: "error",
      payloadHash,
    });
    throw atomicErr;
  }

  if (atomicRes?.success === false) {
    await recordPostbackLog(supabaseAdmin, {
      providerId,
      externalTransactionId: conv.externalTransactionId,
      eventType: "conversion",
      signatureValid: true,
      processingStatus: "rejected",
      payloadHash,
    });
    return { status: 403, body: atomicRes.error || "Conversion rejected" };
  }

  const isDuplicate = Boolean(atomicRes?.already_processed);

  await recordPostbackLog(supabaseAdmin, {
    providerId,
    externalTransactionId: conv.externalTransactionId,
    eventType: "conversion",
    signatureValid: true,
    processingStatus: isDuplicate ? "duplicate" : "processed",
    payloadHash,
  });

  if (isDuplicate) {
    return { status: 200, body: "200 OK - Duplicate transaction, already credited" };
  }

  // 5. Idempotent Bot Chat Notifications ONLY after confirmed fresh commit
  await sendUserAlert(supabaseAdmin, {
    userId: attr.userId,
    category: "offer",
    eventKey: "offer_credited",
    title: `${adapter.displayName} Reward Credited!`,
    message: `${attr.offerTitle ? `"${attr.offerTitle}"` : `Your ${adapter.displayName} offer`} completed and +$${split.userReward.toFixed(2)} has been credited to your wallet.`,
    amount: split.userReward,
    actionUrl: "/wallet",
    ctaLabel: "💰 View Wallet",
    metadata: {
      provider: providerKey,
      transaction_id: conv.externalTransactionId,
      offer_id: attr.offerId,
    },
  });

  await notifyReferrerOfCommission(
    supabaseAdmin,
    attr.userId,
    split.userReward,
    `${adapter.displayName} offer`
  );

  return { status: 200, body: "1" };
}
