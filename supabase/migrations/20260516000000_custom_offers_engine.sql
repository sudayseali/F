-- ============================================================================
-- PAYVORA: CUSTOM OFFERS ENGINE DATABASE ARCHITECTURE
-- Migration: 20260516000000_custom_offers_engine.sql
-- ============================================================================
-- Additive, idempotent schema for unified offer marketplace, provider adapters,
-- opaque click attribution, conversion deduplication, partial/full reversals,
-- provider sync logs, webhook audit forensics, and missing-reward disputes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. SEED CONFIGURABLE OFFERWALL COMMISSION RULES IN app_settings
-- ----------------------------------------------------------------------------
INSERT INTO public.app_settings (key, value, description)
VALUES (
    'offerwall_commission_config',
    '{
      "default_user_share_percent": 70.0,
      "min_user_reward_usd": 0.01,
      "max_user_reward_usd": 1000.00,
      "provider_user_share_overrides": {
        "cpx": 80.0
      }
    }'::jsonb,
    'Payvora custom offers reward split & margin rules'
)
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. OFFER PROVIDERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offer_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_key TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    integration_type TEXT NOT NULL CHECK (integration_type IN ('api_and_postback', 'hosted_wall', 'hybrid', 'survey_api')),
    status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('active', 'paused', 'pending_approval', 'disabled')),
    api_enabled BOOLEAN NOT NULL DEFAULT false,
    custom_listing_enabled BOOLEAN NOT NULL DEFAULT false,
    sync_enabled BOOLEAN NOT NULL DEFAULT false,
    hosted_wall_url_template TEXT,
    allowed_redirect_domains TEXT[] NOT NULL DEFAULT '{}',
    commission_override_percent NUMERIC(5, 2) CHECK (commission_override_percent IS NULL OR (commission_override_percent >= 10 AND commission_override_percent <= 100)),
    last_sync_at TIMESTAMPTZ,
    last_sync_status TEXT,
    last_error TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offer_providers_status ON public.offer_providers(status);

INSERT INTO public.offer_providers (
    provider_key, display_name, integration_type, status,
    api_enabled, custom_listing_enabled, sync_enabled,
    hosted_wall_url_template, allowed_redirect_domains, metadata
) VALUES
    (
        'torox', 'Torox', 'hybrid', 'active',
        false, false, false,
        'https://torox.io/offerwall?pub_id={pub_id}&user_id={user_id}',
        ARRAY['torox.io', 'torox.com', 'ttrk.io'],
        '{"requires_approval": "Custom Offers API requires publisher API key in TOROX_API_KEY", "categories": ["games", "apps", "registration"]}'::jsonb
    ),
    (
        'lootably', 'Lootably', 'hybrid', 'active',
        false, false, false,
        'https://wall.lootably.com/?placementID={placement_id}&sid={user_id}',
        ARRAY['wall.lootably.com', 'lootably.com', 'trk.lootably.com'],
        '{"requires_approval": "API feed requires LOOTABLY_API_KEY & LOOTABLY_PLACEMENT_ID", "categories": ["apps", "games", "surveys"]}'::jsonb
    ),
    (
        'ayet', 'ayeT-Studios', 'hybrid', 'active',
        false, false, false,
        'https://www.ayetstudios.com/offers/offerwall_api/{adslot_id}?external_identifier={user_id}',
        ARRAY['www.ayetstudios.com', 'ayetstudios.com', 'ayet.io'],
        '{"requires_approval": "Offer API feed requires AYET_API_KEY & AYET_ADSLOT_ID", "categories": ["games", "apps"]}'::jsonb
    ),
    (
        'adgate', 'AdGate Media', 'hybrid', 'active',
        false, false, false,
        'https://wall.adgaterewards.com/{wall_code}/{user_id}',
        ARRAY['wall.adgaterewards.com', 'adgaterewards.com', 'adgatemedia.com'],
        '{"requires_approval": "Offer API feed requires ADGATE_API_KEY & ADGATE_AFFILIATE_ID", "categories": ["apps", "games", "trial"]}'::jsonb
    ),
    (
        'adgem', 'AdGem', 'api_and_postback', 'pending_approval',
        false, false, false,
        'https://api.adgem.com/v1/wall?appid={app_id}&playerid={user_id}',
        ARRAY['api.adgem.com', 'adgem.com', 'wall.adgem.com'],
        '{"requires_approval": "Awaiting AdGem publisher approval & ADGEM_APP_ID / ADGEM_API_KEY / ADGEM_POSTBACK_SECRET", "categories": ["games", "apps"]}'::jsonb
    ),
    (
        'adscend', 'Adscend Media', 'api_and_postback', 'pending_approval',
        false, false, false,
        'https://asmwall.com/adwall/publisher/{pub_id}/profile/{profile_id}?subid1={user_id}',
        ARRAY['asmwall.com', 'adscendmedia.com', 'trk.adscendmedia.com'],
        '{"requires_approval": "Awaiting Adscend Media publisher approval & ADSCEND_PUBLISHER_ID / ADSCEND_PROFILE_ID / ADSCEND_API_KEY", "categories": ["games", "surveys", "apps"]}'::jsonb
    ),
    (
        'cpx', 'CPX Research', 'survey_api', 'active',
        false, false, false,
        'https://offers.cpx-research.com/index.php?app_id={app_id}&ext_user_id={user_id}&secure_hash={secure_hash}',
        ARRAY['offers.cpx-research.com', 'cpx-research.com'],
        '{"supports_user_targeted_surveys": true, "categories": ["surveys"]}'::jsonb
    ),
    (
        'tapjoy', 'Tapjoy', 'hosted_wall', 'active',
        false, false, false,
        NULL,
        ARRAY['tapjoy.com', 'tj.tapjoy.com'],
        '{"hosted_only": true, "note": "Hosted integration via Tapjoy Offerwall unless direct API access is approved"}'::jsonb
    )
ON CONFLICT (provider_key) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. OFFERS CATALOG TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES public.offer_providers(id) ON DELETE RESTRICT,
    external_offer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    instructions TEXT NOT NULL DEFAULT '',
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('games', 'apps', 'surveys', 'registration', 'trial', 'other')),
    image_url TEXT,
    thumbnail_url TEXT,
    provider_reward NUMERIC(12, 4) NOT NULL DEFAULT 0.0000 CHECK (provider_reward >= 0),
    user_reward NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (user_reward >= 0),
    commission_percent NUMERIC(5, 2) NOT NULL DEFAULT 30.00 CHECK (commission_percent >= 0 AND commission_percent <= 95),
    currency TEXT NOT NULL DEFAULT 'USD',
    is_estimated_reward BOOLEAN NOT NULL DEFAULT false,
    estimated_time INTEGER,
    countries TEXT[] NOT NULL DEFAULT '{}',
    excluded_countries TEXT[] NOT NULL DEFAULT '{}',
    device_types TEXT[] NOT NULL DEFAULT '{all}',
    new_user_only BOOLEAN NOT NULL DEFAULT true,
    tracking_type TEXT NOT NULL DEFAULT 's2s' CHECK (tracking_type IN ('s2s', 'sdk', 'survey', 'hosted')),
    destination_url TEXT NOT NULL,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    starts_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_offers_provider_external UNIQUE (provider_id, external_offer_id)
);

CREATE INDEX IF NOT EXISTS idx_offers_provider_id ON public.offers(provider_id);
CREATE INDEX IF NOT EXISTS idx_offers_marketplace_filter ON public.offers(is_active, is_featured, category, user_reward DESC);
CREATE INDEX IF NOT EXISTS idx_offers_expires_at ON public.offers(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offers_countries ON public.offers USING GIN (countries);
CREATE INDEX IF NOT EXISTS idx_offers_devices ON public.offers USING GIN (device_types);

-- ----------------------------------------------------------------------------
-- 4. OFFER CLICKS & OPAQUE ATTRIBUTION TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offer_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE RESTRICT,
    provider_id UUID NOT NULL REFERENCES public.offer_providers(id) ON DELETE RESTRICT,
    opaque_click_id TEXT UNIQUE NOT NULL,
    tracking_token_hash TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'clicked' CHECK (status IN ('clicked', 'converted', 'expired', 'invalidated')),
    user_country TEXT,
    user_device TEXT,
    ip_hash TEXT,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_offer_clicks_user_id ON public.offer_clicks(user_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_clicks_offer_id ON public.offer_clicks(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_clicks_provider_id ON public.offer_clicks(provider_id);
CREATE INDEX IF NOT EXISTS idx_offer_clicks_expires_at ON public.offer_clicks(expires_at);

-- ----------------------------------------------------------------------------
-- 5. OFFER COMPLETIONS (CONVERSIONS LEDGER) TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offer_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    offer_id UUID REFERENCES public.offers(id) ON DELETE RESTRICT,
    provider_id UUID NOT NULL REFERENCES public.offer_providers(id) ON DELETE RESTRICT,
    external_transaction_id TEXT NOT NULL,
    click_id UUID REFERENCES public.offer_clicks(id) ON DELETE RESTRICT,
    provider_reward NUMERIC(12, 4) NOT NULL CHECK (provider_reward >= 0),
    user_reward NUMERIC(12, 2) NOT NULL CHECK (user_reward >= 0),
    payvora_commission NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    status TEXT NOT NULL DEFAULT 'credited' CHECK (status IN ('pending', 'credited', 'partially_reversed', 'reversed', 'failed')),
    reversed_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (reversed_amount >= 0),
    credited_at TIMESTAMPTZ,
    reversed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_offer_completions_provider_tx UNIQUE (provider_id, external_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_offer_completions_user_id ON public.offer_completions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_completions_offer_id ON public.offer_completions(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_completions_click_id ON public.offer_completions(click_id);
CREATE INDEX IF NOT EXISTS idx_offer_completions_status ON public.offer_completions(status);

-- ----------------------------------------------------------------------------
-- 6. USER OFFER PROGRESS STATUS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offer_user_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE RESTRICT,
    click_id UUID REFERENCES public.offer_clicks(id) ON DELETE SET NULL,
    progress_status TEXT NOT NULL DEFAULT 'started' CHECK (progress_status IN ('started', 'pending', 'completed', 'reversed', 'failed')),
    reward_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status_note TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_offer_user_status UNIQUE (user_id, offer_id)
);

CREATE INDEX IF NOT EXISTS idx_offer_user_status_user ON public.offer_user_status(user_id, last_updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_user_status_offer ON public.offer_user_status(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_user_status_click ON public.offer_user_status(click_id);

-- ----------------------------------------------------------------------------
-- 7. PROVIDER SYNC LOGS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES public.offer_providers(id) ON DELETE CASCADE,
    sync_status TEXT NOT NULL CHECK (sync_status IN ('running', 'success', 'partial', 'failed', 'skipped')),
    offers_received INTEGER NOT NULL DEFAULT 0,
    offers_created INTEGER NOT NULL DEFAULT 0,
    offers_updated INTEGER NOT NULL DEFAULT 0,
    offers_deactivated INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_provider_sync_logs_provider_started ON public.provider_sync_logs(provider_id, started_at DESC);

-- ----------------------------------------------------------------------------
-- 8. PROVIDER POSTBACKS FORENSIC LOG TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_postbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID REFERENCES public.offer_providers(id) ON DELETE SET NULL,
    external_transaction_id TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('conversion', 'reversal', 'pending', 'unknown')),
    signature_valid BOOLEAN NOT NULL DEFAULT false,
    processing_status TEXT NOT NULL CHECK (processing_status IN ('processed', 'duplicate', 'rejected', 'error')),
    payload_hash TEXT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_provider_postbacks_lookup ON public.provider_postbacks(provider_id, external_transaction_id);
CREATE INDEX IF NOT EXISTS idx_provider_postbacks_received ON public.provider_postbacks(received_at DESC);

-- ----------------------------------------------------------------------------
-- 9. OFFER REWARD DISPUTES TABLE (MISSING REWARD SUPPORT WORKFLOW)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.offer_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    offer_id UUID REFERENCES public.offers(id) ON DELETE SET NULL,
    provider_id UUID REFERENCES public.offer_providers(id) ON DELETE SET NULL,
    click_id UUID REFERENCES public.offer_clicks(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'rejected')),
    admin_note TEXT,
    reviewed_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_offer_disputes_user ON public.offer_disputes(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_disputes_status ON public.offer_disputes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offer_disputes_provider ON public.offer_disputes(provider_id);
CREATE INDEX IF NOT EXISTS idx_offer_disputes_offer ON public.offer_disputes(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_disputes_click ON public.offer_disputes(click_id);
CREATE INDEX IF NOT EXISTS idx_offer_disputes_reviewed_by ON public.offer_disputes(reviewed_by);

-- ----------------------------------------------------------------------------
-- 10. STRICT ROW LEVEL SECURITY FOR ALL CUSTOM OFFERS TABLES
-- ----------------------------------------------------------------------------
ALTER TABLE public.offer_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_user_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_postbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_disputes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.offer_providers, public.offers, public.offer_clicks,
    public.offer_completions, public.offer_user_status, public.provider_sync_logs,
    public.provider_postbacks, public.offer_disputes FROM PUBLIC, anon;

GRANT SELECT ON public.offer_user_status, public.offer_completions, public.offer_disputes TO authenticated;
GRANT ALL ON public.offer_providers, public.offers, public.offer_clicks,
    public.offer_completions, public.offer_user_status, public.provider_sync_logs,
    public.provider_postbacks, public.offer_disputes TO service_role;

-- offer_providers: Admin only direct table access (Marketplace uses sanitized offers_api)
DROP POLICY IF EXISTS "Admins manage offer_providers" ON public.offer_providers;
CREATE POLICY "Admins manage offer_providers"
    ON public.offer_providers FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));

-- offers: Admin only direct access so destination_url is never leaked bypassing click attribution
DROP POLICY IF EXISTS "Admins manage offers" ON public.offers;
CREATE POLICY "Admins manage offers"
    ON public.offers FOR ALL
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'))
    WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));

-- offer_clicks: Admin & service_role only (opaque tokens & IP hashes stay private)
DROP POLICY IF EXISTS "Admins view offer_clicks" ON public.offer_clicks;
CREATE POLICY "Admins view offer_clicks"
    ON public.offer_clicks FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));

-- offer_completions: Active user sees own rows OR active admin sees all
DROP POLICY IF EXISTS "Users or admins read offer_completions" ON public.offer_completions;
CREATE POLICY "Users or admins read offer_completions"
    ON public.offer_completions FOR SELECT
    USING (
        (
            auth.uid() = user_id
            AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status != 'suspended')
        )
        OR EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active')
    );

-- offer_user_status: Active user sees own progress OR active admin sees all
DROP POLICY IF EXISTS "Users or admins read offer_user_status" ON public.offer_user_status;
CREATE POLICY "Users or admins read offer_user_status"
    ON public.offer_user_status FOR SELECT
    USING (
        (
            auth.uid() = user_id
            AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status != 'suspended')
        )
        OR EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active')
    );

-- provider_sync_logs: Admin only
DROP POLICY IF EXISTS "Admins read provider_sync_logs" ON public.provider_sync_logs;
CREATE POLICY "Admins read provider_sync_logs"
    ON public.provider_sync_logs FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));

-- provider_postbacks: Admin only
DROP POLICY IF EXISTS "Admins read provider_postbacks" ON public.provider_postbacks;
CREATE POLICY "Admins read provider_postbacks"
    ON public.provider_postbacks FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active'));

-- offer_disputes: Active user sees own disputes OR active admin manages all
DROP POLICY IF EXISTS "Users read own offer_disputes" ON public.offer_disputes;
CREATE POLICY "Users read own offer_disputes"
    ON public.offer_disputes FOR SELECT
    USING (
        (
            auth.uid() = user_id
            AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.status != 'suspended')
        )
        OR EXISTS (SELECT 1 FROM public.admin_users WHERE auth_user_id = auth.uid() AND status = 'active')
    );

-- ----------------------------------------------------------------------------
-- 11. ATOMIC OFFER CONVERSION PROCESSING RPC (SINGLE TRANSACTION)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_offer_conversion_atomic(
    p_provider_id UUID,
    p_provider_key TEXT,
    p_user_id UUID,
    p_offer_id UUID,
    p_click_id UUID,
    p_external_tx_id TEXT,
    p_provider_reward NUMERIC(12, 4),
    p_user_reward NUMERIC(12, 2),
    p_payvora_commission NUMERIC(12, 4),
    p_tx_type TEXT DEFAULT 'offer_reward',
    p_description TEXT DEFAULT NULL,
    p_raw_payload JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user public.users%ROWTYPE;
    v_existing_comp public.offer_completions%ROWTYPE;
    v_idem_key TEXT := format('offer_%s_%s', lower(p_provider_key), p_external_tx_id);
    v_credit_res JSONB;
    v_comp_id UUID;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    IF p_user_reward <= 0 OR p_provider_reward < 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Reward amounts must be positive.', 'code', 'INVALID_AMOUNT');
    END IF;

    IF p_tx_type NOT IN ('offer_reward', 'survey_reward') THEN
        p_tx_type := 'offer_reward';
    END IF;

    -- Lock user row FIRST so concurrent duplicate postbacks serialize deterministically
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found.', 'code', 'USER_NOT_FOUND');
    END IF;

    IF v_user.status = 'suspended' THEN
        RETURN jsonb_build_object('success', false, 'error', 'User account is suspended.', 'code', 'USER_SUSPENDED');
    END IF;

    -- Check conversion deduplication table AND legacy offerwall_logs
    SELECT * INTO v_existing_comp
    FROM public.offer_completions
    WHERE provider_id = p_provider_id
      AND external_transaction_id = p_external_tx_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'completion_id', v_existing_comp.id,
            'wallet_balance', v_user.wallet_balance
        );
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.offerwall_logs
        WHERE provider = lower(p_provider_key)
          AND external_transaction_id = p_external_tx_id
    ) THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'wallet_balance', v_user.wallet_balance
        );
    END IF;

    -- Credit wallet & automatically handle 10% referral commission via hardened atomic_wallet_credit()
    v_credit_res := public.atomic_wallet_credit(
        p_user_id,
        p_user_reward,
        p_tx_type,
        v_idem_key,
        p_external_tx_id,
        COALESCE(p_description, format('%s Offer Reward (Tx: %s)', UPPER(p_provider_key), p_external_tx_id))
    );

    IF COALESCE((v_credit_res->>'already_processed')::boolean, false) THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'wallet_balance', COALESCE((v_credit_res->>'wallet_balance')::numeric, v_user.wallet_balance)
        );
    END IF;

    -- Record normalized completion row (protected by unique constraint on provider_id + external_transaction_id)
    BEGIN
        INSERT INTO public.offer_completions (
            user_id, offer_id, provider_id, external_transaction_id, click_id,
            provider_reward, user_reward, payvora_commission, status, credited_at
        ) VALUES (
            p_user_id, p_offer_id, p_provider_id, p_external_tx_id, p_click_id,
            p_provider_reward, p_user_reward, p_payvora_commission, 'credited', v_now
        )
        RETURNING id INTO v_comp_id;
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_processed', true,
            'wallet_balance', COALESCE((v_credit_res->>'wallet_balance')::numeric, v_user.wallet_balance)
        );
    END;

    -- Update click status if attributed
    IF p_click_id IS NOT NULL THEN
        UPDATE public.offer_clicks
        SET status = 'converted'
        WHERE id = p_click_id AND status = 'clicked';
    END IF;

    -- Upsert user offer progress if linked to a catalog offer
    IF p_offer_id IS NOT NULL THEN
        INSERT INTO public.offer_user_status (
            user_id, offer_id, click_id, progress_status, reward_amount,
            status_note, started_at, completed_at, last_updated_at
        ) VALUES (
            p_user_id, p_offer_id, p_click_id, 'completed', p_user_reward,
            format('Credited via %s', UPPER(p_provider_key)), v_now, v_now, v_now
        )
        ON CONFLICT (user_id, offer_id) DO UPDATE
        SET click_id = COALESCE(EXCLUDED.click_id, offer_user_status.click_id),
            progress_status = 'completed',
            reward_amount = offer_user_status.reward_amount + EXCLUDED.reward_amount,
            status_note = EXCLUDED.status_note,
            completed_at = v_now,
            last_updated_at = v_now;
    END IF;

    -- Maintain backward compatibility with legacy offerwall_logs ledger
    INSERT INTO public.offerwall_logs (
        provider, external_transaction_id, user_id, amount, status, raw_payload
    ) VALUES (
        lower(p_provider_key), p_external_tx_id, p_user_id, p_user_reward, 'credited', COALESCE(p_raw_payload, '{}'::jsonb)
    )
    ON CONFLICT (provider, external_transaction_id) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'completion_id', v_comp_id,
        'credited_amount', p_user_reward,
        'wallet_balance', COALESCE((v_credit_res->>'wallet_balance')::numeric, v_user.wallet_balance + p_user_reward)
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_offer_conversion_atomic(UUID, TEXT, UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_offer_conversion_atomic(UUID, TEXT, UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT, JSONB) TO service_role;

-- ----------------------------------------------------------------------------
-- 12. ATOMIC OFFER REVERSAL / PARTIAL CHARGEBACK & REFERRAL CLAWBACK RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_offer_reversal_atomic(
    p_provider_id UUID,
    p_provider_key TEXT,
    p_user_id UUID,
    p_external_tx_id TEXT,
    p_reversal_user_amount NUMERIC(12, 2),
    p_reversal_tx_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user public.users%ROWTYPE;
    v_comp public.offer_completions%ROWTYPE;
    v_has_comp BOOLEAN := false;
    v_orig_reward NUMERIC(12, 2) := 0.00;
    v_already_reversed NUMERIC(12, 2) := 0.00;
    v_remaining_reversible NUMERIC(12, 2) := 0.00;
    v_target_reverse NUMERIC(12, 2) := 0.00;
    v_actual_deduct NUMERIC(12, 2) := 0.00;
    v_deficit NUMERIC(12, 2) := 0.00;
    v_new_balance NUMERIC(12, 2);
    v_new_reversed_total NUMERIC(12, 2);
    v_rev_status TEXT;
    v_rev_key TEXT;
    v_referrer_id UUID;
    v_ref_user public.users%ROWTYPE;
    v_comm_reversal NUMERIC(12, 2) := 0.00;
    v_actual_comm_deduct NUMERIC(12, 2) := 0.00;
    v_ref_new_balance NUMERIC(12, 2);
    v_ref_rev_key TEXT;
    v_orig_idem_prefix TEXT := lower(p_provider_key) || '_' || p_external_tx_id;
BEGIN
    SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'User not found.', 'code', 'USER_NOT_FOUND');
    END IF;

    v_rev_key := CASE
        WHEN p_reversal_tx_id IS NOT NULL AND length(trim(p_reversal_tx_id)) > 0
            THEN format('rev_%s_%s_%s', lower(p_provider_key), p_external_tx_id, trim(p_reversal_tx_id))
        ELSE format('rev_%s_%s', lower(p_provider_key), p_external_tx_id)
    END;

    IF EXISTS (SELECT 1 FROM public.transactions WHERE idempotency_key = v_rev_key) THEN
        RETURN jsonb_build_object('success', true, 'already_processed', true, 'deducted', 0, 'wallet_balance', v_user.wallet_balance);
    END IF;

    -- Locate original completion in offer_completions first, falling back to legacy offerwall_logs
    SELECT * INTO v_comp
    FROM public.offer_completions
    WHERE provider_id = p_provider_id
      AND external_transaction_id = p_external_tx_id
    FOR UPDATE;

    IF FOUND THEN
        v_has_comp := true;
        v_orig_reward := COALESCE(v_comp.user_reward, 0.00);
        v_already_reversed := COALESCE(v_comp.reversed_amount, 0.00);
    ELSE
        SELECT COALESCE(amount, 0.00) INTO v_orig_reward
        FROM public.offerwall_logs
        WHERE provider = lower(p_provider_key)
          AND external_transaction_id = p_external_tx_id
        LIMIT 1;

        IF NOT FOUND OR v_orig_reward <= 0 THEN
            RETURN jsonb_build_object('success', true, 'already_processed', false, 'deducted', 0, 'note', 'No prior credited transaction found');
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.offerwall_logs
            WHERE provider = lower(p_provider_key)
              AND external_transaction_id = p_external_tx_id
              AND status = 'reversed'
        ) THEN
            RETURN jsonb_build_object('success', true, 'already_processed', true, 'deducted', 0, 'wallet_balance', v_user.wallet_balance);
        END IF;
    END IF;

    v_remaining_reversible := GREATEST(0.00, v_orig_reward - v_already_reversed);
    IF v_remaining_reversible <= 0 THEN
        RETURN jsonb_build_object('success', true, 'already_processed', true, 'deducted', 0, 'wallet_balance', v_user.wallet_balance);
    END IF;

    -- Never deduct more than the verified reversal amount (and clamp to remaining reversible amount)
    IF COALESCE(p_reversal_user_amount, 0.00) > 0 THEN
        v_target_reverse := LEAST(v_remaining_reversible, p_reversal_user_amount);
    ELSE
        v_target_reverse := v_remaining_reversible;
    END IF;

    -- Clamp deduction against current non-negative wallet policy (CHECK wallet_balance >= 0.00)
    v_actual_deduct := LEAST(GREATEST(v_user.wallet_balance, 0.00), v_target_reverse);
    v_deficit := ROUND(GREATEST(0.00, v_target_reverse - v_actual_deduct), 2);
    v_new_balance := ROUND(GREATEST(0.00, v_user.wallet_balance - v_actual_deduct), 2);

    IF v_actual_deduct > 0 THEN
        UPDATE public.users
        SET wallet_balance = v_new_balance
        WHERE id = p_user_id;
    END IF;

    BEGIN
        INSERT INTO public.transactions (
            user_id, amount, type, status, balance_before, balance_after,
            idempotency_key, reference_id, description
        ) VALUES (
            p_user_id, -v_actual_deduct, 'manual_adjustment', 'reversed',
            v_user.wallet_balance, v_new_balance, v_rev_key,
            p_external_tx_id,
            format('%s Offer Reversal (Tx: %s%s)',
                UPPER(p_provider_key),
                p_external_tx_id,
                CASE WHEN v_deficit > 0 THEN format(', unrecovered deficit: $%s', v_deficit) ELSE '' END
            )
        );
    EXCEPTION WHEN unique_violation THEN
        RETURN jsonb_build_object('success', true, 'already_processed', true, 'deducted', 0, 'wallet_balance', v_user.wallet_balance);
    END;

    -- Proportional Referral Commission Reversal (10% of reversed offer reward)
    SELECT referrer_id INTO v_referrer_id FROM public.referrals WHERE referred_user_id = p_user_id;
    IF v_referrer_id IS NOT NULL AND v_referrer_id != p_user_id THEN
        v_comm_reversal := ROUND(v_target_reverse * 0.10, 2);
        v_ref_rev_key := 'ref_' || v_rev_key;

        IF v_comm_reversal > 0 AND (
            EXISTS (SELECT 1 FROM public.transactions WHERE user_id = v_referrer_id AND type = 'referral_commission' AND (reference_id = 'offer_' || v_orig_idem_prefix OR reference_id = v_orig_idem_prefix))
        ) THEN
            SELECT * INTO v_ref_user FROM public.users WHERE id = v_referrer_id FOR UPDATE;
            IF FOUND THEN
                v_actual_comm_deduct := LEAST(GREATEST(v_ref_user.wallet_balance, 0.00), v_comm_reversal);
                v_ref_new_balance := ROUND(GREATEST(0.00, v_ref_user.wallet_balance - v_actual_comm_deduct), 2);

                IF v_actual_comm_deduct > 0 THEN
                    UPDATE public.users
                    SET wallet_balance = v_ref_new_balance
                    WHERE id = v_referrer_id;
                END IF;

                INSERT INTO public.transactions (
                    user_id, amount, type, status, balance_before, balance_after,
                    idempotency_key, reference_id, description
                ) VALUES (
                    v_referrer_id, -v_actual_comm_deduct, 'manual_adjustment', 'reversed',
                    v_ref_user.wallet_balance, v_ref_new_balance, v_ref_rev_key,
                    p_external_tx_id,
                    format('Referral commission clawback for reversed %s offer (Tx: %s)', UPPER(p_provider_key), p_external_tx_id)
                )
                ON CONFLICT (idempotency_key) DO NOTHING;

                UPDATE public.referrals
                SET total_commission_earned = GREATEST(0.00, total_commission_earned - v_actual_comm_deduct)
                WHERE referrer_id = v_referrer_id AND referred_user_id = p_user_id;
            END IF;
        END IF;
    END IF;

    v_new_reversed_total := LEAST(v_orig_reward, v_already_reversed + v_target_reverse);
    v_rev_status := CASE WHEN v_new_reversed_total >= v_orig_reward THEN 'reversed' ELSE 'partially_reversed' END;

    IF v_has_comp THEN
        UPDATE public.offer_completions
        SET reversed_amount = v_new_reversed_total,
            status = v_rev_status,
            reversed_at = NOW()
        WHERE id = v_comp.id;

        IF v_comp.offer_id IS NOT NULL AND v_rev_status = 'reversed' THEN
            UPDATE public.offer_user_status
            SET progress_status = 'reversed',
                status_note = format('Reversed by %s (Tx: %s)', UPPER(p_provider_key), p_external_tx_id),
                last_updated_at = NOW()
            WHERE user_id = p_user_id AND offer_id = v_comp.offer_id;
        END IF;
    END IF;

    UPDATE public.offerwall_logs
    SET status = 'reversed'
    WHERE provider = lower(p_provider_key) AND external_transaction_id = p_external_tx_id;

    RETURN jsonb_build_object(
        'success', true,
        'already_processed', false,
        'status', v_rev_status,
        'requested_reversal', v_target_reverse,
        'deducted', v_actual_deduct,
        'unrecovered_deficit', v_deficit,
        'referral_commission_reversed', v_actual_comm_deduct,
        'wallet_balance', v_new_balance
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_offer_reversal_atomic(UUID, TEXT, UUID, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_offer_reversal_atomic(UUID, TEXT, UUID, TEXT, NUMERIC, TEXT) TO service_role;
