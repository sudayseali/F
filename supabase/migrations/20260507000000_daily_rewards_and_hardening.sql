-- ============================================================================
-- PAYVORA: REAL DAILY REWARDS, TASK STATS & ULTRA-HARDENED SECURITY
-- Migration: 20260507000000_daily_rewards_and_hardening.sql
-- ============================================================================

-- 1. Add last_daily_claim_at column to users table if not exists
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_daily_claim_at TIMESTAMPTZ;

-- 2. Atomic Stored Procedure: Claim Daily Check-In Reward
CREATE OR REPLACE FUNCTION public.claim_daily_reward(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user users%ROWTYPE;
    v_reward NUMERIC(12, 2) := 0.05; -- $0.05 = 50 Points
    v_new_balance NUMERIC(12, 2);
    v_idempotency_key TEXT;
    v_hours_since_last NUMERIC;
BEGIN
    -- 1. Lock user row FOR UPDATE
    SELECT * INTO v_user FROM users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User account not found.');
    END IF;

    IF v_user.status = 'suspended' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account is suspended.');
    END IF;

    -- 2. Check 24-Hour Cooldown
    IF v_user.last_daily_claim_at IS NOT NULL THEN
        IF v_user.last_daily_claim_at > NOW() - INTERVAL '24 hours' THEN
            v_hours_since_last := ROUND(EXTRACT(EPOCH FROM (NOW() - v_user.last_daily_claim_at)) / 3600, 1);
            RETURN jsonb_build_object(
                'success', false, 
                'error', 'Daily check-in reward already claimed. Please return in ' || (24 - v_hours_since_last)::TEXT || ' hours.',
                'already_claimed', true,
                'last_claim_at', v_user.last_daily_claim_at
            );
        END IF;
    END IF;

    -- 3. Idempotency Key for current calendar date
    v_idempotency_key := 'daily_' || p_user_id::text || '_' || to_char(NOW(), 'YYYY-MM-DD');

    IF EXISTS (SELECT 1 FROM transactions WHERE idempotency_key = v_idempotency_key) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Daily reward already claimed today.',
            'already_claimed', true
        );
    END IF;

    -- 4. Atomically Credit Wallet & Update Timestamp
    v_new_balance := v_user.wallet_balance + v_reward;

    UPDATE users 
    SET wallet_balance = v_new_balance,
        total_earned = total_earned + v_reward,
        last_daily_claim_at = NOW(),
        last_active_at = NOW()
    WHERE id = p_user_id;

    -- 5. Record Financial Ledger Transaction
    INSERT INTO transactions (
        user_id, amount, type, status, balance_before, balance_after,
        idempotency_key, reference_id, description
    ) VALUES (
        p_user_id, v_reward, 'task_reward', 'completed', v_user.wallet_balance, v_new_balance,
        v_idempotency_key, 'daily_checkin', 'Daily Check-In Reward (+50 PTS)'
    );

    -- 6. Audit Log
    INSERT INTO audit_logs (actor_id, actor_type, action, target_type, target_id, details)
    VALUES (p_user_id, 'user', 'daily_reward_claimed', 'wallet', p_user_id::text, 
            jsonb_build_object('amount', v_reward, 'points', 50));

    RETURN jsonb_build_object(
        'success', true,
        'reward_amount', v_reward,
        'points', 50,
        'new_balance', v_new_balance,
        'claimed_at', NOW()
    );
END;
$$;

-- 3. Stored Procedure: Get Real User Task & Activity Stats
CREATE OR REPLACE FUNCTION public.get_user_task_stats(
    p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_completed INTEGER := 0;
    v_pending INTEGER := 0;
    v_total_earned NUMERIC(12, 2) := 0.00;
    v_balance NUMERIC(12, 2) := 0.00;
BEGIN
    SELECT 
        COALESCE(wallet_balance, 0.00), 
        COALESCE(total_earned, 0.00) 
    INTO v_balance, v_total_earned 
    FROM users 
    WHERE id = p_user_id;

    SELECT COUNT(*) INTO v_completed 
    FROM submissions 
    WHERE user_id = p_user_id AND status = 'approved';

    SELECT COUNT(*) INTO v_pending 
    FROM submissions 
    WHERE user_id = p_user_id AND status = 'pending';

    RETURN jsonb_build_object(
        'completed_tasks', v_completed,
        'pending_tasks', v_pending,
        'total_earned', v_total_earned,
        'wallet_balance', v_balance
    );
END;
$$;

-- 4. Revoke public execute from anonymous callers
REVOKE EXECUTE ON FUNCTION public.claim_daily_reward FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_task_stats FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_task_stats TO authenticated, service_role;
