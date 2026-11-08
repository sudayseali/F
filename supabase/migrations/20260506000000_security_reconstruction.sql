-- ============================================================================
-- PAYVORA: COMPLETE BACKEND SECURITY RECONSTRUCTION & ADMIN SEPARATION
-- Migration: 20260506000000_security_reconstruction.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. APPLICATION SETTINGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO public.app_settings (key, value, description)
VALUES 
    ('payout_config', '{"min_withdrawal": 1.00, "withdrawals_enabled": true, "supported_methods": ["usdt", "trx", "payeer"]}'::jsonb, 'Withdrawal controls'),
    ('referral_config', '{"commission_percent": 10.0, "active": true}'::jsonb, 'Referral system parameters'),
    ('anti_fraud_config', '{"vpn_detection_enabled": true, "max_daily_withdrawals": 3}'::jsonb, 'Fraud prevention controls')
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. ADMINISTRATOR ACCOUNTS & RBAC TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL DEFAULT 'moderator' CHECK (role IN ('super_admin', 'finance_admin', 'moderator')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_auth ON public.admin_users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);

-- ----------------------------------------------------------------------------
-- 3. AUDIT LOGS TABLE (IMMUTABLE LOGGING)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'user', 'system', 'offerwall')),
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. USERS TABLE (TELEGRAM USER PROFILES & WALLETS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (wallet_balance >= 0.00),
    total_earned NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_earned >= 0.00),
    total_withdrawn NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_withdrawn >= 0.00),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist if table was already created in earlier migration
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'balance'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'wallet_balance'
    ) THEN
        ALTER TABLE public.users ADD COLUMN wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
        UPDATE public.users SET wallet_balance = balance WHERE balance IS NOT NULL;
    ELSE
        ALTER TABLE public.users ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
    END IF;
END $$;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_earned NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS total_withdrawn NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- ----------------------------------------------------------------------------
-- 5. IMMUTABLE FINANCIAL TRANSACTIONS LEDGER
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'task_reward', 
        'survey_reward', 
        'offer_reward', 
        'referral_commission', 
        'withdrawal_request', 
        'withdrawal_refund', 
        'manual_adjustment'
    )),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'reversed', 'failed')),
    balance_before NUMERIC(12, 2),
    balance_after NUMERIC(12, 2),
    idempotency_key TEXT UNIQUE,
    reference_id TEXT,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist if table was already created in earlier migration
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS idempotency_key TEXT UNIQUE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS balance_before NUMERIC(12, 2);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS balance_after NUMERIC(12, 2);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS reference_id TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_idempotency ON public.transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at DESC);

-- ----------------------------------------------------------------------------
-- 6. WITHDRAWALS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 1.00),
    method TEXT NOT NULL CHECK (method IN ('usdt', 'trx', 'payeer')),
    wallet_address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
    tx_hash TEXT,
    admin_note TEXT,
    reviewed_by UUID REFERENCES public.admin_users(id),
    reviewed_at TIMESTAMPTZ,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Ensure columns exist if table was already created in earlier migration
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'withdrawals' 
        AND column_name = 'payment_details'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'withdrawals' 
        AND column_name = 'wallet_address'
    ) THEN
        ALTER TABLE public.withdrawals RENAME COLUMN payment_details TO wallet_address;
    ELSE
        ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS wallet_address TEXT;
    END IF;
END $$;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS tx_hash TEXT;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS admin_note TEXT;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_requested_at ON public.withdrawals(requested_at DESC);

-- ----------------------------------------------------------------------------
-- 7. TASKS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Other',
    reward NUMERIC(10, 2) NOT NULL CHECK (reward > 0.00),
    max_completions INTEGER NOT NULL DEFAULT 100 CHECK (max_completions > 0),
    current_completions INTEGER NOT NULL DEFAULT 0 CHECK (current_completions >= 0),
    target_url TEXT,
    job_length INTEGER DEFAULT 5,
    allowed_countries TEXT[] DEFAULT '{"International"}',
    proof_instructions TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist if table was already created in earlier migration
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Other';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS job_length INTEGER DEFAULT 5;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS max_completions INTEGER DEFAULT 100;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS current_completions INTEGER DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS target_url TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS proof_instructions TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS allowed_countries TEXT[] DEFAULT '{"International"}';

CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);

-- ----------------------------------------------------------------------------
-- 8. TASK SUBMISSIONS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    proof_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_comment TEXT,
    reviewed_by UUID REFERENCES public.admin_users(id),
    reviewed_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_task_user_submission UNIQUE (task_id, user_id)
);

-- Ensure columns exist if table was already created in earlier migration
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'submissions' 
        AND column_name = 'worker_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'submissions' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.submissions RENAME COLUMN worker_id TO user_id;
    ELSE
        ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE RESTRICT;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'submissions' 
        AND column_name = 'proof'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'submissions' 
        AND column_name = 'proof_text'
    ) THEN
        ALTER TABLE public.submissions RENAME COLUMN proof TO proof_text;
    ELSE
        ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS proof_text TEXT;
    END IF;
END $$;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS admin_comment TEXT;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS reviewed_by UUID;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_task_id ON public.submissions(task_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);

-- ----------------------------------------------------------------------------
-- 9. REFERRALS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    referred_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT UNIQUE,
    total_commission_earned NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_commission_earned >= 0.00),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_no_self_referral CHECK (referrer_id != referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON public.referrals(referrer_id);

-- ----------------------------------------------------------------------------
-- 10. OFFERWALL POSTBACK LOGS (REPLAY DEFENSE)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offerwall_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider TEXT NOT NULL,
    external_transaction_id TEXT NOT NULL,
    user_id UUID REFERENCES public.users(id),
    amount NUMERIC(12, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'credited',
    raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_provider_external_tx UNIQUE (provider, external_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_offerwall_logs_lookup ON public.offerwall_logs(provider, external_transaction_id);

-- ============================================================================
-- ATOMIC STORED PROCEDURES (ROW-LEVEL LOCKING & FINANCIAL INTEGRITY)
-- ============================================================================

-- Function: Atomic Wallet Credit with Idempotency & Referral Commission
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
SET search_path = public
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

    -- 2. Idempotency Check: Prevent double crediting
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

-- Function: Secure Withdrawal Request (Atomically reserves balance)
CREATE OR REPLACE FUNCTION public.request_withdrawal(
    user_id_param UUID,
    amount_param NUMERIC(12, 2),
    method TEXT,
    wallet_address TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user users%ROWTYPE;
    v_new_balance NUMERIC(12, 2);
    v_withdrawal_id UUID;
BEGIN
    -- 1. Input Validation
    IF amount_param < 1.00 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal amount is $1.00');
    END IF;

    IF method NOT IN ('usdt', 'trx', 'payeer') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid payment method.');
    END IF;

    -- 2. Lock User Row FOR UPDATE
    SELECT * INTO v_user FROM users WHERE id = user_id_param FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found.');
    END IF;

    IF v_user.status = 'suspended' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account is suspended.');
    END IF;

    IF v_user.wallet_balance < amount_param THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient wallet balance.');
    END IF;

    v_new_balance := v_user.wallet_balance - amount_param;

    -- 3. Atomically Deduct Balance
    UPDATE users 
    SET wallet_balance = v_new_balance,
        last_active_at = NOW()
    WHERE id = user_id_param;

    -- 4. Record Pending Withdrawal
    INSERT INTO withdrawals (
        user_id, amount, method, wallet_address, status
    ) VALUES (
        user_id_param, amount_param, method, wallet_address, 'pending'
    ) RETURNING id INTO v_withdrawal_id;

    -- 5. Record Financial Ledger Transaction
    INSERT INTO transactions (
        user_id, amount, type, status, balance_before, balance_after, reference_id, description
    ) VALUES (
        user_id_param, -amount_param, 'withdrawal_request', 'pending', v_user.wallet_balance, v_new_balance,
        v_withdrawal_id::text, format('Withdrawal request via %s to %s', UPPER(method), wallet_address)
    );

    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_withdrawal_id,
        'new_balance', v_new_balance
    );
END;
$$;

-- Function: Admin Approve Withdrawal
CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(
    p_admin_id UUID,
    p_withdrawal_id UUID,
    p_tx_hash TEXT DEFAULT NULL,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Function: Admin Reject Withdrawal (With Automatic Balance Refund)
CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(
    p_admin_id UUID,
    p_withdrawal_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Function: Admin Review Task Submission
CREATE OR REPLACE FUNCTION public.admin_review_submission(
    p_admin_id UUID,
    p_submission_id UUID,
    p_decision TEXT, -- 'approved' | 'rejected'
    p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_submission submissions%ROWTYPE;
    v_task tasks%ROWTYPE;
BEGIN
    SELECT * INTO v_submission FROM submissions WHERE id = p_submission_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Submission not found.');
    END IF;

    IF v_submission.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Submission is already reviewed.');
    END IF;

    SELECT * INTO v_task FROM tasks WHERE id = v_submission.task_id FOR UPDATE;

    IF p_decision = 'approved' THEN
        -- 1. Mark submission approved
        UPDATE submissions 
        SET status = 'approved',
            admin_comment = p_comment,
            reviewed_by = p_admin_id,
            reviewed_at = NOW()
        WHERE id = p_submission_id;

        -- 2. Increment task completions
        UPDATE tasks 
        SET current_completions = current_completions + 1,
            status = CASE WHEN current_completions + 1 >= max_completions THEN 'completed' ELSE status END
        WHERE id = v_submission.task_id;

        -- 3. Credit user atomically using idempotency key
        PERFORM atomic_wallet_credit(
            v_submission.user_id,
            v_task.reward,
            'task_reward',
            format('sub_%s', p_submission_id),
            p_submission_id::text,
            format('Task completed: %s', v_task.title)
        );

        -- Audit log
        INSERT INTO audit_logs (actor_id, actor_type, action, target_type, target_id, details)
        VALUES (p_admin_id, 'admin', 'task_submission_approved', 'submission', p_submission_id::text, 
                jsonb_build_object('reward', v_task.reward, 'user_id', v_submission.user_id));

        RETURN jsonb_build_object('success', true, 'status', 'approved', 'reward_credited', v_task.reward);

    ELSIF p_decision = 'rejected' THEN
        UPDATE submissions 
        SET status = 'rejected',
            admin_comment = p_comment,
            reviewed_by = p_admin_id,
            reviewed_at = NOW()
        WHERE id = p_submission_id;

        INSERT INTO audit_logs (actor_id, actor_type, action, target_type, target_id, details)
        VALUES (p_admin_id, 'admin', 'task_submission_rejected', 'submission', p_submission_id::text, 
                jsonb_build_object('reason', p_comment, 'user_id', v_submission.user_id));

        RETURN jsonb_build_object('success', true, 'status', 'rejected');
    ELSE
        RETURN jsonb_build_object('success', false, 'error', 'Invalid decision (must be approved or rejected).');
    END IF;
END;
$$;

-- Function: Backward-compatible reward_user wrapper
CREATE OR REPLACE FUNCTION public.reward_user(user_id UUID, amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM atomic_wallet_credit(
        user_id,
        amount,
        'task_reward',
        format('reward_%s_%s', user_id, extract(epoch from now())),
        NULL,
        'Reward credited'
    );
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS across all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offerwall_logs ENABLE ROW LEVEL SECURITY;

-- Drop all old insecure policies
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- 1. Tasks: Public users can only read active tasks
CREATE POLICY "Public read active tasks" 
ON public.tasks FOR SELECT 
USING (status = 'active');

-- 2. Users Table: Read only own profile; NO public update of balance
CREATE POLICY "Users read own profile" 
ON public.users FOR SELECT 
USING (auth.uid() = id);

-- 3. Transactions: Users read only their own financial history
CREATE POLICY "Users read own transactions" 
ON public.transactions FOR SELECT 
USING (auth.uid() = user_id);

-- 4. Withdrawals: Users read only their own withdrawal requests
CREATE POLICY "Users read own withdrawals" 
ON public.withdrawals FOR SELECT 
USING (auth.uid() = user_id);

-- 5. Submissions: Users read only their own task submissions
CREATE POLICY "Users read own submissions" 
ON public.submissions FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users insert own submissions" 
ON public.submissions FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 6. Referrals: Users read only referrals where they are the referrer
CREATE POLICY "Users read own referrals" 
ON public.referrals FOR SELECT 
USING (auth.uid() = referrer_id);

-- 7. App Settings: Public read-only
CREATE POLICY "Public read app settings" 
ON public.app_settings FOR SELECT 
USING (true);

-- 8. Full Administrator Access via JWT Role Check
-- Administrators authenticated through Supabase Auth can manage records
CREATE POLICY "Admins full access users" 
ON public.users FOR ALL 
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Admins full access transactions" 
ON public.transactions FOR ALL 
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Admins full access withdrawals" 
ON public.withdrawals FOR ALL 
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Admins full access tasks" 
ON public.tasks FOR ALL 
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Admins full access submissions" 
ON public.submissions FOR ALL 
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Admins full access referrals" 
ON public.referrals FOR ALL 
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Admins full access settings" 
ON public.app_settings FOR ALL 
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));

CREATE POLICY "Admins read audit logs" 
ON public.audit_logs FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));
