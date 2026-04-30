-- 5. Withdrawals Table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  amount NUMERIC(10, 2) NOT NULL,
  method TEXT NOT NULL, -- payeer, trx, zaad
  payment_details TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, approved, paid, rejected
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- 6. Referrals Table
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES public.users(id),
  referred_user_id UUID REFERENCES public.users(id) UNIQUE,
  total_commission_earned NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own withdrawals" ON public.withdrawals;
CREATE POLICY "Users can read own withdrawals" ON public.withdrawals 
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own referrals" ON public.referrals;
CREATE POLICY "Users can read own referrals" ON public.referrals 
  FOR SELECT USING (auth.uid() = referrer_id);
