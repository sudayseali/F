-- ============================================================================
-- PAYVORA: SECURITY AUDIT REMEDIATION & RLS HARDENING
-- Migration: 20260519000000_security_audit_hardening.sql
-- ============================================================================
-- Addresses Phase 6 security audit findings cleanly and idempotently:
--   1. Add explicit deny-client policy on public.ip_risk_cache (RLS enabled)
--   2. Restrict direct transactions & withdrawals RLS by finance/admin role and
--      prevent direct client INSERT/UPDATE/DELETE mutations on financial ledger
--   3. Restrict direct app_settings write RLS to super_admin / admin roles
--   4. Re-verify SET search_path = public, pg_temp across SECURITY DEFINER RPCs
-- ============================================================================

-- 1. ip_risk_cache: service_role only (explicit deny for anon/authenticated)
REVOKE ALL ON public.ip_risk_cache FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ip_risk_cache TO service_role;

DROP POLICY IF EXISTS "Deny client access ip_risk_cache" ON public.ip_risk_cache;
CREATE POLICY "Deny client access ip_risk_cache"
ON public.ip_risk_cache FOR ALL
USING (false)
WITH CHECK (false);

-- 2. Immutable financial ledger & withdrawal RLS (role-scoped SELECT; writes via SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "Admins full access transactions" ON public.transactions;
DROP POLICY IF EXISTS "Finance admins read transactions" ON public.transactions;
CREATE POLICY "Finance admins read transactions"
ON public.transactions FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users a
        WHERE a.auth_user_id = auth.uid()
          AND a.status = 'active'
          AND a.role IN ('super_admin', 'admin', 'finance_admin', 'finance')
    )
);

DROP POLICY IF EXISTS "Admins full access withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Finance admins read withdrawals" ON public.withdrawals;
CREATE POLICY "Finance admins read withdrawals"
ON public.withdrawals FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users a
        WHERE a.auth_user_id = auth.uid()
          AND a.status = 'active'
          AND a.role IN ('super_admin', 'admin', 'finance_admin', 'finance')
    )
);

-- 3. Restrict direct app_settings writes to super_admin / admin roles
DROP POLICY IF EXISTS "Admins manage settings" ON public.app_settings;
CREATE POLICY "Admins manage settings"
ON public.app_settings FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.admin_users a
        WHERE a.auth_user_id = auth.uid()
          AND a.status = 'active'
          AND a.role IN ('super_admin', 'admin')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.admin_users a
        WHERE a.auth_user_id = auth.uid()
          AND a.status = 'active'
          AND a.role IN ('super_admin', 'admin')
    )
);

-- 4. Re-verify explicit search_path on all SECURITY DEFINER functions in public
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
