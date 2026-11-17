// supabase/functions/_shared/offers/reward-engine.ts
// Decimal-safe Offer Normalization & Commission Calculation Engine

import type { RewardCalculator, RewardSplit } from "../providers/types.ts";

export interface CommissionConfig {
  defaultUserSharePercent: number;
  minUserRewardUsd: number;
  maxUserRewardUsd: number;
  providerUserShareOverrides: Record<string, number>;
}

export const DEFAULT_COMMISSION_CONFIG: CommissionConfig = {
  defaultUserSharePercent: 70,
  minUserRewardUsd: 0.01,
  maxUserRewardUsd: 1000,
  providerUserShareOverrides: {
    cpx: 80,
  },
};

// Conservative static FX conversion to USD when a provider reports non-USD currency
const CURRENCY_TO_USD: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.26,
  CAD: 0.73,
  AUD: 0.65,
  POINTS: 0.001, // 1000 PTS = $1.00
  PTS: 0.001,
};

/**
 * Decimal-safe integer millicents math (1 USD = 10,000 units of $0.0001)
 * Prevents IEEE-754 float drift like 0.1 + 0.2 = 0.30000000000000004
 */
function toDecimillicents(amount: number): number {
  return Math.round(amount * 10000);
}

function fromDecimillicents(units: number): number {
  return Math.round(units) / 10000;
}

function floorCents(amount: number): number {
  return Math.floor(Math.round(amount * 10000) / 100) / 100;
}

export async function loadCommissionConfig(supabaseAdmin: any): Promise<CommissionConfig> {
  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "offerwall_commission_config")
      .maybeSingle();

    if (error || !data?.value || typeof data.value !== "object") {
      return { ...DEFAULT_COMMISSION_CONFIG };
    }

    const raw = data.value as Record<string, unknown>;
    const defaultShare = Number(raw.default_user_share_percent);
    const minReward = Number(raw.min_user_reward_usd);
    const maxReward = Number(raw.max_user_reward_usd);

    const overrides: Record<string, number> = { ...DEFAULT_COMMISSION_CONFIG.providerUserShareOverrides };
    if (raw.provider_user_share_overrides && typeof raw.provider_user_share_overrides === "object") {
      for (const [k, v] of Object.entries(raw.provider_user_share_overrides as Record<string, unknown>)) {
        const pct = Number(v);
        if (Number.isFinite(pct) && pct >= 10 && pct <= 100) {
          overrides[k.toLowerCase()] = pct;
        }
      }
    }

    return {
      defaultUserSharePercent:
        Number.isFinite(defaultShare) && defaultShare >= 10 && defaultShare <= 100
          ? defaultShare
          : DEFAULT_COMMISSION_CONFIG.defaultUserSharePercent,
      minUserRewardUsd:
        Number.isFinite(minReward) && minReward >= 0.01 && minReward <= 10
          ? minReward
          : DEFAULT_COMMISSION_CONFIG.minUserRewardUsd,
      maxUserRewardUsd:
        Number.isFinite(maxReward) && maxReward >= 10 && maxReward <= 5000
          ? maxReward
          : DEFAULT_COMMISSION_CONFIG.maxUserRewardUsd,
      providerUserShareOverrides: overrides,
    };
  } catch {
    return { ...DEFAULT_COMMISSION_CONFIG };
  }
}

export function buildRewardCalculator(
  config: CommissionConfig,
  providerKey: string,
  providerOverridePercent?: number | null
): RewardCalculator {
  const key = providerKey.toLowerCase();
  const resolvedUserSharePercent =
    typeof providerOverridePercent === "number" &&
    Number.isFinite(providerOverridePercent) &&
    providerOverridePercent >= 10 &&
    providerOverridePercent <= 100
      ? providerOverridePercent
      : config.providerUserShareOverrides[key] ?? config.defaultUserSharePercent;

  const commissionPercent = Math.round((100 - resolvedUserSharePercent) * 100) / 100;

  return (rawPayout, options = {}): RewardSplit | null => {
    const numericRaw = typeof rawPayout === "number" ? rawPayout : parseFloat(String(rawPayout ?? ""));
    if (!Number.isFinite(numericRaw) || numericRaw <= 0) {
      return null;
    }

    const currency = (options.currency || "USD").trim().toUpperCase();
    let providerUsd = numericRaw;

    if (options.pointsPerUsd && options.pointsPerUsd > 0) {
      providerUsd = numericRaw / options.pointsPerUsd;
    } else if (currency !== "USD") {
      const fx = CURRENCY_TO_USD[currency];
      if (!fx) {
        // Unsupported currency is rejected rather than silently mispriced
        return null;
      }
      providerUsd = numericRaw * fx;
    }

    const providerUnits = toDecimillicents(providerUsd);
    const providerReward = fromDecimillicents(providerUnits);
    if (providerReward <= 0) return null;

    // Floor user reward to 2 decimal places so Payvora never over-credits above provider payout
    const rawUserShareUsd = fromDecimillicents((providerUnits * resolvedUserSharePercent) / 100);
    const userReward = Math.min(config.maxUserRewardUsd, floorCents(rawUserShareUsd));

    if (userReward < config.minUserRewardUsd) {
      return null;
    }

    const payvoraCommission = fromDecimillicents(
      Math.max(0, providerUnits - toDecimillicents(userReward))
    );

    return {
      providerReward,
      payvoraCommission,
      userReward,
      commissionPercent,
      currency: "USD",
      isEstimated: Boolean(options.isEstimated),
    };
  };
}
