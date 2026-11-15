-- ============================================================================
-- PAYVORA: REMOVE PAYEER WITHDRAWAL METHOD
-- Migration: 20260510000000_remove_payeer_withdrawal.sql
-- ============================================================================

UPDATE public.app_settings
SET value = jsonb_set(
        COALESCE(value, '{}'::jsonb),
        '{supported_methods}',
        '["usdt", "usdt_bep20", "trx"]'::jsonb,
        true
    ),
    updated_at = NOW()
WHERE key = 'payout_config';

CREATE OR REPLACE FUNCTION public.request_withdrawal(
    user_id_param UUID,
    amount_param NUMERIC(12, 2),
    method TEXT,
    wallet_address TEXT,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user users%ROWTYPE;
    v_new_balance NUMERIC(12, 2);
    v_withdrawal_id UUID;
    v_pending_count INTEGER;
    v_jwt_role TEXT := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
    IF v_jwt_role != 'service_role' AND auth.uid() IS DISTINCT FROM user_id_param THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Cannot initiate withdrawal for another user.');
    END IF;

    IF amount_param < 1.00 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Minimum withdrawal amount is $1.00');
    END IF;

    IF amount_param > 5000.00 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Maximum withdrawal amount is $5,000.00 per request');
    END IF;

    IF method NOT IN ('usdt', 'usdt_bep20', 'trx') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid payment method. Supported methods: USDT (TRC20), USDT (BEP20), TRX.');
    END IF;

    IF wallet_address IS NULL OR length(trim(wallet_address)) < 4 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid wallet address provided.');
    END IF;

    IF p_idempotency_key IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM transactions WHERE idempotency_key = p_idempotency_key) THEN
            RETURN jsonb_build_object('success', false, 'error', 'Duplicate withdrawal request detected.', 'code', 'DUPLICATE_REQUEST');
        END IF;
    END IF;

    SELECT * INTO v_user FROM users WHERE id = user_id_param FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found.');
    END IF;

    IF v_user.status = 'suspended' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Account is suspended.');
    END IF;

    SELECT COUNT(*) INTO v_pending_count
    FROM withdrawals
    WHERE user_id = user_id_param AND status = 'pending';

    IF v_pending_count > 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'An existing pending withdrawal is currently under review.');
    END IF;

    IF v_user.wallet_balance < amount_param THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient wallet balance.');
    END IF;

    v_new_balance := v_user.wallet_balance - amount_param;

    UPDATE users
    SET wallet_balance = v_new_balance,
        last_active_at = NOW()
    WHERE id = user_id_param;

    INSERT INTO withdrawals (
        user_id, amount, method, wallet_address, status
    ) VALUES (
        user_id_param, amount_param, method, wallet_address, 'pending'
    ) RETURNING id INTO v_withdrawal_id;

    INSERT INTO transactions (
        user_id, amount, type, status, balance_before, balance_after, idempotency_key, reference_id, description
    ) VALUES (
        user_id_param, -amount_param, 'withdrawal_request', 'pending', v_user.wallet_balance, v_new_balance,
        COALESCE(p_idempotency_key, 'wd_' || v_withdrawal_id::text),
        v_withdrawal_id::text,
        format('Withdrawal request via %s to %s', UPPER(method), wallet_address)
    );

    RETURN jsonb_build_object(
        'success', true,
        'withdrawal_id', v_withdrawal_id,
        'new_balance', v_new_balance
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(UUID, NUMERIC, TEXT, TEXT, TEXT) TO service_role;
