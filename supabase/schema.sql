-- Micro Task Platform Schema
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id BIGINT UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  wallet_balance NUMERIC(10, 2) DEFAULT 0.00,
  level TEXT DEFAULT 'basic',
  total_earned NUMERIC(10, 2) DEFAULT 0.00,
  status TEXT DEFAULT 'active', -- active, suspended
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tasks Table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  advertiser_id UUID REFERENCES public.users(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reward NUMERIC(10, 2) NOT NULL,
  slots INTEGER NOT NULL,
  slots_filled INTEGER DEFAULT 0,
  proof_type TEXT NOT NULL, -- image, text, url
  target_url TEXT,
  platform TEXT, -- telegram, youtube, tiktok, web
  status TEXT DEFAULT 'active', -- active, paused, completed
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- 3. Submissions Table
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES public.tasks(id),
  user_id UUID REFERENCES public.users(id),
  proof_data TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE(task_id, user_id) -- Prevent duplicate submissions
);

-- 4. Transactions Table
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  amount NUMERIC(10, 2) NOT NULL,
  type TEXT NOT NULL, -- reward, withdrawal, deposit, referral_bonus
  description TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Withdrawals Table
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  amount NUMERIC(10, 2) NOT NULL,
  method TEXT NOT NULL, -- trx, evc_plus
  payment_details TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, paid, rejected
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 6. Referrals Table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES public.users(id),
  referred_user_id UUID REFERENCES public.users(id) UNIQUE,
  total_commission_earned NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
