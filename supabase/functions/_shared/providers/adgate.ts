// supabase/functions/_shared/providers/adgate.ts
import { hmacSha256Hex, md5Hex, sha256Hex } from "../crypto.ts";
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

export class AdGateAdapter implements OfferProviderAdapter {
  readonly providerKey = "adgate";
  readonly displayName = "AdGate Media";
  readonly allowedRedirectDomains = ["wall.adgaterewards.com", "adgaterewards.com", "adgatemedia.com"];

  private getSecrets() {
    return {
      apiKey: (Deno.env.get("ADGATE_API_KEY") || "").trim(),
      affiliateId: (Deno.env.get("ADGATE_AFFILIATE_ID") || "").trim(),
      wallCode: (Deno.env.get("ADGATE_WALL_CODE") || "").trim(),
      secret: (Deno.env.get("ADGATE_SECRET") || "").trim(),
    };
  }

  async fetchOffers(ctx: ProviderFetchContext): Promise<ProviderFetchResult> {
    const { apiKey, affiliateId, wallCode } = this.getSecrets();
    if (!apiKey || !affiliateId || !wallCode) {
      return {
        offers: [],
        hasMore: false,
        note: "Awaiting ADGATE_API_KEY, ADGATE_AFFILIATE_ID, and ADGATE_WALL_CODE credentials.",
      };
    }

    const url = new URL(`https://api.adgaterewards.com/v1/vc/${encodeURIComponent(affiliateId)}/users/${encodeURIComponent(ctx.userId || "catalog")}/offers`);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("wall_code", wallCode);
    if (ctx.country) url.searchParams.set("country", ctx.country.toUpperCase());

    const res = await fetchWithTimeoutRetry(url.toString(), { method: "GET" }, ctx.timeoutMs || 10000);
    if (res.status === 429) {
      return { offers: [], hasMore: false, rateLimited: true, note: "AdGate Media API rate limit reached" };
    }
    if (!res.ok) {
      throw new Error(`AdGate API HTTP ${res.status}`);
    }

    const data = await res.json().catch(() => null);
    const list: Record<string, unknown>[] = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.offers)
      ? data.offers
      : [];

    return { offers: list, hasMore: false };
  }

  normalizeOffer(raw: Record<string, unknown>, calc: RewardCalculator): NormalizedOffer | null {
    const extId = String(raw.id || raw.offer_id || "").trim();
    const title = String(raw.anchor || raw.name || raw.title || "").trim();
    if (!extId || !title) return null;

    const split = calc(raw.payout ?? raw.points, {
      currency: "USD",
      providerKey: this.providerKey,
    });
    if (!split) return null;

    const destUrl = sanitizeDestinationUrl(raw.click_url || raw.url, this.allowedRedirectDomains);
    if (!destUrl) return null;

    const desc = String(raw.description || "").trim();
    const instructions = String(raw.requirements || desc).trim();

    return {
      external_offer_id: extId,
      title: title.slice(0, 140),
      description: desc.slice(0, 1000),
      instructions: instructions.slice(0, 1000),
      steps: [],
      category: inferOfferCategory(raw.categories || raw.category, title, desc),
      image_url: sanitizeDestinationUrl((raw.creatives as Record<string, unknown> | undefined)?.icon || raw.icon_url, []) || null,
      thumbnail_url: sanitizeDestinationUrl((raw.creatives as Record<string, unknown> | undefined)?.icon || raw.icon_url, []) || null,
      provider_reward: split.providerReward,
      user_reward: split.userReward,
      commission_percent: split.commissionPercent,
      currency: split.currency,
      is_estimated_reward: false,
      estimated_time: null,
      countries: normalizeCountryList(raw.countries),
      excluded_countries: [],
      device_types: normalizeDeviceList(raw.device || raw.os),
      new_user_only: true,
      tracking_type: "s2s",
      destination_url: destUrl,
      is_featured: split.userReward >= 3.0,
      is_active: true,
      starts_at: null,
      expires_at: null,
    };
  }

  validateClick(offer: StoredOffer, _user: ClickUserContext, opaqueClickId: string): ClickBuildResult {
    const safeUrl = sanitizeDestinationUrl(offer.destination_url, this.allowedRedirectDomains);
    if (!safeUrl) {
      return { valid: false, reason: "Invalid AdGate destination domain" };
    }
    const parsed = new URL(safeUrl);
    parsed.searchParams.set("s1", opaqueClickId);
    return { valid: true, trackingUrl: parsed.toString() };
  }

  async verifyPostback(ctx: PostbackRequestContext): Promise<PostbackVerificationResult> {
    const { secret } = this.getSecrets();
    if (!secret) return { configured: false, valid: false, method: "cryptographic_sig", reason: "ADGATE_SECRET missing" };

    const txId = ctx.params.tx_id || "";
    const s1 = ctx.params.s1 || "";
    const providedSig =
      ctx.headers.get("X-AdGate-Signature") ||
      ctx.headers.get("x-adgate-signature") ||
      ctx.params.sig ||
      ctx.params.hash ||
      "";

    if (!providedSig || !txId) {
      return {
        configured: true,
        valid: false,
        method: "cryptographic_sig",
        reason: "Missing cryptographic AdGate signature (raw secret query bypass is disabled)",
      };
    }

    const sorted = Object.keys(ctx.params)
      .filter((k) => k !== "provider" && k !== "sig" && k !== "hash" && k !== "secret")
      .sort()
      .map((k) => `${k}=${ctx.params[k]}`)
      .join("&");

    const expectedHmac = await hmacSha256Hex(secret, sorted);
    const expectedSha = await sha256Hex(`${txId}:${s1}:${secret}`);
    const expectedMd5 = md5Hex(`${txId}:${s1}:${secret}`);
    const providedLower = providedSig.toLowerCase();

    const matched =
      constantTimeCompare(providedLower, expectedHmac.toLowerCase()) ||
      constantTimeCompare(providedLower, expectedSha.toLowerCase()) ||
      constantTimeCompare(providedLower, expectedMd5.toLowerCase());

    return {
      configured: true,
      valid: matched,
      method: "cryptographic_sig",
      reason: matched ? undefined : "AdGate cryptographic signature mismatch",
    };
  }

  parseConversion(ctx: PostbackRequestContext): ParsedConversionEvent | null {
    const status = String(ctx.params.status || "1");
    const rawAmount = parseFloat(ctx.params.payout || ctx.params.points || "0");
    if (status === "0" || status === "2" || rawAmount < 0) return null;

    const txId = (ctx.params.tx_id || "").trim();
    const rawRef = (ctx.params.s1 || "").trim();
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
    const status = String(ctx.params.status || "1");
    const rawAmount = parseFloat(ctx.params.payout || ctx.params.points || "0");
    if (status !== "0" && status !== "2" && rawAmount >= 0) return null;

    const txId = (ctx.params.tx_id || "").trim();
    const rawRef = (ctx.params.s1 || "").trim();
    if (!txId || !rawRef) return null;

    return {
      externalTransactionId: txId,
      rawUserOrClickRef: rawRef,
      opaqueClickId: rawRef.startsWith("pv_") ? rawRef : undefined,
      reversalAmount: Math.abs(Number.isFinite(rawAmount) ? rawAmount : 0),
      currency: "USD",
      isPartial: false,
      reason: "AdGate conversion reversed",
    };
  }

  getProviderStatus(): ProviderAdapterStatus {
    const s = this.getSecrets();
    const missing: string[] = [];
    if (!s.apiKey) missing.push("ADGATE_API_KEY");
    if (!s.affiliateId) missing.push("ADGATE_AFFILIATE_ID");
    if (!s.wallCode) missing.push("ADGATE_WALL_CODE");
    if (!s.secret) missing.push("ADGATE_SECRET");
    return {
      providerKey: this.providerKey,
      displayName: this.displayName,
      configuredForApi: Boolean(s.apiKey && s.affiliateId && s.wallCode),
      configuredForPostback: Boolean(s.secret),
      supportsCustomListing: Boolean(s.apiKey && s.affiliateId && s.wallCode),
      supportsHostedWall: Boolean(s.wallCode),
      supportsReversal: true,
      missingSecrets: missing,
    };
  }
}
