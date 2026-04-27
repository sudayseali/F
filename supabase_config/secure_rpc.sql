-- SECURE RPC FUNCTIONS FOR FINANCIAL TRANSACTIONS
-- Waxyaabahan Database-ka ayay ka dhex soconayaan si hackers-ku aysan frontend u khalkhal galin.

-- 1. SECURE WITHDRAWAL FUNCTION (Ka hortagga Balance-ka been abuurka ah)
-- This prevents "Race Conditions" or Hackers trying to send 10 withdrawal requests at the exact same millisecond
create or replace function request_withdrawal(user_id_param uuid, amount_param numeric, wallet_address text, crypto_method text)
returns json
language plpgsql
security definer
as $$
declare
  v_current_balance numeric;
  v_tx_id uuid;
begin
  -- 1. Qaado balance-ka oo xiro (Lock row to prevent double-spending in parallel requests)
  select balance into v_current_balance
  from public.users
  where id = user_id_param
  for update; -- FOR UPDATE locks the row until transaction finishes

  -- 2. Hubi in lacagtu ku filan tahay
  if v_current_balance < amount_param then
    return json_build_object('success', false, 'error', 'Insufficient balance. Hackers blocked!');
  end if;

  if amount_param <= 0 then
    return json_build_object('success', false, 'error', 'Amount must be greater than zero.');
  end if;

  -- 3. Jaro lacagta markiiba (Deduct immediately)
  update public.users 
  set balance = balance - amount_param 
  where id = user_id_param;

  -- 4. Geli diiwaanka Transaction-ka inuu sugayo admin approval (Pending)
  insert into public.transactions (user_id, amount, type, status, reference_id)
  values (user_id_param, amount_param, 'withdrawal', 'pending', crypto_method || ':' || wallet_address)
  returning id into v_tx_id;

  return json_build_object('success', true, 'transaction_id', v_tx_id, 'new_balance', v_current_balance - amount_param);
end;
$$;


-- 2. SECURE TASK SUBMISSION (Ka hortagga in shaqo ka badan tiradii loogu talagalay la qabto)
create or replace function submit_task_proof(user_id_param uuid, task_id_param uuid, proof_text text, user_ip text)
returns json
language plpgsql
security definer
as $$
declare
  v_max_completions int;
  v_current_completions int;
  v_task_status text;
begin
  -- Lock task row to check quotas safely
  select max_completions, current_completions, status 
  into v_max_completions, v_current_completions, v_task_status
  from public.tasks
  where id = task_id_param
  for update;

  if v_task_status != 'active' then
    return json_build_object('success', false, 'error', 'Task is no longer active.');
  end if;

  if v_current_completions >= v_max_completions then
    return json_build_object('success', false, 'error', 'Task quota fulfilled. You cannot submit.');
  end if;

  -- Geli Submissions-ka
  insert into public.submissions (task_id, worker_id, proof, status, ip_address)
  values (task_id_param, user_id_param, proof_text, 'pending', user_ip);

  -- Kordhi tirada dadka qabtay shaqada
  update public.tasks 
  set current_completions = current_completions + 1 
  where id = task_id_param;

  -- If full, auto-pause it
  if (v_current_completions + 1) >= v_max_completions then
    update public.tasks set status = 'completed' where id = task_id_param;
  end if;

  return json_build_object('success', true, 'message', 'Proof submitted securely.');
end;
$$;
