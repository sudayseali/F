-- Copy and paste this into your Supabase SQL Editor and click Run

CREATE POLICY "Enable read access for all users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Enable insert for users based on telegram_id" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for users based on telegram_id" ON public.users FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all tasks" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Enable read access for all submissions" ON public.submissions FOR SELECT USING (true);
CREATE POLICY "Enable read access for all transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Enable read access for all withdrawals" ON public.withdrawals FOR SELECT USING (true);
CREATE POLICY "Enable read access for all referrals" ON public.referrals FOR SELECT USING (true);
