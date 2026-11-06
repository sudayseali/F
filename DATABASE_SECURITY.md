# PAYVORA — Database Security & Schema Architecture

**Database Engine**: PostgreSQL 15+ (Supabase)  
**Security Model**: Row-Level Security (RLS) + SECURITY DEFINER Atomic Stored Procedures

---

## 1. Relational Schema Architecture

The database architecture is designed with explicit integrity constraints, check constraints, foreign keys, and indexes for high concurrency.

```
                      ┌──────────────────────┐
                      │     admin_users      │
                      │  (id, role, active)  │
                      └──────────┬───────────┘
                                 │
                                 ▼
┌───────────────────┐  ┌──────────────────────┐  ┌───────────────────┐
│   app_settings    │  │      audit_logs      │  │  offerwall_logs   │
│  (key, value)     │  │  (actor, action, ip) │  │(network, tx_id, $)│
└───────────────────┘  └──────────────────────┘  └───────────────────┘
                                 
                                 ┌──────────────────────┐
                                 │        users         │
                                 │ (id, telegram_id, $) │
                                 └──────────┬───────────┘
                                            │
        ┌───────────────────┬───────────────┼───────────────────┐
        ▼                   ▼               ▼                   ▼
┌──────────────┐    ┌──────────────┐ ┌──────────────┐    ┌──────────────┐
│ transactions │    │ withdrawals  │ │ submissions  │    │  referrals   │
│(user_id, +/-)│    │(user_id, st) │ │(user, task)  │    │(referrer, ref│
└──────────────┘    └──────────────┘ └──────┬───────┘    └──────────────┘
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │    tasks     │
                                     │ (reward, st) │
                                     └──────────────┘
```

---

## 2. Table Specifications & Security Constraints

### 2.1 `public.users`
- **Primary Key**: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- **Unique Columns**: `telegram_id BIGINT UNIQUE NOT NULL`, `referral_code VARCHAR(32) UNIQUE`
- **Integrity Constraints**:
  - `CONSTRAINT check_positive_balance CHECK (wallet_balance >= 0)`: **Enforces at the database level that no account balance can ever drop below zero.**
  - `CONSTRAINT check_valid_earned CHECK (total_earned >= 0)`
- **Columns**: `id`, `telegram_id`, `username`, `first_name`, `wallet_balance`, `total_earned`, `total_withdrawn`, `referral_code`, `referred_by`, `status`, `created_at`, `updated_at`.

### 2.2 `public.withdrawals`
- **Primary Key**: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- **Foreign Keys**: `user_id REFERENCES public.users(id) ON DELETE CASCADE`
- **Integrity Constraints**:
  - `CONSTRAINT check_withdrawal_amount CHECK (amount >= 1.0)`
  - `status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'rejected'))`

### 2.3 `public.transactions`
- **Primary Key**: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- **Foreign Keys**: `user_id REFERENCES public.users(id) ON DELETE CASCADE`
- **Unique Columns**: `idempotency_key VARCHAR(120) UNIQUE`
- **Integrity Constraints**:
  - `type VARCHAR(30) CHECK (type IN ('task_reward', 'survey_reward', 'referral_bonus', 'withdrawal_reserve', 'withdrawal_refund', 'manual_adjustment'))`

### 2.4 `public.admin_users`
- **Primary Key**: `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
- **Integrity Constraints**:
  - `role VARCHAR(30) CHECK (role IN ('super_admin', 'finance_admin', 'moderator'))`

### 2.5 `public.audit_logs`
- **Primary Key**: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- **Audit Columns**: `actor_id UUID`, `actor_type VARCHAR(20)`, `action VARCHAR(60)`, `target_type VARCHAR(40)`, `target_id VARCHAR(100)`, `details JSONB`, `ip_address VARCHAR(45)`, `created_at TIMESTAMP WITH TIME ZONE`.

---

## 3. Row-Level Security (RLS) Policy Matrix

Row-Level Security is enabled across all tables (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).

| Table | `SELECT` Policy | `INSERT` Policy | `UPDATE` Policy | `DELETE` Policy |
| :--- | :--- | :--- | :--- | :--- |
| `users` | Own record (`auth.uid() = id`) OR active admin | Service role only | Service role only (direct balance writes blocked) | Denied |
| `withdrawals` | Own records (`auth.uid() = user_id`) OR active admin | Service role / RPC only | Active admin (`manage_withdrawals`) | Denied |
| `transactions` | Own records (`auth.uid() = user_id`) OR active admin | Service role / RPC only | Denied (Immutable ledger) | Denied |
| `tasks` | All users (`status = 'active'`) OR active admin | Active admin (`manage_tasks`) | Active admin (`manage_tasks`) | Active admin |
| `submissions` | Own records (`auth.uid() = user_id`) OR active admin | Authenticated users (own records) | Active admin (`review_submissions`) | Denied |
| `referrals` | Referrer can view own referrals OR active admin | Service role only | Service role only | Denied |
| `offerwall_logs`| Service role / Active admin only | Service role only | Denied | Denied |
| `admin_users` | Active admins only | Super admin only | Super admin only | Super admin only |
| `app_settings` | Authenticated users (public settings) | Active admin (`manage_settings`) | Active admin (`manage_settings`) | Super admin |
| `audit_logs` | Active admins (`view_audit_logs`) | Service role only | Denied (Immutable log) | Denied |

---

## 4. Stored Procedures & Atomic Row-Locking

All financial and balance-modifying operations are executed through hardened `SECURITY DEFINER` procedures with pessimistic concurrency control (`SELECT ... FOR UPDATE`).

### 4.1 `request_withdrawal()`
Prevents double-spending and race conditions when users initiate withdrawals:

```sql
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_user_id UUID,
  p_amount NUMERIC,
  p_method VARCHAR,
  p_address VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_balance NUMERIC;
  v_status VARCHAR;
  v_withdrawal_id UUID;
BEGIN
  -- Acquire row-level lock on the user record
  SELECT wallet_balance, status INTO v_balance, v_status
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_status != 'active' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account is suspended');
  END IF;

  IF v_balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Atomically deduct balance
  UPDATE public.users
  SET wallet_balance = wallet_balance - p_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  -- Create pending withdrawal
  INSERT INTO public.withdrawals (user_id, amount, method, payout_address, status)
  VALUES (p_user_id, p_amount, p_method, p_address, 'pending')
  RETURNING id INTO v_withdrawal_id;

  -- Record audit transaction
  INSERT INTO public.transactions (user_id, amount, type, idempotency_key, description)
  VALUES (p_user_id, -p_amount, 'withdrawal_reserve', 'wd_res_' || v_withdrawal_id, 'Withdrawal request reserved');

  RETURN jsonb_build_object(
    'success', true,
    'withdrawal_id', v_withdrawal_id,
    'remaining_balance', v_balance - p_amount
  );
END;
$$;
```

### 4.2 `admin_reject_withdrawal()`
Safely refunds user balances atomically when a withdrawal is declined:

```sql
CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(
  p_admin_id UUID,
  p_withdrawal_id UUID,
  p_reason VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_amount NUMERIC;
  v_status VARCHAR;
BEGIN
  -- Lock withdrawal record
  SELECT user_id, amount, status INTO v_user_id, v_amount, v_status
  FROM public.withdrawals
  WHERE id = p_withdrawal_id
  FOR UPDATE;

  IF v_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Withdrawal is not pending');
  END IF;

  -- Update status
  UPDATE public.withdrawals
  SET status = 'rejected',
      admin_note = p_reason,
      processed_at = NOW(),
      reviewed_by = p_admin_id
  WHERE id = p_withdrawal_id;

  -- Refund user balance atomically
  UPDATE public.users
  SET wallet_balance = wallet_balance + v_amount,
      updated_at = NOW()
  WHERE id = v_user_id;

  -- Record refund transaction
  INSERT INTO public.transactions (user_id, amount, type, idempotency_key, description)
  VALUES (v_user_id, v_amount, 'withdrawal_refund', 'wd_ref_' || p_withdrawal_id, 'Refund for rejected withdrawal: ' || p_reason);

  RETURN jsonb_build_object('success', true);
END;
$$;
```

### 4.3 `atomic_wallet_credit()`
Guarantees idempotent crediting for tasks, surveys, and referrals:

```sql
CREATE OR REPLACE FUNCTION public.atomic_wallet_credit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type VARCHAR,
  p_idempotency_key VARCHAR,
  p_description VARCHAR
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  -- Prevent duplicate processing via unique idempotency key
  IF EXISTS (SELECT 1 FROM public.transactions WHERE idempotency_key = p_idempotency_key) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Duplicate transaction key', 'code', 'DUPLICATE_KEY');
  END IF;

  -- Lock and update balance
  UPDATE public.users
  SET wallet_balance = wallet_balance + p_amount,
      total_earned = total_earned + GREATEST(p_amount, 0),
      updated_at = NOW()
  WHERE id = p_user_id
  RETURNING wallet_balance INTO v_new_balance;

  -- Record transaction
  INSERT INTO public.transactions (user_id, amount, type, idempotency_key, description)
  VALUES (p_user_id, p_amount, p_type, p_idempotency_key, p_description);

  RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance);
END;
$$;
```
