-- Enable read access for all users
DROP POLICY IF EXISTS "Enable read access for all users" ON public.users;
DROP POLICY IF EXISTS "Enable insert for users based on telegram_id" ON public.users;
DROP POLICY IF EXISTS "Enable update for users based on telegram_id" ON public.users;

DROP POLICY IF EXISTS "Enable read access for all tasks" ON public.tasks;
DROP POLICY IF EXISTS "Enable read access for all submissions" ON public.submissions;
DROP POLICY IF EXISTS "Enable read access for all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Enable read access for all withdrawals" ON public.withdrawals;
DROP POLICY IF EXISTS "Enable read access for all referrals" ON public.referrals;

CREATE POLICY "Enable read access for all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Enable insert for users based on telegram_id" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for users based on telegram_id" ON public.users FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Enable read access for all submissions" ON public.submissions FOR SELECT USING (true);
CREATE POLICY "Enable read access for all transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Enable read access for all withdrawals" ON public.withdrawals FOR SELECT USING (true);
CREATE POLICY "Enable read access for all referrals" ON public.referrals FOR SELECT USING (true);
