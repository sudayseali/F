-- ============================================================================
-- PAYVORA: ACCURATE AVAILABLE SLOTS (APPROVED + PENDING RESERVATIONS) RPC
-- Migration: 20260514000000_accurate_task_slots_rpc.sql
-- ============================================================================
-- Why:
--   public.submissions is protected by RLS so users only see their own rows.
--   Previously, the Tasks list & TaskDetails subtracted only current_completions
--   (approved tasks), hiding slots already reserved by other users' pending
--   submissions and letting users click full tasks only to be rejected on submit.
--
-- Solution:
--   Expose two zero-PII SECURITY DEFINER RPCs returning only task metadata plus
--   aggregated pending_submissions and remaining_slots counts:
--     1. public.get_active_tasks_with_slots()
--     2. public.get_task_with_slots(p_task_id UUID)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_submissions_task_status
    ON public.submissions (task_id, status);

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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

REVOKE EXECUTE ON FUNCTION public.get_active_tasks_with_slots() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_tasks_with_slots() TO anon, authenticated, service_role;

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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
    WHERE t.id = p_task_id;
$$;

REVOKE EXECUTE ON FUNCTION public.get_task_with_slots(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_task_with_slots(UUID) TO anon, authenticated, service_role;
