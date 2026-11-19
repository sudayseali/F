-- ============================================================================
-- PAYVORA: AUTO-VERIFIED TELEGRAM CHANNEL/GROUP JOIN TASKS
-- Migration: 20260520000000_auto_telegram_join_tasks.sql
-- ============================================================================
-- Safely introduces `auto_telegram_join` task verification without breaking
-- existing `manual_screenshot` tasks or weakening slot/ledger atomicity:
--   1. Adds `verification_type` and `verification_chat_id` columns to `tasks`
--   2. Updates `get_active_tasks_with_slots()` and `get_task_with_slots(UUID)`
--      preserving existing SECURITY DEFINER, search_path, and visibility rules
--   3. Adds `complete_auto_telegram_task_atomic()` (service_role only) which
--      locks the task row FOR UPDATE, prevents duplicates via UNIQUE(task_id, user_id),
--      records an immediately `approved` submission, increments completion quota,
--      credits the wallet + 10% referral commission via `atomic_wallet_credit()`,
--      and writes an immutable audit log entry.
-- ============================================================================

-- 1. Extend public.tasks with safe defaults (backwards-compatible)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS verification_type TEXT NOT NULL DEFAULT 'manual_screenshot';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS verification_chat_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_verification_type_check'
      AND conrelid = 'public.tasks'::regclass
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_verification_type_check
      CHECK (verification_type IN ('manual_screenshot', 'auto_telegram_join'));
  END IF;
END $$;

-- 2. Update slot-aware task listing RPCs to include verification metadata
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
    ORDER BY t.created_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_active_tasks_with_slots() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_tasks_with_slots() TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_task_with_slots(UUID);
CREATE FUNCTION public.get_task_with_slots(p_task_id UUID)
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
    v_is_admin BOOLEAN := false;
BEGIN
    IF v_jwt_role = 'service_role' THEN
        v_is_admin := true;
    ELSE
        IF v_uid IS NULL OR NOT EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = v_uid AND u.status != 'suspended'
        ) THEN
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

-- 3. Atomic RPC for Instant Bot-Verified Telegram Channel/Group Tasks
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
BEGIN
    -- 1. Validate user account status
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found.', 'code', 'USER_NOT_FOUND');
    END IF;
    IF v_user.status = 'suspended' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account is suspended.', 'code', 'ACCOUNT_SUSPENDED');
    END IF;

    -- 2. Lock task row FOR UPDATE to serialize slot capacity checks
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

    -- 3. Enforce one completion per user per task
    SELECT * INTO v_existing
    FROM public.submissions
    WHERE task_id = p_task_id AND user_id = p_user_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('You have already completed or submitted this task (Status: %s).', v_existing.status),
            'code', 'DUPLICATE_SUBMISSION'
        );
    END IF;

    -- 4. Enforce max_completions including any pending reservations
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

    -- 5. Insert immediately approved submission record
    INSERT INTO public.submissions (
        task_id,
        user_id,
        proof_text,
        status,
        admin_comment,
        submitted_at,
        reviewed_at
    ) VALUES (
        p_task_id,
        p_user_id,
        format('auto_telegram_join:%s:%s', LEFT(COALESCE(p_chat_id, ''), 120), LEFT(COALESCE(p_member_status, 'member'), 32)),
        'approved',
        'Auto-verified via Telegram Bot getChatMember',
        v_now,
        v_now
    )
    RETURNING id INTO v_sub_id;

    -- 6. Increment task completion counter & auto-complete task if slots reached
    UPDATE public.tasks
    SET current_completions = COALESCE(current_completions, 0) + 1,
        status = CASE
            WHEN COALESCE(current_completions, 0) + 1 >= COALESCE(max_completions, 100) THEN 'completed'
            ELSE status
        END
    WHERE id = p_task_id;

    -- 7. Atomically credit user wallet + 10% referrer commission with idempotency key sub_<submission_id>
    SELECT public.atomic_wallet_credit(
        p_user_id,
        v_task.reward,
        'task_reward',
        format('sub_%s', v_sub_id),
        v_sub_id::text,
        format('Instant task completed: %s', v_task.title)
    ) INTO v_credit_res;

    -- 8. Record immutable audit trail
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
            'reward', v_task.reward
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
