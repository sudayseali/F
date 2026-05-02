-- Clean Initial Schema
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT,
    wallet_balance NUMERIC(10, 2) DEFAULT 0.00,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    amount NUMERIC(10, 2) NOT NULL,
    type TEXT NOT NULL, -- reward, withdrawal
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

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for development)
CREATE POLICY "Allow all select" ON public.users FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.users FOR UPDATE USING (true);
CREATE POLICY "Allow all select transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Allow all select withdrawals" ON public.withdrawals FOR SELECT USING (true);
