// supabase/functions/_shared/providers/torox.ts
import { md5Hex } from "../crypto.ts";
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

export class ToroxAdapter implements OfferProviderAdapter {
  readonly providerKey = "torox";
  readonly displayName = "Torox";
  readonly allowedRedirectDomains = ["torox.io", "torox.com", "ttrk.io"];

  private getSecrets() {
    return {
      pubId: (Deno.env.get("TOROX_PUB_ID") || "").trim(),
      appId: (Deno.env.get("TOROX_APP_ID") || "").trim(),
      apiKey: (Deno.env.get("TOROX_API_KEY") || "").trim(),
      secret: (Deno.env.get("TOROX_SECRET") || "").trim(),
    };
  }

  async fetchOffers(ctx: ProviderFetchContext): Promise<ProviderFetchResult> {
    const { pubId, appId, apiKey } = this.getSecrets();
    if (!pubId || !apiKey) {
      return {
        offers: [],
        hasMore: false,
        note: "Awaiting TOROX_PUB_ID and TOROX_API_KEY publisher credentials.",
      };
    }

    const page = Math.max(1, ctx.page || 1);
    const limit = Math.min(100, Math.max(10, ctx.limit || 50));
    const url = new URL("https://torox.io/api/");
    url.searchParams.set("pubid", pubId);
    if (appId) url.searchParams.set("appid", appId);
    url.searchParams.set("key", apiKey);
    url.searchParams.set("format", "json");
    url.searchParams.set("page", String(page));
    url.searchParams.set("limit", String(limit));
    if (ctx.country) url.searchParams.set("country", ctx.country.toUpperCase());

    const res = await fetchWithTimeoutRetry(url.toString(), { method: "GET" }, ctx.timeoutMs || 10000);
    if (res.status === 429) {
      return { offers: [], hasMore: false, rateLimited: true, note: "Torox API rate limit reached" };
    }
    if (!res.ok) {
      throw new Error(`Torox API HTTP ${res.status}`);
    }

    const data = await res.json().catch(() => null);
    const list: Record<string, unknown>[] = Array.isArray(data?.response?.offers)
      ? data.response.offers
      : Array.isArray(data?.offers)
      ? data.offers
      : [];

    return {
      offers: list,
      hasMore: list.length >= limit,
      nextPage: list.length >= limit ? page + 1 : undefined,
    };
  }

  normalizeOffer(raw: Record<string, unknown>, calc: RewardCalculator): NormalizedOffer | null {
    const extId = String(raw.offer_id || raw.id || "").trim();
    const title = String(raw.offer_name || raw.name || raw.title || "").trim();
    if (!extId || !title) return null;

    const split = calc(raw.payout ?? raw.amount, {
      currency: String(raw.currency || "USD"),
      providerKey: this.providerKey,
    });
    if (!split) return null;

    const destUrl = sanitizeDestinationUrl(
      raw.offer_url_easy || raw.offer_url || raw.click_url || raw.url,
      this.allowedRedirectDomains
    );
    if (!destUrl) return null;

    const desc = String(raw.offer_desc || raw.description || "").trim();
    const instructions = String(raw.call_to_action || raw.instructions || desc).trim();
    const rawEvents = Array.isArray(raw.events) ? raw.events : [];
    const steps = rawEvents
      .map((ev: any, idx: number) => ({
        label: String(ev?.event_name || ev?.name || `Step ${idx + 1}`).trim(),
        payoutUsd: Number(ev?.payout || 0) || undefined,
        order: idx + 1,
      }))
      .slice(0, 10);

    return {
      external_offer_id: extId,
      title: title.slice(0, 140),
      description: desc.slice(0, 1000),
      instructions: instructions.slice(0, 1000),
      steps,
      category: inferOfferCategory(raw.verticals || raw.category, title, desc),
      image_url: sanitizeDestinationUrl(raw.image_url || raw.icon_url, []) || null,
      thumbnail_url: sanitizeDestinationUrl(raw.image_url_220x124 || raw.image_url, []) || null,
      provider_reward: split.providerReward,
      user_reward: split.userReward,
      commission_percent: split.commissionPercent,
      currency: split.currency,
      is_estimated_reward: rawEvents.length > 1,
      estimated_time: Number(raw.estimated_time || 0) > 0 ? Math.round(Number(raw.estimated_time)) : null,
      countries: normalizeCountryList(raw.countries),
      excluded_countries: normalizeCountryList(raw.excluded_countries),
      device_types: normalizeDeviceList(raw.platform || raw.devices || raw.os),
      new_user_only: true,
      tracking_type: "s2s",
      destination_url: destUrl,
      is_featured: split.userReward >= 5.0,
      is_active: true,
      starts_at: null,
      expires_at:
        typeof raw.expires_at === "string"
          ? raw.expires_at
          : typeof raw.expiration_date === "string"
          ? raw.expiration_date
          : typeof raw.end_date === "string"
          ? raw.end_date
          : null,
    };
  }

  validateClick(offer: StoredOffer, _user: ClickUserContext, opaqueClickId: string): ClickBuildResult {
    const safeUrl = sanitizeDestinationUrl(offer.destination_url, this.allowedRedirectDomains);
    if (!safeUrl) {
      return { valid: false, reason: "Invalid Torox destination domain" };
    }
    let outUrl = safeUrl;
    if (outUrl.includes("{USER_ID}") || outUrl.includes("[USER_ID]")) {
      outUrl = outUrl.replace(/\{USER_ID\}|\[USER_ID\]/g, encodeURIComponent(opaqueClickId));
    } else {
      const parsed = new URL(outUrl);
      parsed.searchParams.set("user_id", opaqueClickId);
      outUrl = parsed.toString();
    }
    return { valid: true, trackingUrl: outUrl };
  }

  async verifyPostback(ctx: PostbackRequestContext): Promise<PostbackVerificationResult> {
    const { secret } = this.getSecrets();
    if (!secret) return { configured: false, valid: false, method: "md5_sig", reason: "TOROX_SECRET missing" };

    const txId = ctx.params.tx_id || ctx.params.oid || "";
    const userId = ctx.params.user_id || "";
    const sig = ctx.params.sig || "";

    if (!sig || !txId || !userId) {
      return { configured: true, valid: false, method: "md5_sig", reason: "Missing sig, tx_id, or user_id" };
    }

    const expectedSig = md5Hex(`${txId}-${userId}-${secret}`);
    const matched = constantTimeCompare(sig.toLowerCase(), expectedSig.toLowerCase());
    return {
      configured: true,
      valid: matched,
      method: "md5_sig",
      reason: matched ? undefined : "MD5 signature mismatch",
    };
  }

  parseConversion(ctx: PostbackRequestContext): ParsedConversionEvent | null {
    const status = String(ctx.params.status || "1");
    const rawAmount = parseFloat(ctx.params.amount || ctx.params.payout || "0");
    if (status === "2" || status === "reversed" || rawAmount < 0) return null;

    const txId = (ctx.params.tx_id || ctx.params.oid || "").trim();
    const rawRef = (ctx.params.user_id || "").trim();
    if (!txId || !rawRef || !Number.isFinite(rawAmount) || rawAmount <= 0) return null;

    return {
      externalTransactionId: txId,
      rawUserOrClickRef: rawRef,
      opaqueClickId: ctx.params.click_id || (rawRef.startsWith("pv_") ? rawRef : undefined),
      externalOfferId: ctx.params.offer_id || ctx.params.oid || undefined,
      providerReward: rawAmount,
      currency: (ctx.params.currency || "USD").toUpperCase(),
      isPending: status === "0" || status === "pending",
      timestampValid: true,
    };
  }

  parseReversal(ctx: PostbackRequestContext): ParsedReversalEvent | null {
    const status = String(ctx.params.status || "1");
    const rawAmount = parseFloat(ctx.params.amount || ctx.params.payout || "0");
    if (status !== "2" && status !== "reversed" && rawAmount >= 0 && ctx.params.is_chargeback !== "1") {
      return null;
    }

    const txId = (ctx.params.tx_id || ctx.params.oid || "").trim();
    const rawRef = (ctx.params.user_id || "").trim();
    if (!txId || !rawRef) return null;

    return {
      externalTransactionId: txId,
      reversalTransactionId: ctx.params.reversal_id || undefined,
      rawUserOrClickRef: rawRef,
      opaqueClickId: ctx.params.click_id || (rawRef.startsWith("pv_") ? rawRef : undefined),
      reversalAmount: Math.abs(Number.isFinite(rawAmount) ? rawAmount : 0),
      currency: (ctx.params.currency || "USD").toUpperCase(),
      isPartial: ctx.params.partial === "1",
      reason: ctx.params.reason || "Torox offer reversal",
    };
  }

  getProviderStatus(): ProviderAdapterStatus {
    const s = this.getSecrets();
    const missing: string[] = [];
    if (!s.pubId) missing.push("TOROX_PUB_ID");
    if (!s.apiKey) missing.push("TOROX_API_KEY");
    if (!s.secret) missing.push("TOROX_SECRET");
    return {
      providerKey: this.providerKey,
      displayName: this.displayName,
      configuredForApi: Boolean(s.pubId && s.apiKey),
      configuredForPostback: Boolean(s.secret),
      supportsCustomListing: Boolean(s.pubId && s.apiKey),
      supportsHostedWall: true,
      supportsReversal: true,
      missingSecrets: missing,
    };
  }
}
