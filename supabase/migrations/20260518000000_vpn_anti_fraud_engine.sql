-- ============================================================================
-- PAYVORA: MULTI-LAYER VPN, PROXY & IP RISK ANTI-FRAUD ENGINE
-- Migration: 20260518000000_vpn_anti_fraud_engine.sql
-- ============================================================================
-- Additive, idempotent schema:
-- 1. Stores hashed IP reputation cache (minimizes external API calls & latency)
-- 2. Enriches anti_fraud_config with granular per-action VPN blocking flags
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ip_risk_cache (
    ip_hash TEXT PRIMARY KEY,
    is_vpn BOOLEAN NOT NULL DEFAULT false,
    is_proxy BOOLEAN NOT NULL DEFAULT false,
    is_tor BOOLEAN NOT NULL DEFAULT false,
    is_hosting BOOLEAN NOT NULL DEFAULT false,
    risk_score INTEGER NOT NULL DEFAULT 0,
    country_code TEXT,
    asn TEXT,
    provider TEXT NOT NULL DEFAULT 'none',
    reason TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '6 hours')
);

CREATE INDEX IF NOT EXISTS idx_ip_risk_cache_expires ON public.ip_risk_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_ip_risk_cache_flagged ON public.ip_risk_cache(is_vpn, is_proxy, is_tor) WHERE (is_vpn = true OR is_proxy = true OR is_tor = true);

ALTER TABLE public.ip_risk_cache ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ip_risk_cache FROM anon, authenticated;

-- Upgrade anti_fraud_config defaults non-destructively (keeps existing admin overrides)
INSERT INTO public.app_settings (key, value, description)
VALUES (
    'anti_fraud_config',
    '{
      "vpn_detection_enabled": true,
      "max_daily_withdrawals": 3,
      "block_vpn_on_offers": true,
      "block_vpn_on_tasks": true,
      "block_vpn_on_checkin": true,
      "block_vpn_on_withdraw": true,
      "block_vpn_on_auth": false,
      "block_hosting_ips": true,
      "vpn_risk_threshold": 66,
      "strict_fail_closed": false
    }'::jsonb,
    'Multi-layer VPN, Proxy, and anti-fraud controls'
)
ON CONFLICT (key) DO UPDATE
SET value = '{
      "vpn_detection_enabled": true,
      "max_daily_withdrawals": 3,
      "block_vpn_on_offers": true,
      "block_vpn_on_tasks": true,
      "block_vpn_on_checkin": true,
      "block_vpn_on_withdraw": true,
      "block_vpn_on_auth": false,
      "block_hosting_ips": true,
      "vpn_risk_threshold": 66,
      "strict_fail_closed": false
    }'::jsonb || COALESCE(public.app_settings.value, '{}'::jsonb),
    updated_at = NOW();
