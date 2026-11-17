// supabase/functions/_shared/providers/adscend.ts
import { hmacSha1Hex, hmacSha256Hex, md5Hex, sha256Hex } from "../crypto.ts";
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
  normalizeCountryList,
  normalizeDeviceList,
  inferOfferCategory,
} from "./types.ts";

export class AdscendAdapter implements OfferProviderAdapter {
  readonly providerKey = "adscend";
  readonly displayName = "Adscend Media";
  readonly allowedRedirectDomains = [
    "asmwall.com",
    "adscendmedia.com",
    "trk.adscendmedia.com",
    "adscend.com",
  ];

  private getSecrets() {
    return {
      publisherId: (Deno.env.get("ADSCEND_PUBLISHER_ID") || "").trim(),
      profileId: (Deno.env.get("ADSCEND_PROFILE_ID") || "").trim(),
      apiKey: (Deno.env.get("ADSCEND_API_KEY") || "").trim(),
      postbackSecret: (Deno.env.get("ADSCEND_POSTBACK_SECRET") || "").trim(),
    };
  }

  async fetchOffers(ctx: ProviderFetchContext): Promise<ProviderFetchResult> {
    const { publisherId, profileId, apiKey } = this.getSecrets();
    if (!publisherId || !profileId || !apiKey) {
      return {
        offers: [],
        hasMore: false,
        note: "Awaiting ADSCEND_PUBLISHER_ID, ADSCEND_PROFILE_ID, and ADSCEND_API_KEY credentials.",
      };
    }

    const page = Math.max(1, ctx.page || 1);
    const limit = Math.min(100, Math.max(10, ctx.limit || 50));
    const url = new URL(
      `https://api.adscendmedia.com/v1/publisher/${encodeURIComponent(publisherId)}/profile/${encodeURIComponent(profileId)}/offers.json`
    );
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(limit));
    if (ctx.country) url.searchParams.set("country", ctx.country.toUpperCase());

    const authHeader = `Basic ${btoa(`${publisherId}:${apiKey}`)}`;
    const res = await fetchWithTimeoutRetry(
      url.toString(),
      {
        method: "GET",
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
      },
      ctx.timeoutMs || 10000
    );

    if (res.status === 429) {
      return {
        offers: [],
        hasMore: false,
        rateLimited: true,
        note: "Adscend Media API rate limit reached",
      };
    }
    if (!res.ok) {
      throw new Error(`Adscend Media API HTTP ${res.status}`);
    }

    const data = await res.json().catch(() => null);
    const list: Record<string, unknown>[] = Array.isArray(data?.offers)
      ? data.offers
      : Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data)
      ? data
      : [];

    const hasMore = Boolean(data?.has_more) || list.length >= limit;
    return { offers: list, hasMore, nextPage: hasMore ? page + 1 : undefined };
  }

  normalizeOffer(raw: Record<string, unknown>, calc: RewardCalculator): NormalizedOffer | null {
    const extId = String(raw.offer_id || raw.id || "").trim();
    const title = String(raw.name || raw.title || "").trim();
    if (!extId || !title) return null;

    const split = calc(raw.payout ?? raw.currency_count ?? raw.amount, {
      currency: String(raw.currency || "USD"),
      providerKey: this.providerKey,
    });
    if (!split) return null;

    const destUrl = sanitizeDestinationUrl(
      raw.click_url || raw.tracking_url || raw.url,
      this.allowedRedirectDomains
    );
    if (!destUrl) return null;

    const desc = String(raw.description || "").trim();
    const instructions = String(raw.requirements || raw.conversion_instructions || desc).trim();

    return {
      external_offer_id: extId,
      title: title.slice(0, 140),
      description: desc.slice(0, 1000),
      instructions: instructions.slice(0, 1000),
      steps: [],
      category: inferOfferCategory(raw.category || raw.categories, title, desc),
      image_url: sanitizeDestinationUrl(raw.image_url || raw.creative_url, []) || null,
      thumbnail_url: sanitizeDestinationUrl(raw.thumbnail_url || raw.image_url, []) || null,
      provider_reward: split.providerReward,
      user_reward: split.userReward,
      commission_percent: split.commissionPercent,
      currency: split.currency,
      is_estimated_reward: false,
      estimated_time: null,
      countries: normalizeCountryList(raw.countries),
      excluded_countries: normalizeCountryList(raw.excluded_countries),
      device_types: normalizeDeviceList(raw.device || raw.os || raw.platform),
      new_user_only: true,
      tracking_type: "s2s",
      destination_url: destUrl,
      is_featured: split.userReward >= 2.5,
      is_active: true,
      starts_at: null,
      expires_at: typeof raw.expires_at === "string" ? raw.expires_at : null,
    };
  }

  validateClick(
    offer: StoredOffer,
    _user: ClickUserContext,
    opaqueClickId: string
  ): ClickBuildResult {
    const safeUrl = sanitizeDestinationUrl(offer.destination_url, this.allowedRedirectDomains);
    if (!safeUrl) {
      return { valid: false, reason: "Invalid Adscend destination domain" };
    }
    const parsed = new URL(safeUrl);
    parsed.searchParams.set("subid1", opaqueClickId);
    return { valid: true, trackingUrl: parsed.toString() };
  }

  async verifyPostback(ctx: PostbackRequestContext): Promise<PostbackVerificationResult> {
    const { postbackSecret } = this.getSecrets();
    if (!postbackSecret) {
      return {
        configured: false,
        valid: false,
        method: "hmac_or_hash",
        reason: "ADSCEND_POSTBACK_SECRET missing",
      };
    }

    const txId = (ctx.params.tx_id || ctx.params.conversion_id || ctx.params.tid || "").trim();
    const sub1 = (ctx.params.subid1 || ctx.params.sub1 || ctx.params.s1 || "").trim();
    const providedSig = (
      ctx.headers.get("X-Adscend-Signature") ||
      ctx.headers.get("x-adscend-signature") ||
      ctx.params.sig ||
      ctx.params.hash ||
      ""
    ).trim();

    if (!providedSig || !txId) {
      return {
        configured: true,
        valid: false,
        method: "hmac_or_hash",
        reason: "Missing required Adscend postback cryptographic signature or transaction ID",
      };
    }

    const sortedQuery = Object.keys(ctx.params)
      .filter((k) => k !== "provider" && k !== "sig" && k !== "hash" && k !== "secret")
      .sort()
      .map((k) => `${k}=${ctx.params[k]}`)
      .join("&");

    const [expectedHmac1, expectedHmac256, expectedSha256] = await Promise.all([
      hmacSha1Hex(postbackSecret, sortedQuery),
      hmacSha256Hex(postbackSecret, sortedQuery),
      sha256Hex(`${txId}:${sub1}:${postbackSecret}`),
    ]);
    const expectedMd5 = md5Hex(`${txId}:${sub1}:${postbackSecret}`);
    const providedLower = providedSig.toLowerCase();

    const matched =
      constantTimeCompare(providedLower, expectedHmac1.toLowerCase()) ||
      constantTimeCompare(providedLower, expectedHmac256.toLowerCase()) ||
      constantTimeCompare(providedLower, expectedSha256.toLowerCase()) ||
      constantTimeCompare(providedLower, expectedMd5.toLowerCase());

    return {
      configured: true,
      valid: matched,
      method: "hmac_or_hash",
      reason: matched ? undefined : "Adscend Media signature mismatch",
    };
  }

  parseConversion(ctx: PostbackRequestContext): ParsedConversionEvent | null {
    const status = String(ctx.params.sts || ctx.params.status || "1").trim();
    const rawAmount = parseFloat(ctx.params.rate || ctx.params.payout || ctx.params.amount || "0");
    if (status === "2" || status === "0" || rawAmount < 0) return null;

    const txId = (ctx.params.tx_id || ctx.params.conversion_id || ctx.params.tid || "").trim();
    const rawRef = (ctx.params.subid1 || ctx.params.sub1 || ctx.params.s1 || "").trim();
    if (!txId || !rawRef || !Number.isFinite(rawAmount) || rawAmount <= 0) return null;

    return {
      externalTransactionId: txId,
      rawUserOrClickRef: rawRef,
      opaqueClickId: rawRef.startsWith("pv_") ? rawRef : undefined,
      externalOfferId: ctx.params.campid || ctx.params.offer_id || undefined,
      providerReward: rawAmount,
      currency: String(ctx.params.currency || "USD").toUpperCase(),
      isPending: false,
      timestampValid: true,
    };
  }

  parseReversal(ctx: PostbackRequestContext): ParsedReversalEvent | null {
    const status = String(ctx.params.sts || ctx.params.status || "1").trim();
    const rawAmount = parseFloat(ctx.params.rate || ctx.params.payout || ctx.params.amount || "0");
    if (status !== "2" && status !== "0" && rawAmount >= 0) return null;

    const txId = (ctx.params.tx_id || ctx.params.conversion_id || ctx.params.tid || "").trim();
    const rawRef = (ctx.params.subid1 || ctx.params.sub1 || ctx.params.s1 || "").trim();
    if (!txId || !rawRef) return null;

    return {
      externalTransactionId: txId,
      rawUserOrClickRef: rawRef,
      opaqueClickId: rawRef.startsWith("pv_") ? rawRef : undefined,
      reversalAmount: Math.abs(Number.isFinite(rawAmount) ? rawAmount : 0),
      currency: String(ctx.params.currency || "USD").toUpperCase(),
      isPartial: false,
      reason: "Adscend Media conversion revoked (sts=2)",
    };
  }

  getProviderStatus(): ProviderAdapterStatus {
    const s = this.getSecrets();
    const missing: string[] = [];
    if (!s.publisherId) missing.push("ADSCEND_PUBLISHER_ID");
    if (!s.profileId) missing.push("ADSCEND_PROFILE_ID");
    if (!s.apiKey) missing.push("ADSCEND_API_KEY");
    if (!s.postbackSecret) missing.push("ADSCEND_POSTBACK_SECRET");

    return {
      providerKey: this.providerKey,
      displayName: this.displayName,
      configuredForApi: Boolean(s.publisherId && s.profileId && s.apiKey),
      configuredForPostback: Boolean(s.postbackSecret),
      supportsCustomListing: Boolean(s.publisherId && s.profileId && s.apiKey),
      supportsHostedWall: Boolean(s.publisherId && s.profileId),
      supportsReversal: true,
      missingSecrets: missing,
    };
  }
}
