-- ============================================================================
-- PAYVORA: USER TASK SUBMISSION HISTORY & TASK EARNINGS RPC
-- Migration: 20260515000000_user_task_history_rpc.sql
-- ============================================================================
-- Purpose:
--   1. Allow authenticated users to read task metadata for tasks they submitted
--      even after the task moves from 'active' to 'completed'/'paused'.
--   2. Provide SECURITY DEFINER RPC public.get_my_task_submissions() returning
--      only the authenticated active user's pending, approved, and rejected
--      task submissions together with the exact credited task reward earned.
-- ============================================================================

DROP POLICY IF EXISTS "Users read submitted tasks" ON public.tasks;
CREATE POLICY "Users read submitted tasks"
ON public.tasks FOR SELECT
USING (
    EXISTS (
        SELECT 1
        FROM public.submissions s
        WHERE s.task_id = tasks.id
          AND s.user_id = auth.uid()
    )
);

CREATE OR REPLACE FUNCTION public.get_my_task_submissions()
RETURNS TABLE (
    submission_id UUID,
    task_id UUID,
    task_title TEXT,
    task_category TEXT,
    task_reward NUMERIC(10, 2),
    task_status TEXT,
    submission_status TEXT,
    earned_amount NUMERIC(12, 2),
    admin_comment TEXT,
    submitted_at TIMESTAMPTZ,
    reviewed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_uid UUID := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RETURN;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = v_uid AND u.status != 'suspended'
    ) THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        s.id AS submission_id,
        s.task_id,
        COALESCE(t.title, 'Micro-Task') AS task_title,
        COALESCE(t.category, 'Other') AS task_category,
        COALESCE(t.reward, 0.00)::NUMERIC(10, 2) AS task_reward,
        COALESCE(t.status, 'completed') AS task_status,
        s.status AS submission_status,
        CASE
            WHEN s.status = 'approved' THEN
                COALESCE(
                    (
                        SELECT tx.amount
                        FROM public.transactions tx
                        WHERE tx.user_id = v_uid
                          AND tx.type = 'task_reward'
                          AND (
                              tx.idempotency_key = format('sub_%s', s.id)
                              OR tx.reference_id = s.id::text
                          )
                        ORDER BY tx.created_at DESC
                        LIMIT 1
                    ),
                    t.reward,
                    0.00
                )::NUMERIC(12, 2)
            ELSE 0.00::NUMERIC(12, 2)
        END AS earned_amount,
        s.admin_comment,
        s.submitted_at,
        s.reviewed_at
    FROM public.submissions s
    LEFT JOIN public.tasks t ON t.id = s.task_id
    WHERE s.user_id = v_uid
    ORDER BY s.submitted_at DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_task_submissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_task_submissions() TO authenticated, service_role;
