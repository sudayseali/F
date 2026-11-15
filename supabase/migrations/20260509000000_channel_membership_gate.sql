-- ============================================================================
-- PAYVORA: MANDATORY TELEGRAM CHANNEL MEMBERSHIP GATE FOR NEW USERS
-- Migration: 20260509000000_channel_membership_gate.sql
-- ============================================================================

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS channel_joined BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS channel_verified_at TIMESTAMPTZ;

-- Preserve seamless access for existing users created prior to this migration
UPDATE public.users
SET channel_joined = true,
    channel_verified_at = COALESCE(channel_verified_at, NOW())
WHERE channel_joined = false;

CREATE INDEX IF NOT EXISTS idx_users_channel_joined ON public.users(channel_joined);
