-- Clean Initial Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
DROP TABLE IF EXISTS public.users CASCADE;
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    wallet_balance NUMERIC(10, 2) DEFAULT 0.00,
    level TEXT DEFAULT 'basic',
    total_earned NUMERIC(10, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'active',
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    amount NUMERIC(10, 2) NOT NULL,
    type TEXT NOT NULL, -- reward, withdrawal, task_reward, referral_commission
    status TEXT DEFAULT 'completed',
    reference_id TEXT UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Withdrawals Table
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    amount NUMERIC(10, 2) NOT NULL,
    method TEXT NOT NULL,
    payment_details TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    requested_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Referrals Table
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID REFERENCES public.users(id),
    referred_user_id UUID REFERENCES public.users(id) UNIQUE,
    total_commission_earned NUMERIC(10, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advertiser_id UUID REFERENCES public.users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reward NUMERIC(10, 2) NOT NULL,
  slots INTEGER NOT NULL,
  slots_filled INTEGER DEFAULT 0,
  proof_type TEXT NOT NULL,
  target_url TEXT,
  platform TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- 6. Submissions Table
CREATE TABLE IF NOT EXISTS public.submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES public.tasks(id),
  user_id UUID REFERENCES public.users(id),
  proof_data TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(task_id, user_id)
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- 7. Functions
CREATE OR REPLACE FUNCTION public.reward_user(user_id UUID, amount NUMERIC)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referrer_id UUID;
    v_commission NUMERIC;
BEGIN
    -- 1. Reward the user
    UPDATE public.users 
    SET wallet_balance = wallet_balance + amount,
        total_earned = total_earned + amount
    WHERE id = user_id;

    -- 2. Record transaction for the user
    INSERT INTO public.transactions (user_id, amount, type)
    VALUES (user_id, amount, 'task_reward');

    -- 3. Check for referral
    SELECT referrer_id INTO v_referrer_id
    FROM public.referrals
    WHERE referred_user_id = user_id;

    -- 4. Reward the referrer (10%)
    IF v_referrer_id IS NOT NULL THEN
        v_commission := amount * 0.10;
        
        -- Update referrer's balance
        UPDATE public.users 
        SET wallet_balance = wallet_balance + v_commission,
            total_earned = total_earned + v_commission
        WHERE id = v_referrer_id;

        -- Record transaction for referrer
        INSERT INTO public.transactions (user_id, amount, type)
        VALUES (v_referrer_id, v_commission, 'referral_commission');

        -- Update total commission earned in referrals table
        UPDATE public.referrals
        SET total_commission_earned = total_commission_earned + v_commission
        WHERE referrer_id = v_referrer_id AND referred_user_id = user_id;
    END IF;
END;
$$;
DROP POLICY IF EXISTS "Allow all select" ON public.users;
DROP POLICY IF EXISTS "Allow all insert" ON public.users;
DROP POLICY IF EXISTS "Allow all update" ON public.users;
DROP POLICY IF EXISTS "Allow all select transactions" ON public.transactions;
DROP POLICY IF EXISTS "Allow all select withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Allow all select referrals" ON public.referrals;
DROP POLICY IF EXISTS "Allow all select tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow all select submissions" ON public.submissions;

CREATE POLICY "Allow all select" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.users FOR UPDATE USING (true);
CREATE POLICY "Allow all select transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Allow all select withdrawals" ON public.withdrawals FOR SELECT USING (true);
CREATE POLICY "Allow all select referrals" ON public.referrals FOR SELECT USING (true);
CREATE POLICY "Allow all select tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Allow all select submissions" ON public.submissions FOR SELECT USING (true);
