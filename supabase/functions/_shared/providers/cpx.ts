// supabase/functions/_shared/providers/cpx.ts
import { md5Hex, sha256Hex } from "../crypto.ts";
import { constantTimeCompare } from "../telegram-verification.ts";
import {
  type OfferProviderAdapter,
  type ProviderFetchContext,
  type ProviderFetchResult,
  type RewardCalculator,
  type NormalizedOffer,
  type StoredOffer,
  type ClickUserContext,
  type ClickBuildResult,
  type PostbackRequestContext,
  type PostbackVerificationResult,
  type ParsedConversionEvent,
  type ParsedReversalEvent,
  type ProviderAdapterStatus,
  fetchWithTimeoutRetry,
  sanitizeDestinationUrl,
} from "./types.ts";

export class CpxAdapter implements OfferProviderAdapter {
  readonly providerKey = "cpx";
  readonly displayName = "CPX Research";
  readonly allowedRedirectDomains = [
    "offers.cpx-research.com",
    "cpx-research.com",
    "live-api.cpx-research.com",
  ];

  private getSecrets() {
    return {
      appId: (Deno.env.get("CPX_APP_ID") || "").trim(),
      secret: (Deno.env.get("CPX_SECRET") || "").trim(),
    };
  }

  /**
   * CPX Research is user-targeted (surveys depend on ext_user_id, IP, and User-Agent).
   * When invoked without userId (e.g., global catalog cron), we report that CPX is
   * fetched live per-user rather than scraped/stored globally.
   */
  async fetchOffers(ctx: ProviderFetchContext): Promise<ProviderFetchResult> {
    const { appId, secret } = this.getSecrets();
    if (!appId || !secret) {
      return {
        offers: [],
        hasMore: false,
        note: "Awaiting CPX_APP_ID and CPX_SECRET credentials.",
      };
    }

    if (!ctx.userId) {
      return {
        offers: [],
        hasMore: false,
        unsupportedByProvider: true,
        note: "CPX Research provides live user-targeted surveys fetched dynamically per authenticated user session.",
      };
    }

    const secureHash = md5Hex(`${ctx.userId}-${secret}`);
    const url = new URL("https://live-api.cpx-research.com/api/get-surveys.php");
    url.searchParams.set("app_id", appId);
    url.searchParams.set("ext_user_id", ctx.userId);
    url.searchParams.set("output_method", "api");
    url.searchParams.set("secure_hash", secureHash);
    url.searchParams.set("main_info", "true");
    url.searchParams.set("limit", String(Math.min(25, Math.max(1, ctx.limit || 12))));
    if (ctx.userIp) url.searchParams.set("ip_user", ctx.userIp);
    if (ctx.userAgent) url.searchParams.set("user_agent", ctx.userAgent.slice(0, 250));

    const res = await fetchWithTimeoutRetry(url.toString(), { method: "GET" }, ctx.timeoutMs || 8000, 1);
    if (res.status === 429) {
      return { offers: [], hasMore: false, rateLimited: true, note: "CPX Research API rate limit reached" };
    }
    if (!res.ok) {
      throw new Error(`CPX Survey API HTTP ${res.status}`);
    }

    const data = await res.json().catch(() => null);
    const surveys: Record<string, unknown>[] = Array.isArray(data?.surveys)
      ? data.surveys
      : Array.isArray(data?.data)
      ? data.data
      : [];

    return { offers: surveys, hasMore: false };
  }

  normalizeOffer(raw: Record<string, unknown>, calc: RewardCalculator): NormalizedOffer | null {
    const extId = String(raw.id || raw.survey_id || "").trim();
    if (!extId) return null;

    const rawPayout = raw.payout_publisher_usd ?? raw.payout ?? raw.amount;
    const split = calc(rawPayout, {
      currency: "USD",
      providerKey: this.providerKey,
    });
    if (!split) return null;

    const destUrl = sanitizeDestinationUrl(raw.href || raw.url, this.allowedRedirectDomains);
    if (!destUrl) return null;

    const loi = Number(raw.loi);
    const estimatedTime = Number.isFinite(loi) && loi > 0 ? Math.round(loi) : null;
    const rating = Number(raw.statistics_rating_avg);
    const cr = Number(raw.conversion_rate);

    const metaParts: string[] = [];
    if (estimatedTime) metaParts.push(`Estimated ${estimatedTime} min`);
    if (Number.isFinite(rating) && rating > 0) metaParts.push(`Rating ${rating.toFixed(1)}/5`);
    if (Number.isFinite(cr) && cr > 0) metaParts.push(`Completion rate ${Math.round(cr)}%`);

    const title = String(raw.title || `CPX Market Research Survey #${extId}`).trim();
    const desc =
      metaParts.length > 0
        ? `Paid consumer survey (${metaParts.join(" · ")}).`
        : "Complete this verified market research survey to earn an instant wallet credit.";

    return {
      external_offer_id: extId,
      title: title.slice(0, 140),
      description: desc,
      instructions:
        "Answer survey screening and questionnaire prompts honestly. Inconsistent or rushed responses may result in disqualification or reversal.",
      steps: [
        { label: "Open survey & complete eligibility check", order: 1 },
        { label: "Finish full questionnaire cleanly", payoutUsd: split.userReward, order: 2 },
      ],
      category: "surveys",
      image_url: null,
      thumbnail_url: null,
      provider_reward: split.providerReward,
      user_reward: split.userReward,
      commission_percent: split.commissionPercent,
      currency: split.currency,
      is_estimated_reward: false,
      estimated_time: estimatedTime,
      countries: [],
      excluded_countries: [],
      device_types: ["all"],
      new_user_only: false,
      tracking_type: "survey",
      destination_url: destUrl,
      is_featured: split.userReward >= 1.0,
      is_active: true,
      starts_at: null,
      expires_at: null,
    };
  }

  validateClick(
    offer: StoredOffer,
    user: ClickUserContext,
    opaqueClickId: string
  ): ClickBuildResult {
    const safeUrl = sanitizeDestinationUrl(offer.destination_url, this.allowedRedirectDomains);
    if (!safeUrl) {
      return { valid: false, reason: "Invalid CPX destination domain" };
    }
    const parsed = new URL(safeUrl);
    const { secret } = this.getSecrets();
    parsed.searchParams.set("ext_user_id", user.id);
    if (secret) {
      parsed.searchParams.set("secure_hash", md5Hex(`${user.id}-${secret}`));
    }
    parsed.searchParams.set("subid_1", opaqueClickId);
    return { valid: true, trackingUrl: parsed.toString() };
  }

  async verifyPostback(ctx: PostbackRequestContext): Promise<PostbackVerificationResult> {
    const { secret } = this.getSecrets();
    if (!secret) {
      return { configured: false, valid: false, method: "cpx_hash", reason: "CPX_SECRET missing" };
    }

    const transId = (ctx.params.trans_id || "").trim();
    const providedHash = (ctx.params.hash || ctx.params.secure_hash || "").trim();

    if (!transId || !providedHash) {
      return {
        configured: true,
        valid: false,
        method: "cpx_hash",
        reason: "Missing trans_id or CPX verification hash",
      };
    }

    const dataToHash = `${transId}-${secret}`;
    const expectedSha = await sha256Hex(dataToHash);
    const expectedMd5 = md5Hex(dataToHash);
    const providedLower = providedHash.toLowerCase();

    const matched =
      constantTimeCompare(providedLower, expectedSha.toLowerCase()) ||
      constantTimeCompare(providedLower, expectedMd5.toLowerCase());

    return {
      configured: true,
      valid: matched,
      method: "cpx_hash",
      reason: matched ? undefined : "CPX hash signature mismatch",
    };
  }

  parseConversion(ctx: PostbackRequestContext): ParsedConversionEvent | null {
    const status = String(ctx.params.status || "1").trim();
    if (status === "2") return null;

    const transId = (ctx.params.trans_id || "").trim();
    const clickRef = (ctx.params.subid_1 || "").trim();
    const userRef = (ctx.params.ext_user_id || ctx.params.user_id || ctx.params.sub_id || "").trim();
    const rawAmount = parseFloat(ctx.params.amount_local || ctx.params.amount || "0");

    const resolvedRef = clickRef.startsWith("pv_") ? clickRef : userRef;
    if (!transId || !resolvedRef || !Number.isFinite(rawAmount) || rawAmount <= 0) return null;

    return {
      externalTransactionId: transId,
      rawUserOrClickRef: resolvedRef,
      opaqueClickId: clickRef.startsWith("pv_") ? clickRef : undefined,
      externalOfferId: ctx.params.offer_id || undefined,
      providerReward: rawAmount,
      currency: String(ctx.params.currency || "USD").toUpperCase(),
      isPending: status === "0",
      timestampValid: true,
    };
  }

  parseReversal(ctx: PostbackRequestContext): ParsedReversalEvent | null {
    const status = String(ctx.params.status || "1").trim();
    if (status !== "2") return null;

    const transId = (ctx.params.trans_id || "").trim();
    const clickRef = (ctx.params.subid_1 || "").trim();
    const userRef = (ctx.params.ext_user_id || ctx.params.user_id || ctx.params.sub_id || "").trim();
    const rawAmount = parseFloat(ctx.params.amount_local || ctx.params.amount || "0");

    const resolvedRef = clickRef.startsWith("pv_") ? clickRef : userRef;
    if (!transId || !resolvedRef) return null;

    return {
      externalTransactionId: transId,
      rawUserOrClickRef: resolvedRef,
      opaqueClickId: clickRef.startsWith("pv_") ? clickRef : undefined,
      reversalAmount: Math.abs(Number.isFinite(rawAmount) ? rawAmount : 0),
      currency: String(ctx.params.currency || "USD").toUpperCase(),
      isPartial: false,
      reason: "CPX Research survey chargeback (status=2)",
    };
  }

  getProviderStatus(): ProviderAdapterStatus {
    const s = this.getSecrets();
    const missing: string[] = [];
    if (!s.appId) missing.push("CPX_APP_ID");
    if (!s.secret) missing.push("CPX_SECRET");

    return {
      providerKey: this.providerKey,
      displayName: this.displayName,
      configuredForApi: Boolean(s.appId && s.secret),
      configuredForPostback: Boolean(s.secret),
      supportsCustomListing: Boolean(s.appId && s.secret),
      supportsHostedWall: Boolean(s.appId && s.secret),
      supportsReversal: true,
      missingSecrets: missing,
      note: "Supports live per-user survey feed + hosted survey wall.",
    };
  }
}
