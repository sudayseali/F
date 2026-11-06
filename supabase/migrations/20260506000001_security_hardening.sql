-- ============================================================================
-- PAYVORA: COMPLETE SECURITY HARDENING & RATE LIMITING
-- Migration: 20260506000001_security_hardening.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXPAND ADMINISTRATOR ROLES TO SUPPORT REQUIRED ROLE HIERARCHY
-- ----------------------------------------------------------------------------
ALTER TABLE public.admin_users 
DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE public.admin_users 
ADD CONSTRAINT admin_users_role_check 
CHECK (role IN ('super_admin', 'admin', 'finance_admin', 'finance', 'moderator', 'support'));

-- ----------------------------------------------------------------------------
-- 2. DISTRIBUTED RATE LIMITS TABLE & ATOMIC PROCEDURE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits(window_start);

CREATE OR REPLACE FUNCTION public.check_distributed_rate_limit(
    p_key TEXT,
    p_max_requests INTEGER,
    p_window_seconds INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_count INTEGER;
    v_start TIMESTAMPTZ;
    v_now TIMESTAMPTZ := NOW();
    v_window INTERVAL := (p_window_seconds || ' seconds')::INTERVAL;
BEGIN
    INSERT INTO public.rate_limits (key, count, window_start)
    VALUES (p_key, 1, v_now)
    ON CONFLICT (key) DO UPDATE
    SET count = CASE 
            WHEN rate_limits.window_start + v_window < EXCLUDED.window_start THEN 1
            ELSE rate_limits.count + 1 
        END,
        window_start = CASE 
            WHEN rate_limits.window_start + v_window < EXCLUDED.window_start THEN EXCLUDED.window_start
            ELSE rate_limits.window_start 
        END
    RETURNING count, window_start INTO v_count, v_start;

    IF v_count > p_max_requests THEN
        RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'count', v_count);
    ELSE
        RETURN jsonb_build_object('allowed', true, 'remaining', GREATEST(0, p_max_requests - v_count), 'count', v_count);
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. HARDENED ATOMIC WITHDRAWAL REQUEST WITH DUPLICATE PREVENTION & SAFE SEARCH_PATH
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_withdrawal(
    user_id_param UUID,
    amount_param NUMERIC(12, 2),
    method TEXT,
    wallet_address TEXT,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user users%ROWTYPE;
    v_new_balance NUMERIC(12, 2);
    v_withdrawal_id UUID;
    v_pending_count INTEGER;
BEGIN
    -- 1. Input Validation
    IF amount_param < 1.00 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal amount is $1.00');
    END IF;

    IF amount_param > 5000.00 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum withdrawal amount is $5,000.00 per request');
    END IF;

    IF method NOT IN ('usdt', 'trx', 'payeer') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid payment method.');
    END IF;

    IF wallet_address IS NULL OR length(trim(wallet_address)) < 4 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid wallet address provided.');
    END IF;

    -- 2. Idempotency Check
    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM transactions WHERE idempotency_key = p_idempotency_key) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Duplicate withdrawal request detected.', 'code', 'DUPLICATE_REQUEST');
        END IF;
    END IF;

    -- 3. Lock User Row FOR UPDATE
    SELECT * INTO v_user FROM users WHERE id = user_id_param FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found.');
    END IF;

    IF v_user.status = 'suspended' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account is suspended.');
    END IF;

    -- 4. Prevent Concurrent Duplicate Pending Withdrawals
    SELECT COUNT(*) INTO v_pending_count 
    FROM withdrawals 
    WHERE user_id = user_id_param AND status = 'pending';

    IF v_pending_count > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'An existing pending withdrawal is currently under review.');
    END IF;

    -- 5. Strict Balance Verification Under Lock
    IF v_user.wallet_balance < amount_param THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient wallet balance.');
    END IF;

    v_new_balance := v_user.wallet_balance - amount_param;

    -- 6. Atomically Deduct Balance
    UPDATE users 
    SET wallet_balance = v_new_balance,
        last_active_at = NOW()
    WHERE id = user_id_param;

    -- 7. Record Pending Withdrawal
    INSERT INTO withdrawals (
        user_id, amount, method, wallet_address, status
    ) VALUES (
        user_id_param, amount_param, method, wallet_address, 'pending'
    ) RETURNING id INTO v_withdrawal_id;

    -- 8. Record Financial Ledger Transaction
    INSERT INTO transactions (
        user_id, amount, type, status, balance_before, balance_after, idempotency_key, reference_id, description
    ) VALUES (
        user_id_param, -amount_param, 'withdrawal_request', 'pending', v_user.wallet_balance, v_new_balance,
        COALESCE(p_idempotency_key, 'wd_' || v_withdrawal_id::text),
        v_withdrawal_id::text, 
        format('Withdrawal request via %s to %s', UPPER(method), wallet_address)
    );

    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_withdrawal_id,
        'new_balance', v_new_balance
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. HARDENED ATOMIC WALLET CREDIT WITH SEARCH_PATH PROTECTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_wallet_credit(
    p_user_id UUID,
    p_amount NUMERIC(12, 2),
    p_type TEXT,
    p_idempotency_key TEXT,
    p_reference_id TEXT DEFAULT NULL,
    p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user users%ROWTYPE;
    v_new_balance NUMERIC(12, 2);
    v_referrer_id UUID;
    v_commission NUMERIC(12, 2);
    v_existing_tx transactions%ROWTYPE;
BEGIN
    -- 1. Validate inputs
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Credit amount must be greater than zero.';
    END IF;

    -- 2. Idempotency Check: Prevent duplicate crediting
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_tx FROM transactions WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN
            SELECT * INTO v_user FROM users WHERE id = p_user_id;
            RETURN jsonb_build_object(
                'success', true,
                'already_processed', true,
                'wallet_balance', v_user.wallet_balance
            );
        END IF;
    END IF;

    -- 3. Lock user row FOR UPDATE
    SELECT * INTO v_user FROM users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found.';
    END IF;

    IF v_user.status = 'suspended' THEN
        RAISE EXCEPTION 'User account is suspended.';
    END IF;

    v_new_balance := v_user.wallet_balance + p_amount;

    -- 4. Update User Wallet
    UPDATE users 
    SET wallet_balance = v_new_balance,
        total_earned = total_earned + p_amount,
        last_active_at = NOW()
    WHERE id = p_user_id;

    -- 5. Record Financial Transaction
    INSERT INTO transactions (
        user_id, amount, type, status, balance_before, balance_after,
        idempotency_key, reference_id, description
    ) VALUES (
        p_user_id, p_amount, p_type, 'completed', v_user.wallet_balance, v_new_balance,
        p_idempotency_key, p_reference_id, p_description
    );

    -- 6. Referral Commission Automation (10%)
    IF p_type IN ('task_reward', 'survey_reward', 'offer_reward') THEN
        SELECT referrer_id INTO v_referrer_id FROM referrals WHERE referred_user_id = p_user_id;
        IF v_referrer_id IS NOT NULL THEN
            v_commission := ROUND(p_amount * 0.10, 2);
            IF v_commission > 0 THEN
                -- Credit Referrer atomically
                UPDATE users 
                SET wallet_balance = wallet_balance + v_commission,
                    total_earned = total_earned + v_commission
                WHERE id = v_referrer_id;

                INSERT INTO transactions (
                    user_id, amount, type, status, reference_id, description
                ) VALUES (
                    v_referrer_id, v_commission, 'referral_commission', 'completed', 
                    p_idempotency_key, '10% referral bonus from invitee activity'
                );

                UPDATE referrals 
                SET total_commission_earned = total_commission_earned + v_commission
                WHERE referrer_id = v_referrer_id AND referred_user_id = p_user_id;
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'credited_amount', p_amount,
        'wallet_balance', v_new_balance
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. HARDENED ADMIN ACTIONS WITH SEARCH_PATH PROTECTION
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
-- 6. REVOKE DIRECT PUBLIC EXECUTION ON PRIVILEGED PROCEDURES
-- ----------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.admin_approve_withdrawal FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reject_withdrawal FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.atomic_wallet_credit FROM PUBLIC, anon;
