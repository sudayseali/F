// supabase/functions/_shared/vpn-check.ts
// Multi-layer VPN, Proxy, Tor & Datacenter IP Risk Verification Engine
// Supports ProxyCheck.io v2 (PROXYCHECK_KEY) and ipapi.is (IPAPI_KEY) with 2-tier L1/L2 caching.

import { sha256Hex } from "./crypto.ts";
import { AppError } from "./errors.ts";

export type VpnEnforcementContext =
  | "offer_click"
  | "offers_api"
  | "submit_task"
  | "daily_checkin"
  | "withdraw"
  | "auth";

export interface AntiFraudConfig {
  vpn_detection_enabled: boolean;
  max_daily_withdrawals: number;
  block_vpn_on_offers: boolean;
  block_vpn_on_tasks: boolean;
  block_vpn_on_checkin: boolean;
  block_vpn_on_withdraw: boolean;
  block_vpn_on_auth: boolean;
  block_hosting_ips: boolean;
  vpn_risk_threshold: number;
  strict_fail_closed: boolean;
}

export const DEFAULT_ANTI_FRAUD_CONFIG: AntiFraudConfig = {
  vpn_detection_enabled: true,
  max_daily_withdrawals: 3,
  block_vpn_on_offers: true,
  block_vpn_on_tasks: true,
  block_vpn_on_checkin: true,
  block_vpn_on_withdraw: true,
  block_vpn_on_auth: false,
  block_hosting_ips: true,
  vpn_risk_threshold: 66,
  strict_fail_closed: false,
};

export interface VpnReputationResult {
  configured: boolean;
  enabled: boolean;
  blocked: boolean;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  isHosting: boolean;
  riskScore: number;
  countryCode: string | null;
  asn: string | null;
  provider: "proxycheck" | "ipapi" | "cache" | "bypass" | "none";
  reason: string | null;
  ipHash: string;
}

const L1_CACHE = new Map<string, { res: Omit<VpnReputationResult, "blocked" | "enabled">; expiresAt: number }>();
let CONFIG_CACHE: { value: AntiFraudConfig; expiresAt: number } | null = null;

export function isPrivateOrUnknownIp(ip: string): boolean {
  const clean = (ip || "").trim().toLowerCase();
  if (!clean || clean === "unknown") return true;
  if (clean === "::1" || clean.startsWith("fe80:") || clean.startsWith("fc") || clean.startsWith("fd")) return true;
  if (clean === "127.0.0.1" || clean.startsWith("10.") || clean.startsWith("192.168.")) return true;
  if (clean.startsWith("172.")) {
    const second = parseInt(clean.split(".")[1] || "0", 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

export function getVpnSecretsStatus() {
  const proxycheckKey = (Deno.env.get("PROXYCHECK_KEY") || "").trim();
  const ipapiKey = (Deno.env.get("IPAPI_KEY") || "").trim();
  return {
    proxycheckConfigured: Boolean(proxycheckKey),
    ipapiConfigured: Boolean(ipapiKey),
    anyConfigured: Boolean(proxycheckKey || ipapiKey),
  };
}

export async function loadAntiFraudConfig(supabaseAdmin: any, forceRefresh = false): Promise<AntiFraudConfig> {
  if (!forceRefresh && CONFIG_CACHE && Date.now() < CONFIG_CACHE.expiresAt) {
    return CONFIG_CACHE.value;
  }
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "anti_fraud_config")
      .maybeSingle();

    const raw = (data?.value && typeof data.value === "object" ? data.value : {}) as Record<string, unknown>;
    const merged: AntiFraudConfig = {
      vpn_detection_enabled: raw.vpn_detection_enabled !== false,
      max_daily_withdrawals: Number.isFinite(Number(raw.max_daily_withdrawals)) ? Number(raw.max_daily_withdrawals) : 3,
      block_vpn_on_offers: raw.block_vpn_on_offers !== false,
      block_vpn_on_tasks: raw.block_vpn_on_tasks !== false,
      block_vpn_on_checkin: raw.block_vpn_on_checkin !== false,
      block_vpn_on_withdraw: raw.block_vpn_on_withdraw !== false,
      block_vpn_on_auth: raw.block_vpn_on_auth === true,
      block_hosting_ips: raw.block_hosting_ips !== false,
      vpn_risk_threshold: Math.min(100, Math.max(20, Number(raw.vpn_risk_threshold || 66))),
      strict_fail_closed: raw.strict_fail_closed === true,
    };
    CONFIG_CACHE = { value: merged, expiresAt: Date.now() + 60_000 };
    return merged;
  } catch {
    return DEFAULT_ANTI_FRAUD_CONFIG;
  }
}

export function parseProxyCheckPayload(
  ip: string,
  payload: any
): Omit<VpnReputationResult, "blocked" | "enabled" | "ipHash"> | null {
  if (!payload || payload.status === "error" || payload.status === "denied") return null;
  const record = payload[ip] || Object.values(payload).find((v: any) => v && typeof v === "object" && "proxy" in v);
  if (!record || typeof record !== "object") return null;

  const proxyFlag = String((record as any).proxy || "no").toLowerCase() === "yes";
  const typeStr = String((record as any).type || "").toLowerCase();
  const isTor = typeStr.includes("tor");
  const isVpn = typeStr.includes("vpn") || (proxyFlag && !isTor && !typeStr.includes("socks") && !typeStr.includes("http"));
  const isHosting = typeStr.includes("hosting") || typeStr.includes("datacenter") || typeStr.includes("server");
  const isProxy = proxyFlag && !isVpn && !isTor;
  const riskScore = Math.max(0, Math.min(100, parseInt(String((record as any).risk ?? "0"), 10) || 0));
  const countryRaw = String((record as any).isocode || "").trim().toUpperCase();
  const countryCode = /^[A-Z]{2}$/.test(countryRaw) ? countryRaw : null;
  const asn = (record as any).asn ? String((record as any).asn).slice(0, 32) : null;

  const reasons: string[] = [];
  if (isTor) reasons.push("Tor exit node");
  if (isVpn) reasons.push("VPN detected");
  if (isProxy) reasons.push("Proxy server");
  if (isHosting) reasons.push("Datacenter/Hosting IP");
  if (riskScore > 0 && reasons.length === 0) reasons.push(`Risk score ${riskScore}`);

  return {
    configured: true,
    isVpn,
    isProxy,
    isTor,
    isHosting,
    riskScore,
    countryCode,
    asn,
    provider: "proxycheck",
    reason: reasons.length > 0 ? reasons.join(", ") : null,
  };
}

export function parseIpApiIsPayload(
  payload: any
): Omit<VpnReputationResult, "blocked" | "enabled" | "ipHash"> | null {
  if (!payload || typeof payload !== "object" || payload.error) return null;

  const isVpn = Boolean(payload.is_vpn);
  const isProxy = Boolean(payload.is_proxy);
  const isTor = Boolean(payload.is_tor);
  const isHosting = Boolean(payload.is_datacenter);
  const isAbuser = Boolean(payload.is_abuser);
  const riskScore = isTor ? 100 : isVpn || isProxy ? 90 : isAbuser ? 80 : isHosting ? 70 : 0;

  const countryRaw = String(payload.location?.country_code || "").trim().toUpperCase();
  const countryCode = /^[A-Z]{2}$/.test(countryRaw) ? countryRaw : null;
  const asn = payload.asn?.asn ? `AS${payload.asn.asn}` : null;

  const reasons: string[] = [];
  if (isTor) reasons.push("Tor exit node");
  if (isVpn) reasons.push("VPN detected");
  if (isProxy) reasons.push("Proxy server");
  if (isHosting) reasons.push("Datacenter/Hosting IP");
  if (isAbuser) reasons.push("Abusive IP reputation");

  return {
    configured: true,
    isVpn,
    isProxy: isProxy || isAbuser,
    isTor,
    isHosting,
    riskScore,
    countryCode,
    asn,
    provider: "ipapi",
    reason: reasons.length > 0 ? reasons.join(", ") : null,
  };
}

function evaluateBlocked(
  rep: Omit<VpnReputationResult, "blocked" | "enabled">,
  cfg: AntiFraudConfig,
  context: VpnEnforcementContext
): boolean {
  if (!cfg.vpn_detection_enabled) return false;

  const contextEnabled =
    context === "offer_click"
      ? cfg.block_vpn_on_offers
      : context === "offers_api"
      ? cfg.block_vpn_on_offers
      : context === "submit_task"
      ? cfg.block_vpn_on_tasks
      : context === "daily_checkin"
      ? cfg.block_vpn_on_checkin
      : context === "withdraw"
      ? cfg.block_vpn_on_withdraw
      : cfg.block_vpn_on_auth;

  if (!contextEnabled) return false;

  if (!rep.configured) {
    return cfg.strict_fail_closed;
  }

  if (rep.isTor || rep.isVpn || rep.isProxy) return true;
  if (cfg.block_hosting_ips && rep.isHosting) return true;
  if (rep.riskScore >= cfg.vpn_risk_threshold) return true;
  return false;
}

async function fetchExternalIpReputation(
  ip: string
): Promise<Omit<VpnReputationResult, "blocked" | "enabled" | "ipHash"> | null> {
  const proxycheckKey = (Deno.env.get("PROXYCHECK_KEY") || "").trim();
  const ipapiKey = (Deno.env.get("IPAPI_KEY") || "").trim();

  if (proxycheckKey) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    try {
      const url = `https://proxycheck.io/v2/${encodeURIComponent(ip)}?key=${encodeURIComponent(proxycheckKey)}&vpn=1&asn=1&risk=1`;
      const res = await fetch(url, { method: "GET", signal: ctrl.signal });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const parsed = parseProxyCheckPayload(ip, json);
        if (parsed) return parsed;
      }
    } catch (err: any) {
      console.warn("[VPN_PROXYCHECK_ERROR]", err?.message || err);
    } finally {
      clearTimeout(timer);
    }
  }

  if (ipapiKey) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    try {
      const url = `https://api.ipapi.is/?q=${encodeURIComponent(ip)}&key=${encodeURIComponent(ipapiKey)}`;
      const res = await fetch(url, { method: "GET", signal: ctrl.signal });
      if (res.ok) {
        const json = await res.json().catch(() => null);
        const parsed = parseIpApiIsPayload(json);
        if (parsed) return parsed;
      }
    } catch (err: any) {
      console.warn("[VPN_IPAPI_ERROR]", err?.message || err);
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

export async function checkIpReputation(
  supabaseAdmin: any,
  clientIp: string,
  context: VpnEnforcementContext = "offer_click"
): Promise<VpnReputationResult> {
  const cfg = await loadAntiFraudConfig(supabaseAdmin);
  const ipHash = await sha256Hex(clientIp || "unknown");
  const secrets = getVpnSecretsStatus();

  if (isPrivateOrUnknownIp(clientIp)) {
    return {
      configured: secrets.anyConfigured,
      enabled: cfg.vpn_detection_enabled,
      blocked: false,
      isVpn: false,
      isProxy: false,
      isTor: false,
      isHosting: false,
      riskScore: 0,
      countryCode: null,
      asn: null,
      provider: "bypass",
      reason: null,
      ipHash,
    };
  }

  // 1. Fast L1 Cache
  const l1 = L1_CACHE.get(ipHash);
  if (l1 && Date.now() < l1.expiresAt) {
    return {
      ...l1.res,
      enabled: cfg.vpn_detection_enabled,
      blocked: evaluateBlocked(l1.res, cfg, context),
    };
  }

  // 2. Distributed L2 PostgreSQL Cache
  try {
    const { data: cached } = await supabaseAdmin
      .from("ip_risk_cache")
      .select("*")
      .eq("ip_hash", ipHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (cached) {
      const base: Omit<VpnReputationResult, "blocked" | "enabled"> = {
        configured: true,
        isVpn: Boolean(cached.is_vpn),
        isProxy: Boolean(cached.is_proxy),
        isTor: Boolean(cached.is_tor),
        isHosting: Boolean(cached.is_hosting),
        riskScore: Number(cached.risk_score || 0),
        countryCode: cached.country_code || null,
        asn: cached.asn || null,
        provider: "cache",
        reason: cached.reason || null,
        ipHash,
      };
      L1_CACHE.set(ipHash, { res: base, expiresAt: Date.now() + 10 * 60_000 });
      return {
        ...base,
        enabled: cfg.vpn_detection_enabled,
        blocked: evaluateBlocked(base, cfg, context),
      };
    }
  } catch {
    // Graceful continue if migration is pending
  }

  if (!secrets.anyConfigured) {
    const unconf: Omit<VpnReputationResult, "blocked" | "enabled"> = {
      configured: false,
      isVpn: false,
      isProxy: false,
      isTor: false,
      isHosting: false,
      riskScore: 0,
      countryCode: null,
      asn: null,
      provider: "none",
      reason: "PROXYCHECK_KEY / IPAPI_KEY not configured",
      ipHash,
    };
    return {
      ...unconf,
      enabled: cfg.vpn_detection_enabled,
      blocked: evaluateBlocked(unconf, cfg, context),
    };
  }

  // 3. External Lookup
  const live = await fetchExternalIpReputation(clientIp);
  if (!live) {
    const errRes: Omit<VpnReputationResult, "blocked" | "enabled"> = {
      configured: false,
      isVpn: false,
      isProxy: false,
      isTor: false,
      isHosting: false,
      riskScore: 0,
      countryCode: null,
      asn: null,
      provider: "none",
      reason: "External IP reputation lookup unavailable",
      ipHash,
    };
    return {
      ...errRes,
      enabled: cfg.vpn_detection_enabled,
      blocked: evaluateBlocked(errRes, cfg, context),
    };
  }

  const fullBase: Omit<VpnReputationResult, "blocked" | "enabled"> = { ...live, ipHash };
  const isFlagged = live.isVpn || live.isProxy || live.isTor || live.isHosting || live.riskScore >= cfg.vpn_risk_threshold;
  const ttlHours = isFlagged ? 12 : 6;

  L1_CACHE.set(ipHash, { res: fullBase, expiresAt: Date.now() + 10 * 60_000 });

  await supabaseAdmin
    .from("ip_risk_cache")
    .upsert({
      ip_hash: ipHash,
      is_vpn: live.isVpn,
      is_proxy: live.isProxy,
      is_tor: live.isTor,
      is_hosting: live.isHosting,
      risk_score: live.riskScore,
      country_code: live.countryCode,
      asn: live.asn,
      provider: live.provider,
      reason: live.reason,
      checked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + ttlHours * 3600 * 1000).toISOString(),
    })
    .catch(() => {});

  return {
    ...fullBase,
    enabled: cfg.vpn_detection_enabled,
    blocked: evaluateBlocked(fullBase, cfg, context),
  };
}

/**
 * Enforces VPN blocking policy on protected actions and records immutable audit logs on block.
 */
export async function enforceVpnPolicy(
  supabaseAdmin: any,
  _req: Request,
  clientIp: string,
  context: VpnEnforcementContext,
  userId?: string
): Promise<VpnReputationResult> {
  const result = await checkIpReputation(supabaseAdmin, clientIp, context);

  if (result.blocked) {
    try {
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: userId || null,
        actor_type: userId ? "user" : "system",
        action: "vpn_access_blocked",
        target_type: context,
        target_id: userId || result.ipHash.slice(0, 16),
        details: {
          context,
          isVpn: result.isVpn,
          isProxy: result.isProxy,
          isTor: result.isTor,
          isHosting: result.isHosting,
          riskScore: result.riskScore,
          provider: result.provider,
          reason: result.reason,
        },
        ip_address: clientIp || null,
        created_at: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error("[VPN_AUDIT_LOG_ERROR]", logErr);
    }

    throw new AppError(
      "VPN, Proxy, or Datacenter connections are not permitted on Payvora. Please disable your VPN and try again.",
      403,
      "VPN_DETECTED"
    );
  }

  return result;
}
