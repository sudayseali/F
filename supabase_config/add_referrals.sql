-- Run this SQL in your Supabase SQL Editor to add Referral support
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID REFERENCES public.users(id) NOT NULL,
  referred_user_id UUID REFERENCES public.users(id) NOT NULL UNIQUE,
  earned NUMERIC(10, 2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read their referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id);

-- Make sure transactions table can accept 'referral_bonus' if not already
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (type in ('deposit', 'withdrawal', 'reward', 'refund', 'fee', 'referral_bonus'));
