// supabase/functions/_shared/providers/ayet.ts
import { hmacSha256Hex } from "../crypto.ts";
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

export class AyetAdapter implements OfferProviderAdapter {
  readonly providerKey = "ayet";
  readonly displayName = "ayeT-Studios";
  readonly allowedRedirectDomains = ["www.ayetstudios.com", "ayetstudios.com", "ayet.io"];

  private getSecrets() {
    return {
      apiKey: (Deno.env.get("AYET_API_KEY") || "").trim(),
      adslotId: (Deno.env.get("AYET_ADSLOT_ID") || "").trim(),
      secret: (Deno.env.get("AYET_SECRET") || "").trim(),
    };
  }

  async fetchOffers(ctx: ProviderFetchContext): Promise<ProviderFetchResult> {
    const { apiKey, adslotId } = this.getSecrets();
    if (!apiKey || !adslotId) {
      return {
        offers: [],
        hasMore: false,
        note: "Awaiting AYET_API_KEY and AYET_ADSLOT_ID credentials.",
      };
    }

    const url = new URL(`https://www.ayetstudios.com/offers/offerwall_api/${encodeURIComponent(adslotId)}`);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("external_identifier", ctx.userId || "payvora_catalog");
    if (ctx.country) url.searchParams.set("country", ctx.country.toUpperCase());

    const res = await fetchWithTimeoutRetry(url.toString(), { method: "GET" }, ctx.timeoutMs || 10000);
    if (res.status === 429) {
      return { offers: [], hasMore: false, rateLimited: true, note: "ayeT-Studios API rate limit reached" };
    }
    if (!res.ok) {
      throw new Error(`ayeT-Studios API HTTP ${res.status}`);
    }

    const data = await res.json().catch(() => null);
    const list: Record<string, unknown>[] = Array.isArray(data?.offers)
      ? data.offers
      : Array.isArray(data?.data)
      ? data.data
      : [];

    return { offers: list, hasMore: false };
  }

  normalizeOffer(raw: Record<string, unknown>, calc: RewardCalculator): NormalizedOffer | null {
    const extId = String(raw.id || raw.offer_id || "").trim();
    const title = String(raw.name || raw.title || "").trim();
    if (!extId || !title) return null;

    const split = calc(raw.payout_usd ?? raw.payout ?? raw.amount, {
      currency: "USD",
      providerKey: this.providerKey,
    });
    if (!split) return null;

    const destUrl = sanitizeDestinationUrl(raw.tracking_link || raw.click_url || raw.url, this.allowedRedirectDomains);
    if (!destUrl) return null;

    const desc = String(raw.description || raw.introduction || "").trim();
    const instructions = String(raw.conversion_instructions_short || raw.instructions || desc).trim();

    return {
      external_offer_id: extId,
      title: title.slice(0, 140),
      description: desc.slice(0, 1000),
      instructions: instructions.slice(0, 1000),
      steps: [],
      category: inferOfferCategory(raw.category || raw.categories, title, desc),
      image_url: sanitizeDestinationUrl(raw.icon || raw.image_url, []) || null,
      thumbnail_url: sanitizeDestinationUrl(raw.icon || raw.image_url, []) || null,
      provider_reward: split.providerReward,
      user_reward: split.userReward,
      commission_percent: split.commissionPercent,
      currency: split.currency,
      is_estimated_reward: false,
      estimated_time: null,
      countries: normalizeCountryList(raw.countries),
      excluded_countries: [],
      device_types: normalizeDeviceList(raw.platform || raw.os),
      new_user_only: true,
      tracking_type: "s2s",
      destination_url: destUrl,
      is_featured: split.userReward >= 5.0,
      is_active: true,
      starts_at: null,
      expires_at: typeof raw.expires_at === "string" ? raw.expires_at : null,
    };
  }

  validateClick(offer: StoredOffer, _user: ClickUserContext, opaqueClickId: string): ClickBuildResult {
    const safeUrl = sanitizeDestinationUrl(offer.destination_url, this.allowedRedirectDomains);
    if (!safeUrl) {
      return { valid: false, reason: "Invalid ayeT destination domain" };
    }
    const parsed = new URL(safeUrl);
    parsed.searchParams.set("external_identifier", opaqueClickId);
    return { valid: true, trackingUrl: parsed.toString() };
  }

  async verifyPostback(ctx: PostbackRequestContext): Promise<PostbackVerificationResult> {
    const { secret } = this.getSecrets();
    if (!secret) return { configured: false, valid: false, method: "hmac_sha256_header", reason: "AYET_SECRET missing" };

    const ayetSig =
      ctx.headers.get("X-Ayetstudios-Security-Hash") ||
      ctx.headers.get("x-ayetstudios-security-hash") ||
      ctx.params.security_hash ||
      "";

    if (!ayetSig) {
      return { configured: true, valid: false, method: "hmac_sha256_header", reason: "Missing X-Ayetstudios-Security-Hash" };
    }

    const sortedQuery = Object.keys(ctx.params)
      .filter((k) => k !== "provider" && k !== "security_hash")
      .sort()
      .map((k) => `${k}=${ctx.params[k]}`)
      .join("&");

    const expectedHmac = await hmacSha256Hex(secret, sortedQuery);
    const matched = constantTimeCompare(ayetSig.toLowerCase(), expectedHmac.toLowerCase());
    return {
      configured: true,
      valid: matched,
      method: "hmac_sha256_header",
      reason: matched ? undefined : "HMAC-SHA256 signature mismatch",
    };
  }

  parseConversion(ctx: PostbackRequestContext): ParsedConversionEvent | null {
    const isRev = ctx.params.is_chargeback === "1" || ctx.params.status === "2";
    const rawAmount = parseFloat(ctx.params.payout_usd || ctx.params.currency_amount || "0");
    if (isRev || rawAmount < 0) return null;

    const txId = (ctx.params.transaction_id || "").trim();
    const rawRef = (ctx.params.uid || ctx.params.external_identifier || "").replace(/[\[\]{}"]/g, "").trim();
    if (!txId || !rawRef || !Number.isFinite(rawAmount) || rawAmount <= 0) return null;

    return {
      externalTransactionId: txId,
      rawUserOrClickRef: rawRef,
      opaqueClickId: rawRef.startsWith("pv_") ? rawRef : undefined,
      externalOfferId: ctx.params.offer_id || undefined,
      providerReward: rawAmount,
      currency: "USD",
      isPending: false,
      timestampValid: true,
    };
  }

  parseReversal(ctx: PostbackRequestContext): ParsedReversalEvent | null {
    const isRev = ctx.params.is_chargeback === "1" || ctx.params.status === "2";
    const rawAmount = parseFloat(ctx.params.payout_usd || ctx.params.currency_amount || "0");
    if (!isRev && rawAmount >= 0) return null;

    const txId = (ctx.params.transaction_id || "").trim();
    const rawRef = (ctx.params.uid || ctx.params.external_identifier || "").replace(/[\[\]{}"]/g, "").trim();
    if (!txId || !rawRef) return null;

    return {
      externalTransactionId: txId,
      rawUserOrClickRef: rawRef,
      opaqueClickId: rawRef.startsWith("pv_") ? rawRef : undefined,
      reversalAmount: Math.abs(Number.isFinite(rawAmount) ? rawAmount : 0),
      currency: "USD",
      isPartial: false,
      reason: "ayeT-Studios chargeback reported",
    };
  }

  getProviderStatus(): ProviderAdapterStatus {
    const s = this.getSecrets();
    const missing: string[] = [];
    if (!s.apiKey) missing.push("AYET_API_KEY");
    if (!s.adslotId) missing.push("AYET_ADSLOT_ID");
    if (!s.secret) missing.push("AYET_SECRET");
    return {
      providerKey: this.providerKey,
      displayName: this.displayName,
      configuredForApi: Boolean(s.apiKey && s.adslotId),
      configuredForPostback: Boolean(s.secret),
      supportsCustomListing: Boolean(s.apiKey && s.adslotId),
      supportsHostedWall: true,
      supportsReversal: true,
      missingSecrets: missing,
    };
  }
}
