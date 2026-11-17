// supabase/functions/_shared/providers/adgem.ts
import { hmacSha256Hex, sha256Hex } from "../crypto.ts";
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

export class AdGemAdapter implements OfferProviderAdapter {
  readonly providerKey = "adgem";
  readonly displayName = "AdGem";
  readonly allowedRedirectDomains = ["api.adgem.com", "adgem.com", "wall.adgem.com"];

  private getSecrets() {
    return {
      appId: (Deno.env.get("ADGEM_APP_ID") || "").trim(),
      apiKey: (Deno.env.get("ADGEM_API_KEY") || "").trim(),
      postbackSecret: (Deno.env.get("ADGEM_POSTBACK_SECRET") || "").trim(),
    };
  }

  async fetchOffers(ctx: ProviderFetchContext): Promise<ProviderFetchResult> {
    const { appId, apiKey } = this.getSecrets();
    if (!appId || !apiKey) {
      return {
        offers: [],
        hasMore: false,
        note: "Awaiting AdGem publisher approval and ADGEM_APP_ID / ADGEM_API_KEY secrets.",
      };
    }

    const url = new URL("https://api.adgem.com/v1/all/campaigns");
    url.searchParams.set("appid", appId);
    url.searchParams.set("token", apiKey);

    const res = await fetchWithTimeoutRetry(url.toString(), { method: "GET" }, ctx.timeoutMs || 10000);
    if (res.status === 429) {
      return { offers: [], hasMore: false, rateLimited: true, note: "AdGem API rate limit reached" };
    }
    if (!res.ok) {
      throw new Error(`AdGem API HTTP ${res.status}`);
    }

    const json = await res.json().catch(() => null);
    const dataObj = json?.data && typeof json.data === "object" ? json.data : {};
    const list: Record<string, unknown>[] = Array.isArray(json?.data)
      ? json.data
      : Object.values(dataObj).filter((v): v is Record<string, unknown> => Boolean(v && typeof v === "object"));

    return { offers: list, hasMore: false };
  }

  normalizeOffer(raw: Record<string, unknown>, calc: RewardCalculator): NormalizedOffer | null {
    const camp: any = raw.Offer || raw;
    const extId = String(camp.campaign_id || camp.id || "").trim();
    const title = String(camp.name || camp.title || "").trim();
    if (!extId || !title) return null;

    const split = calc(camp.payout_usd ?? camp.payout ?? camp.amount, {
      currency: "USD",
      providerKey: this.providerKey,
    });
    if (!split) return null;

    const destUrl = sanitizeDestinationUrl(camp.url || camp.tracking_url, this.allowedRedirectDomains);
    if (!destUrl) return null;

    const desc = String(camp.description || "").trim();
    const instructions = String(camp.instructions || desc).trim();

    return {
      external_offer_id: extId,
      title: title.slice(0, 140),
      description: desc.slice(0, 1000),
      instructions: instructions.slice(0, 1000),
      steps: [],
      category: inferOfferCategory(camp.categories || camp.category_1, title, desc),
      image_url: sanitizeDestinationUrl(camp.icon || camp.image_url, []) || null,
      thumbnail_url: sanitizeDestinationUrl(camp.icon || camp.image_url, []) || null,
      provider_reward: split.providerReward,
      user_reward: split.userReward,
      commission_percent: split.commissionPercent,
      currency: split.currency,
      is_estimated_reward: Boolean(camp.multi_reward),
      estimated_time: null,
      countries: normalizeCountryList((raw.Country as Record<string, unknown> | undefined)?.include || camp.countries),
      excluded_countries: normalizeCountryList((raw.Country as Record<string, unknown> | undefined)?.exclude),
      device_types: normalizeDeviceList(raw.OS || camp.os),
      new_user_only: true,
      tracking_type: "s2s",
      destination_url: destUrl,
      is_featured: split.userReward >= 5.0,
      is_active: true,
      starts_at: null,
      expires_at: null,
    };
  }

  validateClick(offer: StoredOffer, _user: ClickUserContext, opaqueClickId: string): ClickBuildResult {
    const safeUrl = sanitizeDestinationUrl(offer.destination_url, this.allowedRedirectDomains);
    if (!safeUrl) {
      return { valid: false, reason: "Invalid AdGem destination domain" };
    }
    const parsed = new URL(safeUrl);
    parsed.searchParams.set("playerid", opaqueClickId);
    return { valid: true, trackingUrl: parsed.toString() };
  }

  async verifyPostback(ctx: PostbackRequestContext): Promise<PostbackVerificationResult> {
    const { postbackSecret } = this.getSecrets();
    if (!postbackSecret) {
      return { configured: false, valid: false, method: "adgem_verifier", reason: "ADGEM_POSTBACK_SECRET missing" };
    }

    const verifier = ctx.params.verifier || ctx.headers.get("X-AdGem-Verifier") || "";
    const playerId = ctx.params.player_id || ctx.params.playerid || "";
    const amount = ctx.params.amount || ctx.params.payout || "";
    const txId = ctx.params.transaction_id || ctx.params.tracking_id || "";

    if (!verifier || !txId) {
      return { configured: true, valid: false, method: "adgem_verifier", reason: "Missing AdGem verifier or transaction_id" };
    }

    const fullHashInput = ctx.url.pathname + "?" + ctx.url.searchParams.toString().replace(/&?verifier=[^&]*/gi, "");
    const expectedUrlHmac = await hmacSha256Hex(postbackSecret, fullHashInput);
    const expectedTupleHmac = await hmacSha256Hex(postbackSecret, `${txId}:${playerId}:${amount}`);
    const expectedSha = await sha256Hex(`${txId}:${playerId}:${amount}:${postbackSecret}`);
    const lower = verifier.toLowerCase();

    const matched =
      constantTimeCompare(lower, expectedUrlHmac.toLowerCase()) ||
      constantTimeCompare(lower, expectedTupleHmac.toLowerCase()) ||
      constantTimeCompare(lower, expectedSha.toLowerCase());

    return {
      configured: true,
      valid: matched,
      method: "adgem_verifier",
      reason: matched ? undefined : "AdGem verifier mismatch",
    };
  }

  parseConversion(ctx: PostbackRequestContext): ParsedConversionEvent | null {
    const event = String(ctx.params.event || ctx.params.status || "conversion").toLowerCase();
    const rawAmount = parseFloat(ctx.params.payout || ctx.params.amount || "0");
    if (event === "chargeback" || event === "reversal" || rawAmount < 0) return null;

    const txId = (ctx.params.transaction_id || ctx.params.tracking_id || "").trim();
    const rawRef = (ctx.params.player_id || ctx.params.playerid || "").trim();
    if (!txId || !rawRef || !Number.isFinite(rawAmount) || rawAmount <= 0) return null;

    return {
      externalTransactionId: txId,
      rawUserOrClickRef: rawRef,
      opaqueClickId: rawRef.startsWith("pv_") ? rawRef : undefined,
      externalOfferId: ctx.params.campaign_id || undefined,
      providerReward: rawAmount,
      currency: "USD",
      isPending: false,
      timestampValid: true,
    };
  }

  parseReversal(ctx: PostbackRequestContext): ParsedReversalEvent | null {
    const event = String(ctx.params.event || ctx.params.status || "").toLowerCase();
    const rawAmount = parseFloat(ctx.params.payout || ctx.params.amount || "0");
    if (event !== "chargeback" && event !== "reversal" && rawAmount >= 0) return null;

    const txId = (ctx.params.transaction_id || ctx.params.tracking_id || "").trim();
    const rawRef = (ctx.params.player_id || ctx.params.playerid || "").trim();
    if (!txId || !rawRef) return null;

    return {
      externalTransactionId: txId,
      rawUserOrClickRef: rawRef,
      opaqueClickId: rawRef.startsWith("pv_") ? rawRef : undefined,
      reversalAmount: Math.abs(Number.isFinite(rawAmount) ? rawAmount : 0),
      currency: "USD",
      isPartial: false,
      reason: "AdGem chargeback",
    };
  }

  getProviderStatus(): ProviderAdapterStatus {
    const s = this.getSecrets();
    const missing: string[] = [];
    if (!s.appId) missing.push("ADGEM_APP_ID");
    if (!s.apiKey) missing.push("ADGEM_API_KEY");
    if (!s.postbackSecret) missing.push("ADGEM_POSTBACK_SECRET");
    return {
      providerKey: this.providerKey,
      displayName: this.displayName,
      configuredForApi: Boolean(s.appId && s.apiKey),
      configuredForPostback: Boolean(s.postbackSecret),
      supportsCustomListing: Boolean(s.appId && s.apiKey),
      supportsHostedWall: Boolean(s.appId),
      supportsReversal: true,
      missingSecrets: missing,
      note: "Requires AdGem publisher approval",
    };
  }
}
