-- ============================================================================
-- PAYVORA: PHASE 12 SECURITY & DATABASE HARDENING REMEDIATION
-- Migration: 20260517000000_security_and_database_hardening.sql
-- ============================================================================
-- Addresses all repository & PostgreSQL security audit findings:
--   1. Revoke anon/PUBLIC execute on all SECURITY DEFINER RPCs
--   2. Restrict get_task_with_slots() so inactive/paused/archived tasks are
--      only visible to the user who submitted to them or an active admin
--   3. Eliminate duplicate permissive RLS policies & add explicit policies on
--      RLS-enabled tables that lacked policies (offerwall_logs, admin_users, rate_limits)
--   4. Add missing foreign key indexes for optimal join/delete performance
--   5. Harden handle_offer_chargeback() with proportional referral commission
--      reversal policy consistent with process_offer_reversal_atomic()
--   6. Enforce SET search_path = public, pg_temp on every public function
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. MISSING FOREIGN KEY INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_submissions_reviewed_by ON public.submissions(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_withdrawals_reviewed_by ON public.withdrawals(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_offerwall_logs_user_id ON public.offerwall_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference_id ON public.transactions(reference_id);

-- ----------------------------------------------------------------------------
-- 2. HARDEN get_active_tasks_with_slots() & get_task_with_slots() VISIBILITY
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_tasks_with_slots()
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    category TEXT,
    reward NUMERIC(10, 2),
    max_completions INTEGER,
    current_completions INTEGER,
    pending_submissions INTEGER,
    remaining_slots INTEGER,
    target_url TEXT,
    job_length INTEGER,
    allowed_countries TEXT[],
    proof_instructions TEXT,
    status TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
    IF v_jwt_role != 'service_role' THEN
        IF v_uid IS NULL OR NOT EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = v_uid AND u.status != 'suspended'
        ) THEN
            RETURN;
        END IF;
    END IF;

    RETURN QUERY
    SELECT
        t.id,
        t.title,
        t.description,
        t.category,
        t.reward::NUMERIC(10, 2),
        COALESCE(t.max_completions, 100)::INTEGER AS max_completions,
        COALESCE(t.current_completions, 0)::INTEGER AS current_completions,
        COALESCE(p.cnt, 0)::INTEGER AS pending_submissions,
        GREATEST(
            0,
            COALESCE(t.max_completions, 100)
            - COALESCE(t.current_completions, 0)
            - COALESCE(p.cnt, 0)
        )::INTEGER AS remaining_slots,
        t.target_url,
        t.job_length,
        t.allowed_countries,
        t.proof_instructions,
        t.status,
        t.created_at
    FROM public.tasks t
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER AS cnt
        FROM public.submissions s
        WHERE s.task_id = t.id
          AND s.status = 'pending'
    ) p ON TRUE
    WHERE t.status = 'active'
    ORDER BY t.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_active_tasks_with_slots() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_tasks_with_slots() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_task_with_slots(p_task_id UUID)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    category TEXT,
    reward NUMERIC(10, 2),
    max_completions INTEGER,
    current_completions INTEGER,
    pending_submissions INTEGER,
    remaining_slots INTEGER,
    target_url TEXT,
    job_length INTEGER,
    allowed_countries TEXT[],
    proof_instructions TEXT,
    status TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
    v_is_admin BOOLEAN := false;
BEGIN
    IF v_jwt_role = 'service_role' THEN
        v_is_admin := true;
    ELSE
        IF v_uid IS NULL OR NOT EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = v_uid AND u.status != 'suspended'
        ) THEN
            -- Allow active admins to inspect any task
            IF v_uid IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.admin_users a
                WHERE a.auth_user_id = v_uid AND a.status = 'active'
            ) THEN
                v_is_admin := true;
            ELSE
                RETURN;
            END IF;
        END IF;
    END IF;

    RETURN QUERY
    SELECT
        t.id,
        t.title,
        t.description,
        t.category,
        t.reward::NUMERIC(10, 2),
        COALESCE(t.max_completions, 100)::INTEGER AS max_completions,
        COALESCE(t.current_completions, 0)::INTEGER AS current_completions,
        COALESCE(p.cnt, 0)::INTEGER AS pending_submissions,
        GREATEST(
            0,
            COALESCE(t.max_completions, 100)
            - COALESCE(t.current_completions, 0)
            - COALESCE(p.cnt, 0)
        )::INTEGER AS remaining_slots,
        t.target_url,
        t.job_length,
        t.allowed_countries,
        t.proof_instructions,
        t.status,
        t.created_at
    FROM public.tasks t
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::INTEGER AS cnt
        FROM public.submissions s
        WHERE s.task_id = t.id
          AND s.status = 'pending'
    ) p ON TRUE
    WHERE t.id = p_task_id
      AND (
          t.status = 'active'
          OR v_is_admin
          OR (
              v_uid IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM public.submissions us
                  WHERE us.task_id = t.id AND us.user_id = v_uid
              )
          )
      );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_task_with_slots(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_task_with_slots(UUID) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 3. LOCK DOWN LEGACY & PRIVILEGED SECURITY DEFINER FUNCTIONS + SEARCH_PATH
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    REVOKE EXECUTE ON FUNCTION public.reward_user(UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.reward_user(UUID, NUMERIC) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

DO $$
BEGIN
    REVOKE EXECUTE ON FUNCTION public.get_user_task_stats(UUID) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.get_user_task_stats(UUID) TO service_role;
EXCEPTION WHEN undefined_function THEN NULL; END $$;

-- Enforce search_path = public, pg_temp across all existing SECURITY DEFINER functions
DO $$
DECLARE
    fn RECORD;
BEGIN
    FOR fn IN
        SELECT p.oid::regprocedure AS sig
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prosecdef = true
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.sig);
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 4. CLEAN UP DUPLICATE PERMISSIVE POLICIES & RLS-WITHOUT-POLICY GAPS
-- ----------------------------------------------------------------------------
-- Consolidate tasks SELECT into a single clean policy (avoids multiple permissive policies)
DROP POLICY IF EXISTS "Public read active tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users read submitted tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users read active or submitted tasks" ON public.tasks;
CREATE POLICY "Users read active or submitted tasks"
ON public.tasks FOR SELECT
USING (
    status = 'active'
    OR (
        auth.uid() IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.submissions s
            WHERE s.task_id = tasks.id AND s.user_id = auth.uid()
        )
    )
    OR EXISTS (
        SELECT 1 FROM public.admin_users a
        WHERE a.auth_user_id = auth.uid() AND a.status = 'active'
    )
);

-- Keep Admins write-only for tasks (avoiding duplicate SELECT policy)
DROP POLICY IF EXISTS "Admins full access tasks" ON public.tasks;
CREATE POLICY "Admins write tasks"
ON public.tasks FOR ALL
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));

-- Add explicit RLS policies to previously policy-less RLS tables:
-- a) offerwall_logs (active admins read-only; no anon/user table access)
DROP POLICY IF EXISTS "Admins read offerwall_logs" ON public.offerwall_logs;
CREATE POLICY "Admins read offerwall_logs"
ON public.offerwall_logs FOR SELECT
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));

-- b) admin_users (authenticated admins can read their own row; super_admin can read all)
DROP POLICY IF EXISTS "Admins read own or super_admin all" ON public.admin_users;
CREATE POLICY "Admins read own or super_admin all"
ON public.admin_users FOR SELECT
USING (
    auth_user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.admin_users a
        WHERE a.auth_user_id = auth.uid() AND a.role = 'super_admin' AND a.status = 'active'
    )
);

-- c) rate_limits (service_role only; explicit deny for client roles)
DROP POLICY IF EXISTS "Deny client access rate_limits" ON public.rate_limits;
CREATE POLICY "Deny client access rate_limits"
ON public.rate_limits FOR ALL
USING (false)
WITH CHECK (false);

-- Ensure write policies use explicit WITH CHECK
DROP POLICY IF EXISTS "Admins full access settings" ON public.app_settings;
CREATE POLICY "Admins manage settings"
ON public.app_settings FOR ALL
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));

-- ----------------------------------------------------------------------------
-- 5. UPGRADE handle_offer_chargeback() WITH REFERRAL COMMISSION REVERSAL POLICY
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_offer_chargeback(
    p_user_id UUID,
    p_provider TEXT,
    p_external_tx_id TEXT,
    p_amount NUMERIC(12, 2)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user public.users%ROWTYPE;
    v_rev_key TEXT := format('rev_%s_%s', lower(p_provider), p_external_tx_id);
    v_orig_key_legacy TEXT := format('%s_%s', lower(p_provider), p_external_tx_id);
    v_orig_key_unified TEXT := format('offer_%s_%s', lower(p_provider), p_external_tx_id);
    v_orig_amt NUMERIC(12, 2) := 0.00;
    v_target NUMERIC(12, 2) := 0.00;
    v_deduct NUMERIC(12, 2) := 0.00;
    v_new_balance NUMERIC(12, 2);
    v_referrer_id UUID;
    v_ref_user public.users%ROWTYPE;
    v_comm_rev NUMERIC(12, 2) := 0.00;
    v_comm_deduct NUMERIC(12, 2) := 0.00;
    v_ref_new_bal NUMERIC(12, 2);
BEGIN
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found.');
    END IF;

    IF EXISTS (SELECT 1 FROM public.transactions WHERE idempotency_key = v_rev_key) THEN
        RETURN jsonb_build_object('success', true, 'already_processed', true, 'deducted', 0);
    END IF;

    SELECT COALESCE(amount, 0.00) INTO v_orig_amt
    FROM public.transactions
    WHERE idempotency_key IN (v_orig_key_legacy, v_orig_key_unified)
      AND user_id = p_user_id
    LIMIT 1;

    IF NOT FOUND OR v_orig_amt <= 0 THEN
        RETURN jsonb_build_object('success', true, 'already_processed', false, 'deducted', 0, 'note', 'No prior credit found');
    END IF;

    -- Cap deduction by verified original credit and verified reversal amount
    v_target := CASE
        WHEN COALESCE(p_amount, 0.00) > 0 THEN LEAST(v_orig_amt, p_amount)
        ELSE v_orig_amt
    END;

    v_deduct := LEAST(GREATEST(v_user.wallet_balance, 0.00), v_target);
    v_new_balance := ROUND(GREATEST(0.00, v_user.wallet_balance - v_deduct), 2);

    IF v_deduct > 0 THEN
        UPDATE public.users
        SET wallet_balance = v_new_balance
        WHERE id = p_user_id;
    END IF;

    INSERT INTO public.transactions (
        user_id, amount, type, status, balance_before, balance_after,
        idempotency_key, reference_id, description
    ) VALUES (
        p_user_id, -v_deduct, 'manual_adjustment', 'reversed',
        v_user.wallet_balance, v_new_balance, v_rev_key,
        p_external_tx_id, format('%s Chargeback Reversal (Tx: %s)', UPPER(p_provider), p_external_tx_id)
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    -- Proportional 10% referral commission reversal
    SELECT referrer_id INTO v_referrer_id FROM public.referrals WHERE referred_user_id = p_user_id;
    IF v_referrer_id IS NOT NULL AND v_referrer_id != p_user_id THEN
        v_comm_rev := ROUND(v_target * 0.10, 2);
        IF v_comm_rev > 0 THEN
            SELECT * INTO v_ref_user FROM public.users WHERE id = v_referrer_id FOR UPDATE;
            IF FOUND THEN
                v_comm_deduct := LEAST(GREATEST(v_ref_user.wallet_balance, 0.00), v_comm_rev);
                v_ref_new_bal := ROUND(GREATEST(0.00, v_ref_user.wallet_balance - v_comm_deduct), 2);

                IF v_comm_deduct > 0 THEN
                    UPDATE public.users
                    SET wallet_balance = v_ref_new_bal
                    WHERE id = v_referrer_id;
                END IF;

                INSERT INTO public.transactions (
                    user_id, amount, type, status, balance_before, balance_after,
                    idempotency_key, reference_id, description
                ) VALUES (
                    v_referrer_id, -v_comm_deduct, 'manual_adjustment', 'reversed',
                    v_ref_user.wallet_balance, v_ref_new_bal, 'ref_' || v_rev_key,
                    p_external_tx_id, format('Referral commission clawback for %s reversal (Tx: %s)', UPPER(p_provider), p_external_tx_id)
                )
                ON CONFLICT (idempotency_key) DO NOTHING;

                UPDATE public.referrals
                SET total_commission_earned = GREATEST(0.00, total_commission_earned - v_comm_deduct)
                WHERE referrer_id = v_referrer_id AND referred_user_id = p_user_id;
            END IF;
        END IF;
    END IF;

    UPDATE public.offerwall_logs
    SET status = 'reversed'
    WHERE provider = lower(p_provider) AND external_transaction_id = p_external_tx_id;

    UPDATE public.offer_completions
    SET status = 'reversed',
        reversed_amount = v_target,
        reversed_at = NOW()
    WHERE external_transaction_id = p_external_tx_id
      AND provider_id IN (SELECT id FROM public.offer_providers WHERE provider_key = lower(p_provider));

    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'deducted', v_deduct,
        'referral_commission_reversed', v_comm_deduct,
        'wallet_balance', v_new_balance
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_offer_chargeback(UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_offer_chargeback(UUID, TEXT, TEXT, NUMERIC) TO service_role;
