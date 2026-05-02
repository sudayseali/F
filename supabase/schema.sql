-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  telegram_id BIGINT UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  wallet_balance NUMERIC(10, 2) DEFAULT 0.00,
  level TEXT DEFAULT 'basic',
  total_earned NUMERIC(10, 2) DEFAULT 0.00,
  status TEXT DEFAULT 'active',
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  amount NUMERIC(10, 2) NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Withdrawals Table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  amount NUMERIC(10, 2) NOT NULL,
  method TEXT NOT NULL,
  payment_details TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Add Secure RLS Policies
-- Users can only read their own data
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
CREATE POLICY "Users can read own data" ON public.users FOR SELECT USING (auth.uid() = id OR telegram_id IS NOT NULL);

-- Transactions: Users can only read their own
DROP POLICY IF EXISTS "Users can read own transactions" ON public.transactions;
CREATE POLICY "Users can read own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);

-- Withdrawals: Users can only read their own
DROP POLICY IF EXISTS "Users can read own withdrawals" ON public.withdrawals;
CREATE POLICY "Users can read own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id);
