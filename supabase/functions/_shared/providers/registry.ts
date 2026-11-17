// supabase/functions/_shared/providers/registry.ts
import type { OfferProviderAdapter, ProviderAdapterStatus } from "./types.ts";
import { ToroxAdapter } from "./torox.ts";
import { LootablyAdapter } from "./lootably.ts";
import { AyetAdapter } from "./ayet.ts";
import { AdGateAdapter } from "./adgate.ts";
import { AdGemAdapter } from "./adgem.ts";
import { AdscendAdapter } from "./adscend.ts";
import { CpxAdapter } from "./cpx.ts";
import { TapjoyAdapter } from "./tapjoy.ts";
import { md5Hex } from "../crypto.ts";

const ADAPTER_INSTANCES: OfferProviderAdapter[] = [
  new ToroxAdapter(),
  new LootablyAdapter(),
  new AyetAdapter(),
  new AdGateAdapter(),
  new AdGemAdapter(),
  new AdscendAdapter(),
  new CpxAdapter(),
  new TapjoyAdapter(),
];

const ADAPTER_MAP = new Map<string, OfferProviderAdapter>(
  ADAPTER_INSTANCES.map((adapter) => [adapter.providerKey, adapter])
);

export function getProviderAdapter(providerKey: string): OfferProviderAdapter | null {
  return ADAPTER_MAP.get(providerKey.toLowerCase().trim()) || null;
}

export function listProviderAdapters(): OfferProviderAdapter[] {
  return [...ADAPTER_INSTANCES];
}

export function getAllProviderStatuses(): ProviderAdapterStatus[] {
  return ADAPTER_INSTANCES.map((a) => a.getProviderStatus());
}

/**
 * Generates an authenticated Partner Wall launch URL purely on the server so
 * publisher secrets, placement IDs, and app IDs never live hardcoded in frontend code.
 */
export function buildHostedWallLaunchUrl(
  providerKey: string,
  userRef: string,
  templateOverride?: string | null
): { url: string | null; reason?: string } {
  const key = providerKey.toLowerCase().trim();
  const safeUser = encodeURIComponent(userRef);

  if (key === "cpx") {
    const appId = (Deno.env.get("CPX_APP_ID") || "").trim();
    const secret = (Deno.env.get("CPX_SECRET") || "").trim();
    if (!appId || !secret) {
      return { url: null, reason: "CPX Research Partner Wall awaits CPX_APP_ID and CPX_SECRET." };
    }
    const secureHash = md5Hex(`${userRef}-${secret}`);
    return {
      url: `https://offers.cpx-research.com/index.php?app_id=${encodeURIComponent(appId)}&ext_user_id=${safeUser}&secure_hash=${secureHash}`,
    };
  }

  if (key === "ayet") {
    const adslotId = (Deno.env.get("AYET_ADSLOT_ID") || "").trim();
    if (!adslotId) {
      return { url: null, reason: "ayeT-Studios Partner Wall awaits AYET_ADSLOT_ID." };
    }
    return {
      url: `https://www.ayetstudios.com/offers/offerwall_api/${encodeURIComponent(adslotId)}?external_identifier=${safeUser}`,
    };
  }

  if (key === "torox") {
    const pubId = (Deno.env.get("TOROX_PUB_ID") || "").trim();
    const appId = (Deno.env.get("TOROX_APP_ID") || "").trim();
    if (!pubId) {
      return { url: null, reason: "Torox Partner Wall awaits TOROX_PUB_ID." };
    }
    const appPart = appId ? `&app_id=${encodeURIComponent(appId)}` : "";
    return {
      url: `https://torox.io/offerwall?pub_id=${encodeURIComponent(pubId)}${appPart}&user_id=${safeUser}`,
    };
  }

  if (key === "adgate") {
    const wallCode = (Deno.env.get("ADGATE_WALL_CODE") || "").trim();
    if (!wallCode) {
      return { url: null, reason: "AdGate Media Partner Wall awaits ADGATE_WALL_CODE." };
    }
    return {
      url: `https://wall.adgaterewards.com/${encodeURIComponent(wallCode)}/${safeUser}`,
    };
  }

  if (key === "lootably") {
    const placementId = (Deno.env.get("LOOTABLY_PLACEMENT_ID") || "").trim();
    if (!placementId) {
      return { url: null, reason: "Lootably Partner Wall awaits LOOTABLY_PLACEMENT_ID." };
    }
    return {
      url: `https://wall.lootably.com/?placementID=${encodeURIComponent(placementId)}&sid=${safeUser}`,
    };
  }

  if (key === "adgem") {
    const appId = (Deno.env.get("ADGEM_APP_ID") || "").trim();
    if (!appId) {
      return { url: null, reason: "AdGem Partner Wall awaits ADGEM_APP_ID and publisher approval." };
    }
    return {
      url: `https://api.adgem.com/v1/wall?appid=${encodeURIComponent(appId)}&playerid=${safeUser}`,
    };
  }

  if (key === "adscend") {
    const pubId = (Deno.env.get("ADSCEND_PUBLISHER_ID") || "").trim();
    const profileId = (Deno.env.get("ADSCEND_PROFILE_ID") || "").trim();
    if (!pubId || !profileId) {
      return { url: null, reason: "Adscend Media Partner Wall awaits ADSCEND_PUBLISHER_ID and ADSCEND_PROFILE_ID." };
    }
    return {
      url: `https://asmwall.com/adwall/publisher/${encodeURIComponent(pubId)}/profile/${encodeURIComponent(profileId)}?subid1=${safeUser}`,
    };
  }

  if (key === "tapjoy") {
    const hostedUrl = (Deno.env.get("TAPJOY_WALL_URL") || templateOverride || "").trim();
    if (!hostedUrl) {
      return { url: null, reason: "Tapjoy Hosted Wall URL awaits TAPJOY_WALL_URL configuration." };
    }
    if (hostedUrl.includes("{user_id}")) {
      return { url: hostedUrl.replace(/\{user_id\}/g, safeUser) };
    }
    return { url: hostedUrl };
  }

  return { url: null, reason: `Unknown provider '${providerKey}'` };
}
