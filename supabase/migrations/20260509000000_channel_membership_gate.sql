-- ============================================================================
-- PAYVORA: MANDATORY TELEGRAM CHANNEL MEMBERSHIP GATE FOR NEW USERS
-- Migration: 20260509000000_channel_membership_gate.sql
-- ============================================================================

DO $$
DECLARE
    v_had_channel_col BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'channel_joined'
    ) INTO v_had_channel_col;

    ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS total_earned NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
        ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ADD COLUMN IF NOT EXISTS channel_joined BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS channel_verified_at TIMESTAMPTZ;

    -- Preserve seamless access only for users created before channel_joined was first introduced
    IF NOT v_had_channel_col THEN
        UPDATE public.users
        SET channel_joined = true,
            channel_verified_at = COALESCE(channel_verified_at, NOW())
        WHERE channel_joined = false;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_channel_joined ON public.users(channel_joined);

