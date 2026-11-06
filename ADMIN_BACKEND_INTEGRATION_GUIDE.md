# PAYVORA — Admin Backend Integration Guide

This guide provides instructions and reference code for connecting your **existing separately developed Payvora Admin Frontend** to the newly hardened, shared **Supabase Backend**.

---

## 1. Architectural Overview

```
┌────────────────────────────────────────────────────────┐
│             PAYVORA EXISTING ADMIN FRONTEND            │
│  (React / Vite Dashboard running on dedicated domain)  │
└───────────────────────────┬────────────────────────────┘
                            │
               HTTPS (Bearer Supabase JWT)
                            ▼
┌────────────────────────────────────────────────────────┐
│             SUPABASE EDGE FUNCTION: admin_api          │
│   • Validates Supabase Auth JWT                       │
│   • Queries public.admin_users for active role & RBAC  │
│   • Enforces permissions (super_admin, finance_admin)  │
│   • Applies rate limiting & writes audit logs          │
└───────────────────────────┬────────────────────────────┘
                            │
                 Service Role / Atomic RPC
                            ▼
┌────────────────────────────────────────────────────────┐
│             POSTGRESQL DATABASE & RPCs                 │
│   • atomic_wallet_credit                               │
│   • admin_approve_withdrawal                           │
│   • admin_reject_withdrawal (with auto-refund)         │
│   • admin_review_submission                            │
│   • public.audit_logs                                  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Environment Configuration

In your existing Admin Frontend `.env` file, specify:

```env
# Supabase Project URL & Anon Key (Client safe)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# Admin API Edge Function Endpoint
VITE_ADMIN_API_URL=https://your-project-id.supabase.co/functions/v1/admin_api
```

---

## 3. Administrator Authentication Flow

The Admin Frontend authenticates administrators via standard **Supabase Auth** (`email` and `password`).

1. The administrator signs in using `supabase.auth.signInWithPassword({ email, password })`.
2. Supabase Auth returns a cryptographic session containing an `access_token` (JWT).
3. Every privileged call to `admin_api` transmits this JWT in the `Authorization: Bearer <access_token>` header.
4. The backend verifies that the user ID corresponds to an active administrator in `public.admin_users`.

### Creating an Administrator Account

Run this in your Supabase SQL Editor to provision an initial administrator:

```sql
-- 1. Create the user in auth.users via Supabase Dashboard -> Authentication -> Users
-- 2. Link the user to the admin_users table with an appropriate role:
INSERT INTO public.admin_users (id, email, role, is_active)
VALUES (
  'PASTE_AUTH_USER_UUID_HERE',
  'admin@payvora.com',
  'super_admin',
  true
)
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  is_active = true;
```

---

## 4. Reusable TypeScript Client (`apiClient.ts`)

Drop this helper into your existing Admin Frontend repository to handle all API communications:

```typescript
// src/services/adminApiClient.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL || `${SUPABASE_URL}/functions/v1/admin_api`;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export async function callAdminApi<T = any>(action: string, payload: Record<string, any> = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Not authenticated. Please log in as an administrator.');
  }

  const response = await fetch(ADMIN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    },
    body: JSON.stringify({ action, ...payload })
  });

  const resJson: ApiResponse<T> = await response.json();

  if (!response.ok || !resJson.success) {
    throw new Error(resJson.error || `Admin API Error: ${response.statusText}`);
  }

  return resJson.data as T;
}
```

---

## 5. Endpoints & Operations Reference

### 5.1 Dashboard Analytics
- **Action**: `get_dashboard_stats`
- **Required Permission**: `view_dashboard` (all admin roles)
- **Code Example**:
```typescript
const stats = await callAdminApi('get_dashboard_stats');
console.log(stats.stats.totalUsers);
console.log(stats.stats.pendingWithdrawals);
console.log(stats.recentTransactions);
```

### 5.2 User Management
- **Action**: `get_users`
- **Payload**: `{ page: 1, limit: 25, search?: string }`
```typescript
const usersData = await callAdminApi('get_users', { page: 1, limit: 25, search: 'Cabdl' });
```

- **Action**: `update_user_status`
- **Payload**: `{ userId: string, status: 'active' | 'suspended', reason?: string }`
```typescript
await callAdminApi('update_user_status', { 
  userId: '6b568322-...', 
  status: 'suspended', 
  reason: 'Suspicious proxy activity' 
});
```

- **Action**: `adjust_user_balance`
- **Payload**: `{ userId: string, amount: number, type: 'credit' | 'deduct', reason: string }`
```typescript
await callAdminApi('adjust_user_balance', {
  userId: '6b568322-...',
  amount: 5.00,
  type: 'credit',
  reason: 'Contest winner prize'
});
```

### 5.3 Withdrawal Processing
- **Action**: `get_withdrawals`
- **Payload**: `{ status: 'pending' | 'completed' | 'rejected' | 'all', page: 1, limit: 25 }`
```typescript
const withdrawals = await callAdminApi('get_withdrawals', { status: 'pending' });
```

- **Action**: `approve_withdrawal`
- **Payload**: `{ withdrawalId: string, txHash?: string, note?: string }`
```typescript
await callAdminApi('approve_withdrawal', {
  withdrawalId: '1b8973a0-...',
  txHash: '0x38b29d...trc20',
  note: 'Processed via Binance hot wallet'
});
```

- **Action**: `reject_withdrawal`
- **Payload**: `{ withdrawalId: string, reason: string }`
*(Automatically refunds the reserved amount back to the user's wallet atomically).*
```typescript
await callAdminApi('reject_withdrawal', {
  withdrawalId: '1b8973a0-...',
  reason: 'Invalid USDT TRC20 address provided'
});
```

### 5.4 Task & Submission Verification
- **Action**: `get_submissions`
- **Payload**: `{ status: 'pending' | 'approved' | 'rejected' | 'all', page: 1, limit: 25 }`
```typescript
const pendingReviews = await callAdminApi('get_submissions', { status: 'pending' });
```

- **Action**: `review_submission`
- **Payload**: `{ submissionId: string, decision: 'approved' | 'rejected', comment?: string }`
*(When approved, automatically calls `atomic_wallet_credit` to reward the user and increments task completion counts).*
```typescript
await callAdminApi('review_submission', {
  submissionId: 'e2a8019b-...',
  decision: 'approved',
  comment: 'Screenshot confirmed'
});
```

### 5.5 App Settings & Audit Logs
- **Action**: `get_settings`
```typescript
const { settings } = await callAdminApi('get_settings');
```

- **Action**: `update_setting`
- **Payload**: `{ key: string, value: Record<string, any> }`
```typescript
await callAdminApi('update_setting', {
  key: 'withdrawal_limits',
  value: { min_usdt: 2.00, max_usdt: 500.00, enabled_methods: ['usdt_trc20', 'payeer', 'trx'] }
});
```

- **Action**: `get_audit_logs`
- **Payload**: `{ page: 1, limit: 50 }`
```typescript
const { logs } = await callAdminApi('get_audit_logs', { page: 1, limit: 50 });
```

---

## 6. Role-Based Access Control (RBAC) Reference

| Role | Dashboard | View Users | Suspend Users | Adjust Balances | Approve Withdrawals | Tasks/Reviews | App Settings | Audit Logs |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`super_admin`** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **`finance_admin`** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **`moderator`** | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
