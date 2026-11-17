// supabase/functions/_shared/providers/lootably.ts
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
  normalizeCountryList,
  normalizeDeviceList,
  inferOfferCategory,
} from "./types.ts";

export class LootablyAdapter implements OfferProviderAdapter {
  readonly providerKey = "lootably";
  readonly displayName = "Lootably";
  readonly allowedRedirectDomains = ["wall.lootably.com", "lootably.com", "trk.lootably.com"];

  private getSecrets() {
    return {
      apiKey: (Deno.env.get("LOOTABLY_API_KEY") || "").trim(),
      placementId: (Deno.env.get("LOOTABLY_PLACEMENT_ID") || "").trim(),
      secret: (Deno.env.get("LOOTABLY_SECRET") || "").trim(),
    };
  }

  async fetchOffers(ctx: ProviderFetchContext): Promise<ProviderFetchResult> {
    const { apiKey, placementId } = this.getSecrets();
    if (!apiKey || !placementId) {
      return {
        offers: [],
        hasMore: false,
        note: "Awaiting LOOTABLY_API_KEY and LOOTABLY_PLACEMENT_ID credentials.",
      };
    }

    const res = await fetchWithTimeoutRetry(
      "https://api.lootably.com/api/v2/offers/get",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          placementID: placementId,
          countries: ctx.country ? [ctx.country.toUpperCase()] : undefined,
        }),
      },
      ctx.timeoutMs || 10000
    );

    if (res.status === 429) {
      return { offers: [], hasMore: false, rateLimited: true, note: "Lootably API rate limit reached" };
    }
    if (!res.ok) {
      throw new Error(`Lootably API HTTP ${res.status}`);
    }

    const data = await res.json().catch(() => null);
    const list: Record<string, unknown>[] = Array.isArray(data?.data?.offers)
      ? data.data.offers
      : Array.isArray(data?.offers)
      ? data.offers
      : [];

    return {
      offers: list,
      hasMore: false,
    };
  }

  normalizeOffer(raw: Record<string, unknown>, calc: RewardCalculator): NormalizedOffer | null {
    const extId = String(raw.offerID || raw.id || "").trim();
    const title = String(raw.name || raw.title || "").trim();
    if (!extId || !title) return null;

    const rawPayout = raw.revenue ?? raw.currencyReward ?? raw.payout;
    const split = calc(rawPayout, {
      currency: String(raw.currency || "USD"),
      providerKey: this.providerKey,
    });
    if (!split) return null;

    const destUrl = sanitizeDestinationUrl(raw.link || raw.url, this.allowedRedirectDomains);
    if (!destUrl) return null;

    const desc = String(raw.description || "").trim();
    const reqs = String(raw.requirements || raw.instructions || desc).trim();
    const rawGoals = Array.isArray(raw.goals) ? raw.goals : [];
    const steps = rawGoals
      .map((g: any, idx: number) => ({
        label: String(g?.description || g?.name || `Milestone ${idx + 1}`).trim(),
        payoutUsd: Number(g?.revenue || g?.payout || 0) || undefined,
        order: idx + 1,
      }))
      .slice(0, 10);

    return {
      external_offer_id: extId,
      title: title.slice(0, 140),
      description: desc.slice(0, 1000),
      instructions: reqs.slice(0, 1000),
      steps,
      category: inferOfferCategory(raw.categories || raw.type, title, desc),
      image_url: sanitizeDestinationUrl(raw.image || raw.icon, []) || null,
      thumbnail_url: sanitizeDestinationUrl(raw.image || raw.icon, []) || null,
      provider_reward: split.providerReward,
      user_reward: split.userReward,
      commission_percent: split.commissionPercent,
      currency: split.currency,
      is_estimated_reward: rawGoals.length > 1,
      estimated_time: null,
      countries: normalizeCountryList(raw.countries),
      excluded_countries: normalizeCountryList(raw.excludedCountries),
      device_types: normalizeDeviceList(raw.devices),
      new_user_only: true,
      tracking_type: "s2s",
      destination_url: destUrl,
      is_featured: split.userReward >= 3.0,
      is_active: true,
      starts_at: null,
      expires_at: typeof raw.expiresAt === "string" ? raw.expiresAt : null,
    };
  }

  validateClick(offer: StoredOffer, _user: ClickUserContext, opaqueClickId: string): ClickBuildResult {
    const safeUrl = sanitizeDestinationUrl(offer.destination_url, this.allowedRedirectDomains);
    if (!safeUrl) {
      return { valid: false, reason: "Invalid Lootably destination domain" };
    }
    let out = safeUrl;
    if (out.includes("{userID}") || out.includes("{SID}")) {
      out = out.replace(/\{userID\}|\{SID\}/g, encodeURIComponent(opaqueClickId));
    } else {
      const parsed = new URL(out);
      parsed.searchParams.set("sid", opaqueClickId);
      out = parsed.toString();
    }
    return { valid: true, trackingUrl: out };
  }

  async verifyPostback(ctx: PostbackRequestContext): Promise<PostbackVerificationResult> {
    const { secret } = this.getSecrets();
    if (!secret) return { configured: false, valid: false, method: "sha256_or_md5_hash", reason: "LOOTABLY_SECRET missing" };

    const userId = ctx.params.userID || "";
    const ip = ctx.params.ip || "";
    const reward = ctx.params.reward || ctx.params.revenue || "";
    const hash = ctx.params.hash || "";

    if (!hash || !userId) {
      return { configured: true, valid: false, method: "sha256_or_md5_hash", reason: "Missing hash or userID" };
    }

    const rawRewardStr = ctx.params.reward || "";
    const rawRevStr = ctx.params.revenue || "";
    const candidates = [
      `${userId}${ip}${rawRewardStr}${secret}`,
      `${userId}${ip}${rawRevStr}${rawRewardStr}${secret}`,
    ];

    const providedLower = hash.toLowerCase();
    for (const c of candidates) {
      const expectedSha = await sha256Hex(c);
      const expectedMd5 = md5Hex(c);
      if (
        constantTimeCompare(providedLower, expectedSha.toLowerCase()) ||
        constantTimeCompare(providedLower, expectedMd5.toLowerCase())
      ) {
        return { configured: true, valid: true, method: "sha256_or_md5_hash" };
      }
    }

    return { configured: true, valid: false, method: "sha256_or_md5_hash", reason: "Lootably hash mismatch" };
  }

  parseConversion(ctx: PostbackRequestContext): ParsedConversionEvent | null {
    const status = String(ctx.params.status || "1");
    const rawAmount = parseFloat(ctx.params.revenue || ctx.params.reward || "0");
    if (status === "0" || status === "2" || rawAmount < 0) return null;

    const txId = (ctx.params.transactionId || "").trim();
    const rawRef = (ctx.params.userID || "").trim();
    if (!txId || !rawRef || !Number.isFinite(rawAmount) || rawAmount <= 0) return null;

    return {
      externalTransactionId: txId,
      rawUserOrClickRef: rawRef,
      opaqueClickId: ctx.params.sid || (rawRef.startsWith("pv_") ? rawRef : undefined),
      externalOfferId: ctx.params.offerID || undefined,
      providerReward: rawAmount,
      currency: (ctx.params.currency || "USD").toUpperCase(),
      isPending: false,
      timestampValid: true,
    };
  }

  parseReversal(ctx: PostbackRequestContext): ParsedReversalEvent | null {
    const status = String(ctx.params.status || "1");
    const rawAmount = parseFloat(ctx.params.revenue || ctx.params.reward || "0");
    if (status !== "0" && status !== "2" && rawAmount >= 0) return null;

    const txId = (ctx.params.transactionId || "").trim();
    const rawRef = (ctx.params.userID || "").trim();
    if (!txId || !rawRef) return null;

    return {
      externalTransactionId: txId,
      rawUserOrClickRef: rawRef,
      opaqueClickId: ctx.params.sid || (rawRef.startsWith("pv_") ? rawRef : undefined),
      reversalAmount: Math.abs(Number.isFinite(rawAmount) ? rawAmount : 0),
      currency: (ctx.params.currency || "USD").toUpperCase(),
      isPartial: false,
      reason: "Lootably conversion reversed",
    };
  }

  getProviderStatus(): ProviderAdapterStatus {
    const s = this.getSecrets();
    const missing: string[] = [];
    if (!s.apiKey) missing.push("LOOTABLY_API_KEY");
    if (!s.placementId) missing.push("LOOTABLY_PLACEMENT_ID");
    if (!s.secret) missing.push("LOOTABLY_SECRET");
    return {
      providerKey: this.providerKey,
      displayName: this.displayName,
      configuredForApi: Boolean(s.apiKey && s.placementId),
      configuredForPostback: Boolean(s.secret),
      supportsCustomListing: Boolean(s.apiKey && s.placementId),
      supportsHostedWall: true,
      supportsReversal: true,
      missingSecrets: missing,
    };
  }
}
