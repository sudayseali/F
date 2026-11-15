-- ============================================================================
-- PAYVORA: REMOVE LEGACY DEPOSIT FUNCTIONS
-- Migration: 20260512000000_drop_legacy_deposit_rpcs.sql
-- ============================================================================

DROP FUNCTION IF EXISTS public.request_deposit(UUID, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.approve_deposit(UUID);
