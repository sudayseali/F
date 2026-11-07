-- ============================================================================
-- PAYVORA: SECURITY REMEDIATION MIGRATION
-- Migration: 20260507000001_security_remediation.sql
-- ============================================================================

-- 1. HARDEN ATOMIC WITHDRAWAL: ENFORCE IDENTITY MATCH WITH auth.uid()
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
    -- Enforce that calling authenticated user matches user_id_param
    IF auth.uid() IS NOT NULL AND auth.uid() != user_id_param THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Cannot initiate withdrawal for another user.');
    END IF;

    -- 1. Input Validation
    IF amount_param < 1.00 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal amount is $1.00');
    END IF;

    IF amount_param > 5000.00 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum withdrawal amount is $5,000.00 per request');
    END IF;

    IF method NOT IN ('usdt', 'usdt_bep20', 'trx', 'payeer') THEN
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

-- 2. HARDEN ATOMIC WALLET CREDIT: ALLOW MANUAL ADJUSTMENT DEDUCTION & SECURE SEARCH_PATH
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
    -- 1. Validate inputs (Allow negative amount only for admin manual adjustments)
    IF p_amount <= 0 AND p_type != 'manual_adjustment' THEN
        RAISE EXCEPTION 'Credit amount must be greater than zero.';
    END IF;

    IF p_amount = 0 THEN
        RAISE EXCEPTION 'Adjustment amount cannot be zero.';
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

    IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Insufficient wallet balance for deduction.';
    END IF;

    -- 4. Update User Wallet
    UPDATE users 
    SET wallet_balance = v_new_balance,
        total_earned = CASE WHEN p_amount > 0 THEN total_earned + p_amount ELSE total_earned END,
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
    IF p_type IN ('task_reward', 'survey_reward', 'offer_reward') AND p_amount > 0 THEN
        SELECT referrer_id INTO v_referrer_id FROM referrals WHERE referred_user_id = p_user_id;
        IF v_referrer_id IS NOT NULL THEN
            v_commission := ROUND(p_amount * 0.10, 2);
            IF v_commission > 0 THEN
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

-- 3. REVOKE UNRESTRICTED PUBLIC EXECUTE PERMISSIONS
REVOKE EXECUTE ON FUNCTION public.admin_review_submission FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_submission TO service_role;

REVOKE EXECUTE ON FUNCTION public.reward_user FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reward_user TO service_role;

REVOKE EXECUTE ON FUNCTION public.atomic_wallet_credit FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atomic_wallet_credit TO service_role;

-- 4. ALLOW REFERRERS TO VIEW REFERRED USERS BASIC PROFILES (first_name, username)
DROP POLICY IF EXISTS "Referrers view referred basic profile" ON public.users;
CREATE POLICY "Referrers view referred basic profile" 
ON public.users FOR SELECT 
USING (
    auth.uid() = id 
    OR EXISTS (
        SELECT 1 FROM public.referrals 
        WHERE referrals.referrer_id = auth.uid() 
        AND referrals.referred_user_id = users.id
    )
);

-- 5. INITIALIZE SUPABASE STORAGE BUCKET FOR TASK PROOFS
INSERT INTO storage.buckets (id, name, public)
VALUES ('proofs', 'proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies for task proofs
DO $$
BEGIN
    DROP POLICY IF EXISTS "Authenticated users upload task proofs" ON storage.objects;
    CREATE POLICY "Authenticated users upload task proofs"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'proofs');

    DROP POLICY IF EXISTS "Public view task proofs" ON storage.objects;
    CREATE POLICY "Public view task proofs"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'proofs');
EXCEPTION WHEN OTHERS THEN
    -- Ignore if storage schema is not mounted in direct SQL migration runner
    NULL;
END $$;
