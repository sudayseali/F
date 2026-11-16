-- ============================================================================
-- PAYVORA: COMPREHENSIVE FULL-STACK SECURITY HARDENING
-- Migration: 20260513000000_comprehensive_security_hardening.sql
-- ============================================================================
-- Fixes addressed:
--   1. Block direct client INSERT/UPDATE/DELETE on public.submissions (must go via submit_task Edge Function)
--   2. Enforce non-suspended active user status across all user-facing RLS SELECT policies
--   3. Remove over-broad referrer RLS policy on public.users (leaked wallet_balance/telegram_id/PII)
--      and provide scoped SECURITY DEFINER RPC public.get_my_referrals()
--   4. Harden atomic_wallet_credit: lock user row BEFORE idempotency lookup, handle unique_violation,
--      lock/update referrer atomically with complete ledger columns & active check
--   5. Add atomic task slot reservation RPC submit_task_atomic() + quota guard in admin_review_submission()
--   6. Add handle_offer_chargeback() RPC for offerwall/survey reversals (CPX status=2)
--   7. Add get_admin_dashboard_aggregates() SQL aggregation RPC (prevents Edge Function OOM DoS)
--   8. Lock down storage.buckets 'proofs' (private bucket, 5MB limit, strict image MIME types,
--      owner-only / admin-only SELECT policy)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SUBMISSIONS: BLOCK DIRECT CLIENT WRITES (MUST USE submit_task EDGE FUNCTION)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users insert own submissions" ON public.submissions;
REVOKE INSERT, UPDATE, DELETE ON public.submissions FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 2. REMOVE REFERRER PII LEAK ON public.users & ENFORCE ACTIVE ACCOUNT ON RLS
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Referrers view referred basic profile" ON public.users;

DROP POLICY IF EXISTS "Users read own profile" ON public.users;
CREATE POLICY "Users read own profile"
ON public.users FOR SELECT
USING (auth.uid() = id AND status != 'suspended');

DROP POLICY IF EXISTS "Users read own transactions" ON public.transactions;
CREATE POLICY "Users read own transactions"
ON public.transactions FOR SELECT
USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status != 'suspended')
);

DROP POLICY IF EXISTS "Users read own withdrawals" ON public.withdrawals;
CREATE POLICY "Users read own withdrawals"
ON public.withdrawals FOR SELECT
USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status != 'suspended')
);

DROP POLICY IF EXISTS "Users read own submissions" ON public.submissions;
CREATE POLICY "Users read own submissions"
ON public.submissions FOR SELECT
USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status != 'suspended')
);

DROP POLICY IF EXISTS "Users read own referrals" ON public.referrals;
CREATE POLICY "Users read own referrals"
ON public.referrals FOR SELECT
USING (
    auth.uid() = referrer_id
    AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status != 'suspended')
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'user_notifications'
    ) THEN
        DROP POLICY IF EXISTS "Users can view own notifications" ON public.user_notifications;
        CREATE POLICY "Users can view own notifications"
        ON public.user_notifications FOR SELECT
        USING (
            auth.uid() = user_id
            AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status != 'suspended')
        );
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. SCOPED REFERRAL PROFILE RPC (ONLY EXPOSES first_name & username)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_referrals()
RETURNS TABLE (
    id UUID,
    referrer_id UUID,
    referred_user_id UUID,
    total_commission_earned NUMERIC(12, 2),
    created_at TIMESTAMPTZ,
    referred_first_name TEXT,
    referred_username TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RETURN;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_uid AND u.status != 'suspended') THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        r.id,
        r.referrer_id,
        r.referred_user_id,
        r.total_commission_earned,
        r.created_at,
        u.first_name AS referred_first_name,
        u.username AS referred_username
    FROM public.referrals r
    JOIN public.users u ON u.id = r.referred_user_id
    WHERE r.referrer_id = v_uid
    ORDER BY r.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_referrals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referrals() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. HARDEN atomic_wallet_credit (LOCK BEFORE IDEMPOTENCY CHECK + REFERRER LEDGER)
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
    v_ref_before NUMERIC(12, 2);
    v_ref_after NUMERIC(12, 2);
    v_ref_idem_key TEXT;
    v_existing_tx transactions%ROWTYPE;
BEGIN
    -- 1. Validate inputs
    IF p_amount <= 0 AND p_type != 'manual_adjustment' THEN
        RAISE EXCEPTION 'Credit amount must be greater than zero.';
    END IF;

    IF p_amount = 0 THEN
        RAISE EXCEPTION 'Adjustment amount cannot be zero.';
    END IF;

    -- 2. Lock user row FOR UPDATE FIRST so concurrent identical idempotency keys serialize cleanly
    SELECT * INTO v_user FROM users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found.';
    END IF;

    IF v_user.status = 'suspended' THEN
        RAISE EXCEPTION 'User account is suspended.';
    END IF;

    -- 3. Idempotency Check under user lock
    IF p_idempotency_key IS NOT NULL THEN
        SELECT * INTO v_existing_tx FROM transactions WHERE idempotency_key = p_idempotency_key;
        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', true,
                'already_processed', true,
                'wallet_balance', v_user.wallet_balance
            );
        END IF;
    END IF;

    v_new_balance := v_user.wallet_balance + p_amount;

    IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'Insufficient wallet balance for deduction.';
    END IF;

    -- 4. Record Financial Transaction first (protected by UNIQUE idempotency_key)
    BEGIN
        INSERT INTO transactions (
            user_id, amount, type, status, balance_before, balance_after,
            idempotency_key, reference_id, description
        ) VALUES (
            p_user_id, p_amount, p_type, 'completed', v_user.wallet_balance, v_new_balance,
            p_idempotency_key, p_reference_id, p_description
        );
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'wallet_balance', v_user.wallet_balance
        );
    END;

    -- 5. Update User Wallet
    UPDATE users
    SET wallet_balance = v_new_balance,
        total_earned = CASE WHEN p_amount > 0 THEN total_earned + p_amount ELSE total_earned END,
        last_active_at = NOW()
    WHERE id = p_user_id;

    -- 6. Referral Commission Automation (10%) with atomic RETURNING & ledger completeness
    IF p_type IN ('task_reward', 'survey_reward', 'offer_reward') AND p_amount > 0 THEN
        SELECT referrer_id INTO v_referrer_id FROM referrals WHERE referred_user_id = p_user_id;
        IF v_referrer_id IS NOT NULL AND v_referrer_id != p_user_id THEN
            v_commission := ROUND(p_amount * 0.10, 2);
            IF v_commission > 0 THEN
                UPDATE users
                SET wallet_balance = wallet_balance + v_commission,
                    total_earned = total_earned + v_commission
                WHERE id = v_referrer_id AND status != 'suspended'
                RETURNING wallet_balance - v_commission, wallet_balance
                INTO v_ref_before, v_ref_after;

                IF FOUND THEN
                    v_ref_idem_key := CASE
                        WHEN p_idempotency_key IS NOT NULL THEN 'ref_' || p_idempotency_key
                        ELSE NULL
                    END;

                    INSERT INTO transactions (
                        user_id, amount, type, status, balance_before, balance_after,
                        idempotency_key, reference_id, description
                    ) VALUES (
                        v_referrer_id, v_commission, 'referral_commission', 'completed',
                        v_ref_before, v_ref_after, v_ref_idem_key,
                        p_idempotency_key, '10% referral bonus from invitee activity'
                    )
                    ON CONFLICT (idempotency_key) DO NOTHING;

                    UPDATE referrals
                    SET total_commission_earned = total_commission_earned + v_commission
                    WHERE referrer_id = v_referrer_id AND referred_user_id = p_user_id;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'credited_amount', p_amount,
        'wallet_balance', v_new_balance
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.atomic_wallet_credit(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_wallet_credit(UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 5. OFFERWALL / SURVEY CHARGEBACK REVERSAL RPC (CPX status=2)
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
    v_user users%ROWTYPE;
    v_rev_key TEXT := format('rev_%s_%s', p_provider, p_external_tx_id);
    v_orig_key TEXT := format('%s_%s', p_provider, p_external_tx_id);
    v_deduct NUMERIC(12, 2);
    v_new_balance NUMERIC(12, 2);
BEGIN
    SELECT * INTO v_user FROM users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found.');
    END IF;

    IF EXISTS (SELECT 1 FROM transactions WHERE idempotency_key = v_rev_key) THEN
        RETURN jsonb_build_object('success', true, 'already_processed', true, 'deducted', 0);
    END IF;

    -- Only deduct if the original transaction was credited
    IF NOT EXISTS (SELECT 1 FROM transactions WHERE idempotency_key = v_orig_key) THEN
        RETURN jsonb_build_object('success', true, 'already_processed', false, 'deducted', 0, 'note', 'No prior credit found');
    END IF;

    v_deduct := LEAST(GREATEST(v_user.wallet_balance, 0.00), GREATEST(COALESCE(p_amount, 0.00), 0.00));
    v_new_balance := GREATEST(0.00, v_user.wallet_balance - v_deduct);

    IF v_deduct > 0 THEN
        UPDATE users
        SET wallet_balance = v_new_balance
        WHERE id = p_user_id;
    END IF;

    INSERT INTO transactions (
        user_id, amount, type, status, balance_before, balance_after,
        idempotency_key, reference_id, description
    ) VALUES (
        p_user_id, -v_deduct, 'manual_adjustment', 'reversed',
        v_user.wallet_balance, v_new_balance, v_rev_key,
        p_external_tx_id, format('%s Chargeback Reversal (Tx: %s)', UPPER(p_provider), p_external_tx_id)
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    UPDATE offerwall_logs
    SET status = 'reversed'
    WHERE provider = p_provider AND external_transaction_id = p_external_tx_id;

    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'deducted', v_deduct,
        'wallet_balance', v_new_balance
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_offer_chargeback(UUID, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_offer_chargeback(UUID, TEXT, TEXT, NUMERIC) TO service_role;

-- ----------------------------------------------------------------------------
-- 6. ATOMIC TASK SUBMISSION & COMPLETION QUOTA ENFORCEMENT
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_task_atomic(
    p_user_id UUID,
    p_task_id UUID,
    p_proof_text TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user users%ROWTYPE;
    v_task tasks%ROWTYPE;
    v_pending_count INTEGER;
    v_existing submissions%ROWTYPE;
    v_sub_id UUID;
    v_submitted_at TIMESTAMPTZ := NOW();
BEGIN
    SELECT * INTO v_user FROM users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found.', 'code', 'USER_NOT_FOUND');
    END IF;
    IF v_user.status = 'suspended' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account is suspended.', 'code', 'ACCOUNT_SUSPENDED');
    END IF;

    -- Lock task row FOR UPDATE to prevent concurrent slot exhaustion race conditions
    SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Task not found.', 'code', 'TASK_NOT_FOUND');
    END IF;

    IF v_task.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'This task is currently paused or completed.', 'code', 'TASK_NOT_ACTIVE');
    END IF;

    SELECT * INTO v_existing
    FROM submissions
    WHERE task_id = p_task_id AND user_id = p_user_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('You have already submitted proof for this task (Status: %s).', v_existing.status),
            'code', 'DUPLICATE_SUBMISSION'
        );
    END IF;

    SELECT COUNT(*) INTO v_pending_count
    FROM submissions
    WHERE task_id = p_task_id AND status = 'pending';

    IF COALESCE(v_task.current_completions, 0) + v_pending_count >= COALESCE(v_task.max_completions, 100) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'All available slots for this task have been filled.',
            'code', 'TASK_QUOTA_FULL'
        );
    END IF;

    INSERT INTO submissions (
        task_id, user_id, proof_text, status, submitted_at
    ) VALUES (
        p_task_id, p_user_id, p_proof_text, 'pending', v_submitted_at
    )
    RETURNING id INTO v_sub_id;

    RETURN jsonb_build_object(
        'success', true,
        'submission_id', v_sub_id,
        'task_title', v_task.title,
        'status', 'pending',
        'submitted_at', v_submitted_at
    );
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'You have already submitted proof for this task.',
        'code', 'DUPLICATE_SUBMISSION'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_task_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_task_atomic(UUID, UUID, TEXT) TO service_role;

-- Harden admin_review_submission to enforce max_completions & active admin verification
CREATE OR REPLACE FUNCTION public.admin_review_submission(
    p_admin_id UUID,
    p_submission_id UUID,
    p_decision TEXT,
    p_comment TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_submission submissions%ROWTYPE;
    v_task tasks%ROWTYPE;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.admin_users
        WHERE (id = p_admin_id OR auth_user_id = p_admin_id)
          AND status = 'active'
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Administrator account invalid or inactive.');
    END IF;

    SELECT * INTO v_submission FROM submissions WHERE id = p_submission_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Submission not found.');
    END IF;

    IF v_submission.status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Submission is already reviewed.');
    END IF;

    SELECT * INTO v_task FROM tasks WHERE id = v_submission.task_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Associated task not found.');
    END IF;

    IF p_decision = 'approved' THEN
        IF COALESCE(v_task.current_completions, 0) >= COALESCE(v_task.max_completions, 100) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Task completion quota has already been reached.');
        END IF;

        UPDATE submissions
        SET status = 'approved',
            admin_comment = p_comment,
            reviewed_by = p_admin_id,
            reviewed_at = NOW()
        WHERE id = p_submission_id;

        UPDATE tasks
        SET current_completions = current_completions + 1,
            status = CASE WHEN current_completions + 1 >= max_completions THEN 'completed' ELSE status END
        WHERE id = v_submission.task_id;

        PERFORM atomic_wallet_credit(
            v_submission.user_id,
            v_task.reward,
            'task_reward',
            format('sub_%s', p_submission_id),
            p_submission_id::text,
            format('Task completed: %s', v_task.title)
        );

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

REVOKE EXECUTE ON FUNCTION public.admin_review_submission(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_submission(UUID, UUID, TEXT, TEXT) TO service_role;

-- ----------------------------------------------------------------------------
-- 7. ADMIN DASHBOARD SQL AGGREGATION RPC (PREVENTS FULL TABLE SCAN IN MEMORY)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_aggregates()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_total_users BIGINT := 0;
    v_active_tasks BIGINT := 0;
    v_pending_withdrawals BIGINT := 0;
    v_pending_submissions BIGINT := 0;
    v_total_balance NUMERIC(14, 2) := 0.00;
    v_total_earned NUMERIC(14, 2) := 0.00;
    v_total_paid_out NUMERIC(14, 2) := 0.00;
BEGIN
    SELECT COUNT(*), COALESCE(SUM(wallet_balance), 0.00), COALESCE(SUM(total_earned), 0.00)
    INTO v_total_users, v_total_balance, v_total_earned
    FROM public.users;

    SELECT COUNT(*) INTO v_active_tasks
    FROM public.tasks
    WHERE status = 'active';

    SELECT COUNT(*) INTO v_pending_withdrawals
    FROM public.withdrawals
    WHERE status = 'pending';

    SELECT COUNT(*) INTO v_pending_submissions
    FROM public.submissions
    WHERE status = 'pending';

    SELECT COALESCE(SUM(amount), 0.00) INTO v_total_paid_out
    FROM public.withdrawals
    WHERE status = 'completed';

    RETURN jsonb_build_object(
        'totalUsers', v_total_users,
        'activeTasks', v_active_tasks,
        'pendingWithdrawals', v_pending_withdrawals,
        'pendingSubmissions', v_pending_submissions,
        'totalTreasuryBalance', v_total_balance,
        'totalPlatformEarned', v_total_earned,
        'totalPaidOut', v_total_paid_out
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_dashboard_aggregates() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_aggregates() TO service_role;

-- ----------------------------------------------------------------------------
-- 8. STORAGE BUCKET 'proofs': PRIVATE + STRICT MIME/SIZE + OWNER/ADMIN RLS
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    UPDATE storage.buckets
    SET public = false,
        file_size_limit = 5242880,
        allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
    WHERE id = 'proofs';

    DROP POLICY IF EXISTS "Public view task proofs" ON storage.objects;
    DROP POLICY IF EXISTS "Owners and admins view task proofs" ON storage.objects;
    CREATE POLICY "Owners and admins view task proofs"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'proofs'
        AND auth.uid() IS NOT NULL
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR EXISTS (
                SELECT 1 FROM public.admin_users
                WHERE auth_user_id = auth.uid() AND status = 'active'
            )
        )
    );
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
