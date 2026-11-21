-- ============================================================================
-- PAYVORA: TASK LIFECYCLE, SLOT VISIBILITY, RESUBMISSION & USERNAME PERSISTENCE
-- Migration: 20260522000000_task_lifecycle_and_resubmission_fix.sql
-- ============================================================================
-- Aligns Payvora's micro-task system with standard micro-task marketplace behavior:
--   1. Adds `submitted_username` & `attempt_count` (max 3 attempts) to `submissions`
--   2. Updates `get_active_tasks_with_slots()` so authenticated users never see
--      already-submitted tasks or 0-slot full tasks in their Available feed
--   3. Upgrades `submit_task_atomic()` to persist `submitted_username`, keep
--      pending/approved duplicate blocking, and allow safe proof resubmission when
--      a submission was `rejected` (up to 3 total attempts, while slots remain open)
--   4. Allows `complete_auto_telegram_task_atomic()` to re-claim if prior auto check failed/rejected
-- ============================================================================

-- 1. Extend public.submissions cleanly
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS submitted_username TEXT;

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1;

-- 2. Exclude already-submitted and 0-slot tasks from the user's Available Tasks RPC
DROP FUNCTION IF EXISTS public.get_active_tasks_with_slots();
CREATE FUNCTION public.get_active_tasks_with_slots()
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
    verification_type TEXT,
    verification_chat_id TEXT,
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
        COALESCE(t.verification_type, 'manual_screenshot')::TEXT AS verification_type,
        t.verification_chat_id,
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
      AND (
          COALESCE(t.max_completions, 100)
          - COALESCE(t.current_completions, 0)
          - COALESCE(p.cnt, 0)
      ) > 0
      AND (
          v_uid IS NULL
          OR NOT EXISTS (
              SELECT 1
              FROM public.submissions us
              WHERE us.task_id = t.id
                AND us.user_id = v_uid
          )
      )
    ORDER BY t.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_active_tasks_with_slots() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_tasks_with_slots() TO authenticated, service_role;

-- 3. Include attempt_count in get_my_task_submissions? Keep exact return signature backwards compatible,
--    and update submit_task_atomic to support safe resubmission on 'rejected' + submitted_username.
DROP FUNCTION IF EXISTS public.submit_task_atomic(UUID, UUID, TEXT, TEXT);
CREATE FUNCTION public.submit_task_atomic(
    p_user_id UUID,
    p_task_id UUID,
    p_proof_text TEXT,
    p_proof_hash TEXT DEFAULT NULL,
    p_submitted_username TEXT DEFAULT NULL
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
    v_dup_sub_id UUID;
    v_cross_user_id UUID;
    v_sub_id UUID;
    v_submitted_at TIMESTAMPTZ := NOW();
    v_clean_hash TEXT := NULLIF(lower(trim(COALESCE(p_proof_hash, ''))), '');
    v_clean_username TEXT := NULLIF(LEFT(trim(COALESCE(p_submitted_username, '')), 64), '');
    v_constraint_name TEXT;
    v_next_attempt INTEGER := 1;
    v_old_proof_text TEXT := NULL;
BEGIN
    SELECT * INTO v_user FROM users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found.', 'code', 'USER_NOT_FOUND');
    END IF;
    IF v_user.status = 'suspended' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account is suspended.', 'code', 'ACCOUNT_SUSPENDED');
    END IF;

    -- Lock task row FOR UPDATE to prevent concurrent slot exhaustion & duplicate proof races
    SELECT * INTO v_task FROM tasks WHERE id = p_task_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Task not found.', 'code', 'TASK_NOT_FOUND');
    END IF;

    IF v_task.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'This task is currently paused or completed.', 'code', 'TASK_NOT_ACTIVE');
    END IF;

    SELECT * INTO v_existing
    FROM submissions
    WHERE task_id = p_task_id AND user_id = p_user_id
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing.status IN ('pending', 'approved') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', format('You have already submitted proof for this task (Status: %s).', v_existing.status),
                'code', 'DUPLICATE_SUBMISSION'
            );
        END IF;

        -- Existing row is 'rejected': allow safe resubmission up to 3 attempts total
        v_next_attempt := COALESCE(v_existing.attempt_count, 1) + 1;
        IF v_next_attempt > 3 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Maximum of 3 proof submission attempts reached for this task.',
                'code', 'MAX_RESUBMISSIONS_REACHED'
            );
        END IF;
        v_old_proof_text := v_existing.proof_text;
    END IF;

    -- Reject if this exact screenshot SHA-256 was already submitted to the same task by any pending/approved submission
    IF v_clean_hash IS NOT NULL THEN
        SELECT s.id INTO v_dup_sub_id
        FROM submissions s
        WHERE s.task_id = p_task_id
          AND s.proof_hash = v_clean_hash
          AND s.user_id != p_user_id
          AND s.status IN ('pending', 'approved')
        LIMIT 1;

        IF FOUND THEN
            INSERT INTO audit_logs (actor_id, actor_type, action, target_type, target_id, details)
            VALUES (
                p_user_id,
                'user',
                'duplicate_screenshot_blocked',
                'task',
                p_task_id::text,
                jsonb_build_object(
                    'existing_submission_id', v_dup_sub_id,
                    'proof_hash_prefix', LEFT(v_clean_hash, 16)
                )
            );

            RETURN jsonb_build_object(
                'success', false,
                'error', 'This screenshot has already been submitted for this task. Please upload your own original proof.',
                'code', 'DUPLICATE_SCREENSHOT_PROOF'
            );
        END IF;

        -- Flag suspicious cross-task screenshot reuse across accounts
        SELECT s.user_id INTO v_cross_user_id
        FROM submissions s
        WHERE s.proof_hash = v_clean_hash
          AND s.user_id != p_user_id
        LIMIT 1;

        IF FOUND THEN
            INSERT INTO audit_logs (actor_id, actor_type, action, target_type, target_id, details)
            VALUES (
                p_user_id,
                'user',
                'suspicious_cross_task_screenshot_reuse',
                'task',
                p_task_id::text,
                jsonb_build_object(
                    'prior_user_id', v_cross_user_id,
                    'proof_hash_prefix', LEFT(v_clean_hash, 16)
                )
            );
        END IF;
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

    IF v_existing.id IS NOT NULL THEN
        UPDATE submissions
        SET proof_text = p_proof_text,
            proof_hash = v_clean_hash,
            submitted_username = COALESCE(v_clean_username, submitted_username),
            status = 'pending',
            admin_comment = NULL,
            reviewed_by = NULL,
            reviewed_at = NULL,
            submitted_at = v_submitted_at,
            attempt_count = v_next_attempt
        WHERE id = v_existing.id
        RETURNING id INTO v_sub_id;
    ELSE
        INSERT INTO submissions (
            task_id, user_id, proof_text, proof_hash, submitted_username, attempt_count, status, submitted_at
        ) VALUES (
            p_task_id, p_user_id, p_proof_text, v_clean_hash, v_clean_username, 1, 'pending', v_submitted_at
        )
        RETURNING id INTO v_sub_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'submission_id', v_sub_id,
        'task_title', v_task.title,
        'status', 'pending',
        'attempt_count', v_next_attempt,
        'replaced_proof_text', v_old_proof_text,
        'submitted_at', v_submitted_at,
        'cross_task_flagged', v_cross_user_id IS NOT NULL
    );
EXCEPTION WHEN unique_violation THEN
    GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
    IF v_constraint_name = 'idx_submissions_task_proof_hash_unique' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'This screenshot has already been submitted for this task. Please upload your own original proof.',
            'code', 'DUPLICATE_SCREENSHOT_PROOF'
        );
    END IF;
    RETURN jsonb_build_object(
        'success', false,
        'error', 'You have already submitted proof for this task.',
        'code', 'DUPLICATE_SUBMISSION'
    );
END;
$$;

DROP FUNCTION IF EXISTS public.submit_task_atomic(UUID, UUID, TEXT);
REVOKE EXECUTE ON FUNCTION public.submit_task_atomic(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_task_atomic(UUID, UUID, TEXT, TEXT, TEXT) TO service_role;

-- 4. Allow auto_telegram_join tasks to re-claim if prior submission was 'rejected'
CREATE OR REPLACE FUNCTION public.complete_auto_telegram_task_atomic(
    p_user_id UUID,
    p_task_id UUID,
    p_chat_id TEXT,
    p_member_status TEXT DEFAULT 'member'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user public.users%ROWTYPE;
    v_task public.tasks%ROWTYPE;
    v_existing public.submissions%ROWTYPE;
    v_pending_count INTEGER;
    v_sub_id UUID;
    v_now TIMESTAMPTZ := NOW();
    v_credit_res JSONB;
    v_next_attempt INTEGER := 1;
BEGIN
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found.', 'code', 'USER_NOT_FOUND');
    END IF;
    IF v_user.status = 'suspended' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account is suspended.', 'code', 'ACCOUNT_SUSPENDED');
    END IF;

    SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Task not found.', 'code', 'TASK_NOT_FOUND');
    END IF;

    IF v_task.status != 'active' THEN
        RETURN jsonb_build_object('success', false, 'error', 'This task is currently paused or completed.', 'code', 'TASK_NOT_ACTIVE');
    END IF;

    IF COALESCE(v_task.verification_type, 'manual_screenshot') != 'auto_telegram_join' THEN
        RETURN jsonb_build_object('success', false, 'error', 'This task requires manual proof submission.', 'code', 'INVALID_VERIFICATION_TYPE');
    END IF;

    SELECT * INTO v_existing
    FROM public.submissions
    WHERE task_id = p_task_id AND user_id = p_user_id
    FOR UPDATE;

    IF FOUND THEN
        IF v_existing.status IN ('pending', 'approved') THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', format('You have already completed or submitted this task (Status: %s).', v_existing.status),
                'code', 'DUPLICATE_SUBMISSION'
            );
        END IF;

        v_next_attempt := COALESCE(v_existing.attempt_count, 1) + 1;
        IF v_next_attempt > 3 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Maximum verification attempts (3) reached for this task.',
                'code', 'MAX_RESUBMISSIONS_REACHED'
            );
        END IF;
    END IF;

    SELECT COUNT(*) INTO v_pending_count
    FROM public.submissions
    WHERE task_id = p_task_id AND status = 'pending';

    IF COALESCE(v_task.current_completions, 0) + v_pending_count >= COALESCE(v_task.max_completions, 100) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'All available slots for this task have been filled.',
            'code', 'TASK_QUOTA_FULL'
        );
    END IF;

    IF v_existing.id IS NOT NULL THEN
        UPDATE public.submissions
        SET proof_text = format('auto_telegram_join:%s:%s', LEFT(COALESCE(p_chat_id, ''), 120), LEFT(COALESCE(p_member_status, 'member'), 32)),
            status = 'approved',
            admin_comment = 'Auto-verified via Telegram Bot getChatMember',
            submitted_at = v_now,
            reviewed_at = v_now,
            attempt_count = v_next_attempt
        WHERE id = v_existing.id
        RETURNING id INTO v_sub_id;
    ELSE
        INSERT INTO public.submissions (
            task_id, user_id, proof_text, status, admin_comment, submitted_at, reviewed_at, attempt_count
        ) VALUES (
            p_task_id,
            p_user_id,
            format('auto_telegram_join:%s:%s', LEFT(COALESCE(p_chat_id, ''), 120), LEFT(COALESCE(p_member_status, 'member'), 32)),
            'approved',
            'Auto-verified via Telegram Bot getChatMember',
            v_now,
            v_now,
            1
        )
        RETURNING id INTO v_sub_id;
    END IF;

    UPDATE public.tasks
    SET current_completions = COALESCE(current_completions, 0) + 1,
        status = CASE
            WHEN COALESCE(current_completions, 0) + 1 >= COALESCE(max_completions, 100) THEN 'completed'
            ELSE status
        END
    WHERE id = p_task_id;

    SELECT public.atomic_wallet_credit(
        p_user_id,
        v_task.reward,
        'task_reward',
        format('sub_%s', v_sub_id),
        v_sub_id::text,
        format('Instant task completed: %s', v_task.title)
    ) INTO v_credit_res;

    INSERT INTO public.audit_logs (actor_id, actor_type, action, target_type, target_id, details)
    VALUES (
        p_user_id,
        'user',
        'task_auto_verified',
        'submission',
        v_sub_id::text,
        jsonb_build_object(
            'task_id', p_task_id,
            'chat_id', p_chat_id,
            'member_status', p_member_status,
            'reward', v_task.reward,
            'attempt_count', v_next_attempt
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'submission_id', v_sub_id,
        'task_title', v_task.title,
        'reward', v_task.reward,
        'wallet_balance', COALESCE((v_credit_res->>'wallet_balance')::numeric, v_user.wallet_balance + v_task.reward),
        'status', 'approved',
        'auto_verified', true,
        'attempt_count', v_next_attempt,
        'submitted_at', v_now
    );
EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', 'You have already completed this task.',
        'code', 'DUPLICATE_SUBMISSION'
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_auto_telegram_task_atomic(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_auto_telegram_task_atomic(UUID, UUID, TEXT, TEXT) TO service_role;
