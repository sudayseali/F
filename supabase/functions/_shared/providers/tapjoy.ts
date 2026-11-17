// supabase/functions/_shared/providers/tapjoy.ts
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
} from "./types.ts";

/**
 * Tapjoy is integrated as a Hosted Partner Wall + S2S callback verifier.
 * It does not expose a custom offer listing API unless direct publisher API access is granted.
 */
export class TapjoyAdapter implements OfferProviderAdapter {
  readonly providerKey = "tapjoy";
  readonly displayName = "Tapjoy";
  readonly allowedRedirectDomains = ["tapjoy.com", "tj.tapjoy.com"];

  private getSecrets() {
    return {
      secretKey: (Deno.env.get("TAPJOY_SECRET_KEY") || Deno.env.get("TAPJOY_SECRET") || "").trim(),
      sdkKey: (Deno.env.get("TAPJOY_SDK_KEY") || "").trim(),
    };
  }

  async fetchOffers(_ctx: ProviderFetchContext): Promise<ProviderFetchResult> {
    return {
      offers: [],
      hasMore: false,
      unsupportedByProvider: true,
      note: "Tapjoy operates as a Hosted Wall integration unless direct custom listing API access is approved by Tapjoy.",
    };
  }

  normalizeOffer(_raw: Record<string, unknown>, _calc: RewardCalculator): NormalizedOffer | null {
    return null;
  }

  validateClick(
    _offer: StoredOffer,
    _user: ClickUserContext,
    _opaqueClickId: string
  ): ClickBuildResult {
    return {
      valid: false,
      reason: "Tapjoy offers must be launched via the Hosted Partner Walls section.",
    };
  }

  async verifyPostback(ctx: PostbackRequestContext): Promise<PostbackVerificationResult> {
    const { secretKey } = this.getSecrets();
    if (!secretKey) {
      return {
        configured: false,
        valid: false,
        method: "tapjoy_md5",
        reason: "TAPJOY_SECRET / TAPJOY_SECRET_KEY missing",
      };
    }

    const txId = (ctx.params.id || "").trim();
    const snuid = (ctx.params.snuid || "").trim();
    const currency = (ctx.params.currency || "").trim();
    const verifier = (ctx.params.verifier || "").trim();

    if (!txId || !snuid || !currency || !verifier) {
      return {
        configured: true,
        valid: false,
        method: "tapjoy_md5",
        reason: "Missing Tapjoy callback parameter (id, snuid, currency, or verifier)",
      };
    }

    // Official Tapjoy S2S callback verifier: MD5(id:snuid:currency:secret_key)
    const expectedHash = md5Hex(`${txId}:${snuid}:${currency}:${secretKey}`);
    const matched = constantTimeCompare(verifier.toLowerCase(), expectedHash.toLowerCase());

    return {
      configured: true,
      valid: matched,
      method: "tapjoy_md5",
      reason: matched ? undefined : "Invalid Tapjoy verifier signature",
    };
  }

  parseConversion(ctx: PostbackRequestContext): ParsedConversionEvent | null {
    const txId = (ctx.params.id || "").trim();
    const snuid = (ctx.params.snuid || "").trim();
    const rawAmount = parseFloat(ctx.params.currency || "0");
    if (!txId || !snuid || !Number.isFinite(rawAmount) || rawAmount <= 0) return null;

    return {
      externalTransactionId: txId,
      rawUserOrClickRef: snuid,
      opaqueClickId: snuid.startsWith("pv_") ? snuid : undefined,
      providerReward: rawAmount,
      currency: "USD",
      isPending: false,
      timestampValid: true,
    };
  }

  parseReversal(ctx: PostbackRequestContext): ParsedReversalEvent | null {
    const rawAmount = parseFloat(ctx.params.currency || "0");
    if (!Number.isFinite(rawAmount) || rawAmount >= 0) return null;

    const txId = (ctx.params.id || "").trim();
    const snuid = (ctx.params.snuid || "").trim();
    if (!txId || !snuid) return null;

    return {
      externalTransactionId: txId,
      rawUserOrClickRef: snuid,
      opaqueClickId: snuid.startsWith("pv_") ? snuid : undefined,
      reversalAmount: Math.abs(rawAmount),
      currency: "USD",
      isPartial: false,
      reason: "Tapjoy negative currency reversal",
    };
  }

  getProviderStatus(): ProviderAdapterStatus {
    const s = this.getSecrets();
    const missing: string[] = [];
    if (!s.secretKey) missing.push("TAPJOY_SECRET");

    return {
      providerKey: this.providerKey,
      displayName: this.displayName,
      configuredForApi: false,
      configuredForPostback: Boolean(s.secretKey),
      supportsCustomListing: false,
      supportsHostedWall: Boolean(s.sdkKey),
      supportsReversal: false,
      missingSecrets: missing,
      note: "Hosted Wall integration; custom offer listing API not supported without Tapjoy publisher API approval.",
    };
  }
}
