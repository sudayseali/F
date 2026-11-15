-- ============================================================================
-- PAYVORA: COMPLETE SECURITY REMEDIATION & SCHEMA DRIFT SYNCHRONIZATION
-- Migration: 20260508000000_audit_remediation_and_schema_sync.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ENABLE RLS ON public.rate_limits (NO PUBLIC/ANON/AUTHENTICATED POLICIES)
-- ----------------------------------------------------------------------------
ALTER TABLE IF EXISTS public.rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'rate_limits'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.rate_limits', r.policyname);
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 2. SCHEMA RECONCILIATION (LEGACY VS RECONSTRUCTED SCHEMA COMPATIBILITY)
-- ----------------------------------------------------------------------------

-- 2a. Withdrawals: allow usdt_bep20 alongside usdt, trx, payeer
DO $$
BEGIN
    ALTER TABLE public.withdrawals DROP CONSTRAINT IF EXISTS withdrawals_method_check;
    ALTER TABLE public.withdrawals
        ADD CONSTRAINT withdrawals_method_check
        CHECK (method IN ('usdt', 'usdt_bep20', 'trx', 'payeer'));
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 2b. Users: enforce non-negative wallet_balance constraint if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.users'::regclass
        AND conname = 'users_wallet_balance_nonnegative'
    ) THEN
        ALTER TABLE public.users
            ADD CONSTRAINT users_wallet_balance_nonnegative
            CHECK (wallet_balance >= 0.00);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 2c. Submissions: drop NOT NULL on legacy proof_data / proof / worker_id columns
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'proof_data'
    ) THEN
        UPDATE public.submissions SET proof_text = proof_data WHERE proof_text IS NULL AND proof_data IS NOT NULL;
        ALTER TABLE public.submissions ALTER COLUMN proof_data DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'proof'
    ) THEN
        UPDATE public.submissions SET proof_text = proof WHERE proof_text IS NULL AND proof IS NOT NULL;
        ALTER TABLE public.submissions ALTER COLUMN proof DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'submissions' AND column_name = 'worker_id'
    ) THEN
        UPDATE public.submissions SET user_id = worker_id WHERE user_id IS NULL AND worker_id IS NOT NULL;
        ALTER TABLE public.submissions ALTER COLUMN worker_id DROP NOT NULL;
    END IF;
END $$;

-- 2d. Tasks: drop NOT NULL on legacy columns (slots, proof_type, advertiser_id)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'slots'
    ) THEN
        UPDATE public.tasks SET max_completions = slots WHERE max_completions IS NULL AND slots IS NOT NULL;
        ALTER TABLE public.tasks ALTER COLUMN slots DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'proof_type'
    ) THEN
        ALTER TABLE public.tasks ALTER COLUMN proof_type DROP NOT NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'advertiser_id'
    ) THEN
        ALTER TABLE public.tasks ALTER COLUMN advertiser_id DROP NOT NULL;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. HARDEN request_withdrawal IDENTITY CHECK & SEARCH_PATH
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
    v_jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
    -- Defense-in-depth: Only service_role or matching authenticated owner may execute
    IF v_jwt_role != 'service_role' AND auth.uid() IS DISTINCT FROM user_id_param THEN
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

-- ----------------------------------------------------------------------------
-- 4. REVOKE EXECUTE ON ALL PRIVILEGED & LEGACY RPCs FROM PUBLIC/ANON/AUTH
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    REVOKE EXECUTE ON FUNCTION public.request_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.request_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
    REVOKE EXECUTE ON FUNCTION public.request_withdrawal(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.request_withdrawal(UUID, NUMERIC, TEXT, TEXT) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
    REVOKE EXECUTE ON FUNCTION public.atomic_wallet_credit(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.atomic_wallet_credit(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
    REVOKE EXECUTE ON FUNCTION public.check_distributed_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.check_distributed_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
    REVOKE EXECUTE ON FUNCTION public.approve_deposit(UUID) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.approve_deposit(UUID) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
    REVOKE EXECUTE ON FUNCTION public.request_deposit(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.request_deposit(UUID, NUMERIC, TEXT, TEXT) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
    REVOKE EXECUTE ON FUNCTION public.submit_task_proof(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.submit_task_proof(UUID, UUID, TEXT, TEXT) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$ BEGIN
    REVOKE EXECUTE ON FUNCTION public.approve_submission_and_reward(UUID, UUID) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.approve_submission_and_reward(UUID, UUID) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 5. STORAGE BUCKET: REQUIRE AUTHENTICATED OWNER FOLDER + IMAGE EXTENSION ONLY
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    DROP POLICY IF EXISTS "Authenticated users upload task proofs" ON storage.objects;
    CREATE POLICY "Authenticated users upload task proofs"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'proofs'
        AND auth.role() = 'authenticated'
        AND auth.uid() IS NOT NULL
        AND (storage.foldername(name))[1] = auth.uid()::text
        AND (
            LOWER(RIGHT(name, 4)) IN ('.png', '.jpg')
            OR LOWER(RIGHT(name, 5)) IN ('.jpeg', '.webp')
        )
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
