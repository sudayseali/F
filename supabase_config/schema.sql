-- SUPABASE SECURE SCHEMA FOR TELEGRAM MINI APP

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ==========================================
-- 1. USERS TABLE
-- ==========================================
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  telegram_id bigint unique not null,
  username text,
  first_name text,
  last_name text,
  role text default 'user' check (role in ('user', 'admin', 'moderator')),
  balance numeric(10, 2) default 0.00 check (balance >= 0), -- Prevents negative balance (Hack prevention)
  is_banned boolean default false,
  created_at timestamp with time zone default now()
);

-- ==========================================
-- 2. TASKS TABLE
-- ==========================================
create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  advertiser_id uuid references public.users(id) not null,
  title text not null,
  description text,
  reward numeric(10, 2) not null check (reward > 0),
  max_completions int not null check (max_completions > 0),
  current_completions int default 0,
  status text default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  created_at timestamp with time zone default now()
);

-- ==========================================
-- 3. SUBMISSIONS TABLE
-- ==========================================
create table if not exists public.submissions (
  id uuid primary key default uuid_generate_v4(),
  task_id uuid references public.tasks(id) not null,
  worker_id uuid references public.users(id) not null,
  proof text not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'disputed')),
  ip_address text, -- Useful for detecting multi-accounting (Fraud prevention)
  created_at timestamp with time zone default now(),
  unique(task_id, worker_id) -- Prevents a user doing the same task multiple times
);

-- ==========================================
-- 4. TRANSACTIONS TABLE
-- ==========================================
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) not null,
  amount numeric(10, 2) not null,
  type text check (type in ('deposit', 'withdrawal', 'reward', 'refund', 'fee')),
  status text default 'pending' check (status in ('pending', 'completed', 'failed')),
  reference_id text,
  created_at timestamp with time zone default now()
);

-- ==========================================
-- SECURITY: ROW LEVEL SECURITY (RLS)
-- ==========================================
alter table public.users enable row level security;
alter table public.tasks enable row level security;
alter table public.submissions enable row level security;
alter table public.transactions enable row level security;

-- Drop existing policies if they exist so we can re-run this script safely
drop policy if exists "Users can read own data" on public.users;
drop policy if exists "Anyone can read active tasks" on public.tasks;
drop policy if exists "Advertisers can manage their tasks" on public.tasks;
drop policy if exists "Workers can read own submissions" on public.submissions;
drop policy if exists "Workers can insert submissions" on public.submissions;
drop policy if exists "Advertisers can read submissions for their tasks" on public.submissions;
drop policy if exists "Users can read own transactions" on public.transactions;

-- Users can only read their own data
create policy "Users can read own data" on public.users 
  for select using (auth.uid() = id);

-- Anyone can see active tasks
create policy "Anyone can read active tasks" on public.tasks 
  for select using (status = 'active');

-- Advertisers can manage their own tasks
create policy "Advertisers can manage their tasks" on public.tasks 
  for all using (auth.uid() = advertiser_id);

-- Workers can read their own submissions
create policy "Workers can read own submissions" on public.submissions 
  for select using (auth.uid() = worker_id);

-- Workers can insert submissions (must be their own ID)
create policy "Workers can insert submissions" on public.submissions 
  for insert with check (auth.uid() = worker_id AND status = 'pending');

-- Advertisers can read submissions for tasks they created
create policy "Advertisers can read submissions for their tasks" on public.submissions 
  for select using (
    auth.uid() in (select advertiser_id from public.tasks where id = task_id)
  );

-- Users can read their own transactions
create policy "Users can read own transactions" on public.transactions 
  for select using (auth.uid() = user_id);

-- ==========================================
-- FUNCTION: SECURE TRANSACTION (ACID COMPLIANT)
-- ==========================================
-- This function runs entirely on the database side to prevent race conditions
-- and tampering if hackers try to approve their own tasks or double spend.
create or replace function approve_submission_and_reward(sub_id uuid, adv_id uuid)
returns void
language plpgsql
security definer -- Runs with elevated privileges, bypassing RLS safely from inside DB
as $$
declare
  v_task_id uuid;
  v_worker_id uuid;
  v_reward numeric;
  v_status text;
begin
  -- Lock row for update to prevent concurrent race condition attacks (double spending)
  select task_id, worker_id, status into v_task_id, v_worker_id, v_status
  from public.submissions
  where id = sub_id for update;

  if v_status != 'pending' then
    raise exception 'Submission is not pending.';
  end if;

  -- Ensure the advertiser actually owns the task
  select reward into v_reward from public.tasks where id = v_task_id and advertiser_id = adv_id;
  if not found then
    raise exception 'Unauthorized: You do not own this task.';
  end if;

  -- Update submission
  update public.submissions set status = 'approved' where id = sub_id;

  -- Add money to worker safely
  update public.users set balance = balance + v_reward where id = v_worker_id;

  -- Record transaction securely
  insert into public.transactions (user_id, amount, type, status)
  values (v_worker_id, v_reward, 'reward', 'completed');
end;
$$;
