// supabase/functions/_shared/providers/types.ts
// Unified Provider Adapter Contract for the Payvora Custom Offers Engine

export type OfferCategory = "games" | "apps" | "surveys" | "registration" | "trial" | "other";
export type TrackingType = "s2s" | "sdk" | "survey" | "hosted";
export type DeviceType = "android" | "ios" | "desktop" | "all";

export interface OfferStep {
  label: string;
  payoutUsd?: number;
  order: number;
}

export interface RewardSplit {
  providerReward: number;
  payvoraCommission: number;
  userReward: number;
  commissionPercent: number;
  currency: string;
  isEstimated: boolean;
}

export type RewardCalculator = (
  rawPayout: unknown,
  options?: {
    currency?: string;
    pointsPerUsd?: number;
    providerKey?: string;
    isEstimated?: boolean;
  }
) => RewardSplit | null;

export interface NormalizedOffer {
  external_offer_id: string;
  title: string;
  description: string;
  instructions: string;
  steps: OfferStep[];
  category: OfferCategory;
  image_url: string | null;
  thumbnail_url: string | null;
  provider_reward: number;
  user_reward: number;
  commission_percent: number;
  currency: string;
  is_estimated_reward: boolean;
  estimated_time: number | null;
  countries: string[];
  excluded_countries: string[];
  device_types: DeviceType[];
  new_user_only: boolean;
  tracking_type: TrackingType;
  destination_url: string;
  is_featured: boolean;
  is_active: boolean;
  starts_at: string | null;
  expires_at: string | null;
}

export interface ProviderFetchContext {
  page?: number;
  limit?: number;
  country?: string;
  device?: DeviceType;
  userId?: string;
  userIp?: string;
  userAgent?: string;
  timeoutMs?: number;
}

export interface ProviderFetchResult {
  offers: Record<string, unknown>[];
  hasMore: boolean;
  nextPage?: number;
  rateLimited?: boolean;
  unsupportedByProvider?: boolean;
  note?: string;
}

export interface StoredOffer {
  id: string;
  external_offer_id: string;
  destination_url: string;
  countries: string[];
  excluded_countries: string[];
  device_types: string[];
  expires_at: string | null;
  is_active: boolean;
}

export interface ClickUserContext {
  id: string;
  country?: string;
  device?: DeviceType;
}

export interface ClickBuildResult {
  valid: boolean;
  trackingUrl?: string;
  reason?: string;
}

export interface PostbackRequestContext {
  method: string;
  url: URL;
  params: Record<string, string>;
  headers: Headers;
  rawBody: string;
  clientIp: string;
}

export interface PostbackVerificationResult {
  configured: boolean;
  valid: boolean;
  method: string;
  reason?: string;
}

export interface ParsedConversionEvent {
  externalTransactionId: string;
  rawUserOrClickRef: string;
  opaqueClickId?: string;
  externalOfferId?: string;
  providerReward: number;
  currency: string;
  isPending: boolean;
  timestampValid: boolean;
}

export interface ParsedReversalEvent {
  externalTransactionId: string;
  reversalTransactionId?: string;
  rawUserOrClickRef: string;
  opaqueClickId?: string;
  reversalAmount: number;
  currency: string;
  isPartial: boolean;
  reason?: string;
}

export interface ProviderAdapterStatus {
  providerKey: string;
  displayName: string;
  configuredForApi: boolean;
  configuredForPostback: boolean;
  supportsCustomListing: boolean;
  supportsHostedWall: boolean;
  supportsReversal: boolean;
  missingSecrets: string[];
  note?: string;
}

export interface OfferProviderAdapter {
  readonly providerKey: string;
  readonly displayName: string;
  readonly allowedRedirectDomains: string[];

  fetchOffers(ctx: ProviderFetchContext): Promise<ProviderFetchResult>;
  normalizeOffer(raw: Record<string, unknown>, calc: RewardCalculator): NormalizedOffer | null;
  validateClick(
    offer: StoredOffer,
    user: ClickUserContext,
    opaqueClickId: string
  ): ClickBuildResult;
  verifyPostback(ctx: PostbackRequestContext): Promise<PostbackVerificationResult>;
  parseConversion(ctx: PostbackRequestContext): ParsedConversionEvent | null;
  parseReversal(ctx: PostbackRequestContext): ParsedReversalEvent | null;
  getProviderStatus(): ProviderAdapterStatus;
}

export function sanitizeDestinationUrl(
  rawUrl: unknown,
  allowedDomains: string[]
): string | null {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return null;
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    if (allowedDomains.length > 0) {
      const host = parsed.hostname.toLowerCase();
      const matched = allowedDomains.some((d) => {
        const cleanD = d.toLowerCase().trim();
        return host === cleanD || host.endsWith(`.${cleanD}`);
      });
      if (!matched) return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function fetchWithTimeoutRetry(
  inputUrl: string,
  init: RequestInit = {},
  timeoutMs = 10000,
  maxRetries = 2
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(inputUrl, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const delayMs = Math.min(4000, 350 * Math.pow(2, attempt));
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delayMs = Math.min(4000, 350 * Math.pow(2, attempt));
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Provider HTTP fetch failed");
}

export function normalizeCountryList(raw: unknown): string[] {
  if (!raw) return [];
  const items = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
    ? raw.split(/[,;\s]+/)
    : [];
  const set = new Set<string>();
  for (const item of items) {
    const code = String(item || "").trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) {
      set.add(code);
    }
  }
  return Array.from(set);
}

export function normalizeDeviceList(raw: unknown): DeviceType[] {
  if (!raw) return ["all"];
  const text = Array.isArray(raw) ? raw.join(" ").toLowerCase() : String(raw).toLowerCase();
  const out = new Set<DeviceType>();
  if (text.includes("android")) out.add("android");
  if (text.includes("ios") || text.includes("iphone") || text.includes("ipad")) out.add("ios");
  if (text.includes("desktop") || text.includes("windows") || text.includes("mac") || text.includes("web")) {
    out.add("desktop");
  }
  if (out.size === 0 || text.includes("all")) return ["all"];
  return Array.from(out);
}

export function inferOfferCategory(
  rawCat: unknown,
  title = "",
  description = ""
): OfferCategory {
  const combined = `${String(rawCat || "")} ${title} ${description}`.toLowerCase();
  if (combined.includes("survey") || combined.includes("questionnaire")) return "surveys";
  if (combined.includes("game") || combined.includes("level") || combined.includes("reach ")) return "games";
  if (combined.includes("trial") || combined.includes("subscription")) return "trial";
  if (combined.includes("sign up") || combined.includes("signup") || combined.includes("register")) return "registration";
  if (combined.includes("app") || combined.includes("install") || combined.includes("download")) return "apps";
  return "other";
}
