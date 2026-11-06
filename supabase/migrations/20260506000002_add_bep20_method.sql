-- ============================================================================
-- PAYVORA: ADD USDT BEP20 (BNB SMART CHAIN) PAYOUT METHOD
-- Migration: 20260506000002_add_bep20_method.sql
-- ============================================================================

-- 1. Update withdrawals table method check constraint
ALTER TABLE public.withdrawals 
DROP CONSTRAINT IF EXISTS withdrawals_method_check;

ALTER TABLE public.withdrawals 
ADD CONSTRAINT withdrawals_method_check 
CHECK (method IN ('usdt', 'usdt_bep20', 'trx', 'payeer'));

-- 2. Update app_settings default payout_config to list usdt_bep20
UPDATE public.app_settings
SET value = jsonb_set(value, '{supported_methods}', '["usdt", "usdt_bep20", "trx", "payeer"]'::jsonb)
WHERE key = 'payout_config';
