-- ============================================================================
-- PAYVORA: RPC SECURITY HARDENING, IDOR PREVENTION & STORAGE ENFORCEMENT
-- Migration: 20260507000002_fix_rpc_idor.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. HARDEN DAILY REWARD: ENFORCE IDENTITY MATCH & RESTRICT TO SERVICE_ROLE
-- ----------------------------------------------------------------------------
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
    -- Security Check: Prevent user from claiming reward on behalf of another user
    IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Identity mismatch.');
    END IF;

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

-- ----------------------------------------------------------------------------
-- 2. HARDEN USER TASK STATS: PREVENT CROSS-USER DATA LEAKAGE
-- ----------------------------------------------------------------------------
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
    -- Security Check: Caller must be the account owner or an active administrator
    IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
        IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active') THEN
            RETURN jsonb_build_object('error', 'Unauthorized: Cross-user access denied.');
        END IF;
    END IF;

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

-- ----------------------------------------------------------------------------
-- 3. HARDEN ADMIN WITHDRAWAL PROCEDURES: VERIFY ACTIVE ADMIN IN DATABASE
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(
    p_admin_id UUID,
    p_withdrawal_id UUID,
    p_tx_hash TEXT DEFAULT NULL,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_withdrawal withdrawals%ROWTYPE;
BEGIN
    -- Database-level Admin Authorization Validation
    IF NOT EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE (id = p_admin_id OR auth_user_id = p_admin_id) 
        AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Administrator account invalid or inactive.');
    END IF;

    SELECT * INTO v_withdrawal FROM withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal request not found.');
    END IF;

    IF v_withdrawal.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal is not in pending status.');
    END IF;

    -- Update withdrawal status
    UPDATE withdrawals
    SET status = 'completed',
        tx_hash = p_tx_hash,
        admin_note = p_note,
        reviewed_by = p_admin_id,
        reviewed_at = NOW(),
        completed_at = NOW()
    WHERE id = p_withdrawal_id;

    -- Update total withdrawn counter
    UPDATE users 
    SET total_withdrawn = total_withdrawn + v_withdrawal.amount
    WHERE id = v_withdrawal.user_id;

    -- Update transaction record status
    UPDATE transactions 
    SET status = 'completed'
    WHERE reference_id = p_withdrawal_id::text;

    -- Audit Log
    INSERT INTO audit_logs (actor_id, actor_type, action, target_type, target_id, details)
    VALUES (p_admin_id, 'admin', 'withdrawal_approved', 'withdrawal', p_withdrawal_id::text, 
            jsonb_build_object('amount', v_withdrawal.amount, 'tx_hash', p_tx_hash));

    RETURN jsonb_build_object('success', true, 'status', 'completed');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(
    p_admin_id UUID,
    p_withdrawal_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_withdrawal withdrawals%ROWTYPE;
    v_user users%ROWTYPE;
    v_new_balance NUMERIC(12, 2);
BEGIN
    -- Database-level Admin Authorization Validation
    IF NOT EXISTS (
        SELECT 1 FROM public.admin_users 
        WHERE (id = p_admin_id OR auth_user_id = p_admin_id) 
        AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Administrator account invalid or inactive.');
    END IF;

    SELECT * INTO v_withdrawal FROM withdrawals WHERE id = p_withdrawal_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Withdrawal request not found.');
    END IF;

    IF v_withdrawal.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only pending withdrawals can be rejected.');
    END IF;

    -- Update withdrawal status
    UPDATE withdrawals
    SET status = 'rejected',
        admin_note = p_reason,
        reviewed_by = p_admin_id,
        reviewed_at = NOW()
    WHERE id = p_withdrawal_id;

    -- Lock user and refund amount atomically
    SELECT * INTO v_user FROM users WHERE id = v_withdrawal.user_id FOR UPDATE;
    v_new_balance := v_user.wallet_balance + v_withdrawal.amount;

    UPDATE users 
    SET wallet_balance = v_new_balance
    WHERE id = v_withdrawal.user_id;

    -- Log transaction refund
    INSERT INTO transactions (
        user_id, amount, type, status, balance_before, balance_after, reference_id, description
    ) VALUES (
        v_withdrawal.user_id, v_withdrawal.amount, 'withdrawal_refund', 'completed',
        v_user.wallet_balance, v_new_balance, p_withdrawal_id::text,
        format('Withdrawal refund: %s', COALESCE(p_reason, 'Rejected by administration'))
    );

    -- Update original transaction
    UPDATE transactions 
    SET status = 'reversed'
    WHERE reference_id = p_withdrawal_id::text AND type = 'withdrawal_request';

    -- Audit Log
    INSERT INTO audit_logs (actor_id, actor_type, action, target_type, target_id, details)
    VALUES (p_admin_id, 'admin', 'withdrawal_rejected', 'withdrawal', p_withdrawal_id::text, 
            jsonb_build_object('amount', v_withdrawal.amount, 'reason', p_reason));

    RETURN jsonb_build_object('success', true, 'status', 'rejected', 'refunded_balance', v_new_balance);
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. REVOKE DIRECT PUBLIC & AUTHENTICATED EXECUTE PERMISSIONS
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.claim_daily_reward FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_approve_withdrawal FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_withdrawal TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_reject_withdrawal FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_withdrawal TO service_role;

-- ----------------------------------------------------------------------------
-- 5. STORAGE BUCKET: RESTRICT PROOF UPLOADS TO IMAGE FORMATS ONLY
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    DROP POLICY IF EXISTS "Authenticated users upload task proofs" ON storage.objects;
    CREATE POLICY "Authenticated users upload task proofs"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'proofs'
        AND (
            LOWER(RIGHT(name, 4)) IN ('.png', '.jpg')
            OR LOWER(RIGHT(name, 5)) IN ('.jpeg', '.webp')
        )
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
