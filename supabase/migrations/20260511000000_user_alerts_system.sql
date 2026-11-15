-- ============================================================================
-- PAYVORA: REFERRAL, TASK & OFFERS ALERTS SYSTEM
-- Migration: 20260511000000_user_alerts_system.sql
-- ============================================================================

-- 1. User Alert Preferences on public.users
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS alert_prefs JSONB NOT NULL DEFAULT '{"referral": true, "task": true, "offer": true, "telegram_push": true}'::jsonb;

-- 2. Persistent Notifications Inbox Table
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('referral', 'task', 'offer', 'system')),
    event_key TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    amount NUMERIC(12, 2),
    action_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    telegram_sent BOOLEAN NOT NULL DEFAULT false,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created
    ON public.user_notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_notifications_unread
    ON public.user_notifications(user_id, is_read)
    WHERE is_read = false;

-- 3. Strict Row Level Security (Users can only read their own alerts; writes via service_role)
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.user_notifications;
CREATE POLICY "Users can view own notifications"
    ON public.user_notifications FOR SELECT
    USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.user_notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;

-- 4. Enable Supabase Realtime on user_notifications (safe idempotent block)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'user_notifications'
        ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
        END IF;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;
