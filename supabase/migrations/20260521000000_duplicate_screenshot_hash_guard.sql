-- ============================================================================
-- PAYVORA: DUPLICATE SCREENSHOT SHA-256 ANTI-FRAUD GUARD
-- Migration: 20260521000000_duplicate_screenshot_hash_guard.sql
-- ============================================================================
-- Prevents multi-account fraudsters from reusing the exact same screenshot
-- across different accounts on the same micro-task:
--   1. Adds `proof_hash` (64-char SHA-256 hex) to `public.submissions`
--   2. Adds a partial UNIQUE index on `(task_id, proof_hash)` for active
--      (`pending` / `approved`) submissions to stop race conditions atomically
--   3. Upgrades `submit_task_atomic()` to enforce duplicate proof_hash rejection,
--      persist `proof_hash`, and flag cross-task reuse across distinct accounts
-- ============================================================================

-- 1. Add proof_hash column & lookup index
ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS proof_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_submissions_proof_hash
  ON public.submissions(proof_hash)
  WHERE proof_hash IS NOT NULL;

-- Partial unique index: the same screenshot bytes (SHA-256) cannot be held
-- simultaneously as pending or approved by multiple accounts on the same task.
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_task_proof_hash_unique
  ON public.submissions(task_id, proof_hash)
  WHERE proof_hash IS NOT NULL AND status IN ('pending', 'approved');

-- 2. Upgrade submit_task_atomic() with proof_hash parameter (backwards-compatible default NULL)
DROP FUNCTION IF EXISTS public.submit_task_atomic(UUID, UUID, TEXT);
CREATE FUNCTION public.submit_task_atomic(
    p_user_id UUID,
    p_task_id UUID,
    p_proof_text TEXT,
    p_proof_hash TEXT DEFAULT NULL
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
    v_constraint_name TEXT;
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
    WHERE task_id = p_task_id AND user_id = p_user_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', format('You have already submitted proof for this task (Status: %s).', v_existing.status),
            'code', 'DUPLICATE_SUBMISSION'
        );
    END IF;

    -- Reject if this exact screenshot SHA-256 was already submitted to the same task by another account
    IF v_clean_hash IS NOT NULL THEN
        SELECT s.id INTO v_dup_sub_id
        FROM submissions s
        WHERE s.task_id = p_task_id
          AND s.proof_hash = v_clean_hash
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

        -- Also check if another account previously used this exact screenshot on a DIFFERENT task
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

    INSERT INTO submissions (
        task_id, user_id, proof_text, proof_hash, status, submitted_at
    ) VALUES (
        p_task_id, p_user_id, p_proof_text, v_clean_hash, 'pending', v_submitted_at
    )
    RETURNING id INTO v_sub_id;

    RETURN jsonb_build_object(
        'success', true,
        'submission_id', v_sub_id,
        'task_title', v_task.title,
        'status', 'pending',
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

REVOKE EXECUTE ON FUNCTION public.submit_task_atomic(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_task_atomic(UUID, UUID, TEXT, TEXT) TO service_role;
