# PAYVORA — Admin Backend Integration Guide

This guide provides instructions and reference architecture for connecting your **existing separately developed Payvora Admin Frontend** to the shared, hardened **Supabase Backend**.

---

## 1. Architecture & Security Model

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
│   • Enforces permissions (super_admin, finance, etc.) │
│   • Applies distributed rate limiting & audit logs     │
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

## 2. Environment Variables Configuration

In your separate Admin Frontend repository, configure `.env`:

```env
# Supabase Project Base URL
VITE_SUPABASE_URL=https://<YOUR-PROJECT-ID>.supabase.co

# Supabase Public Anonymous Key
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

# Admin API Edge Function Endpoint
VITE_ADMIN_API_URL=https://<YOUR-PROJECT-ID>.supabase.co/functions/v1/admin_api
```

---

## 3. Authentication Requirements & Headers

### Sign-in Flow
Administrators sign in using **Supabase Auth** (`email` and `password`):

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// Sign in with credentials
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'admin@payvora.com',
  password: 'your-secure-password'
});

const token = data.session?.access_token;
```

### Required Request Headers
Every administrative API request to `/admin_api` must include:

| Header Name | Value | Purpose |
| :--- | :--- | :--- |
| `Content-Type` | `application/json` | Body format |
| `Authorization` | `Bearer <SUPABASE_ACCESS_TOKEN>` | Cryptographic proof of administrator identity |
| `apikey` | `<SUPABASE_ANON_KEY>` | Supabase Gateway routing |

---

## 4. Reusable TypeScript Client (`adminApiClient.ts`)

Copy and paste this production-ready API client into your separate Admin Frontend project:

```typescript
// src/services/adminApiClient.ts
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_API_URL = import.meta.env.VITE_ADMIN_API_URL || `${SUPABASE_URL}/functions/v1/admin_api`;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

/**
 * Invokes an action on the secure Payvora Admin API
 */
export async function callAdminApi<T = any>(
  action: string, 
  payload: Record<string, any> = {}
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('Not authenticated. Please log in as an administrator.');
  }

  const response = await fetch(ADMIN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ action, ...payload })
  });

  const resJson: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    error: `Network error (${response.status})`
  }));

  if (!response.ok || !resJson.success) {
    throw new Error(resJson.error || `Admin API Error: ${response.statusText}`);
  }

  return resJson.data as T;
}
```

---

## 5. Available Admin Endpoints & Action Reference

### 5.1 Dashboard Analytics (`get_dashboard_stats`)
- **Required Role**: All administrator roles
- **Request**:
  ```json
  { "action": "get_dashboard_stats" }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "admin": { "email": "admin@payvora.com", "role": "super_admin", "fullName": "Alex Smith" },
      "stats": {
        "totalUsers": 1250,
        "activeTasks": 18,
        "pendingWithdrawals": 4,
        "pendingSubmissions": 12,
        "totalTreasuryBalance": 450.25,
        "totalPlatformEarned": 3450.00,
        "totalPaidOut": 2999.75
      },
      "recentTransactions": [...]
    }
  }
  ```

---

### 5.2 User Management

#### Fetch Users (`get_users`)
- **Required Permission**: `manage_users`
- **Request**:
  ```json
  { "action": "get_users", "page": 1, "limit": 25, "search": "Cabdl" }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "users": [
        {
          "id": "e2a8019b-67d4-4a21-9988-cb9468e8e78a",
          "telegram_id": 8804412131,
          "username": "cabdl",
          "first_name": "Cabdl",
          "wallet_balance": 14.50,
          "status": "active",
          "created_at": "2026-05-01T10:00:00Z"
        }
      ],
      "total": 1,
      "page": 1,
      "limit": 25
    }
  }
  ```

#### Suspend or Activate User (`update_user_status`)
- **Required Permission**: `manage_users`
- **Request**:
  ```json
  {
    "action": "update_user_status",
    "userId": "e2a8019b-67d4-4a21-9988-cb9468e8e78a",
    "status": "suspended",
    "reason": "VPN / proxy abuse detected"
  }
  ```

#### Adjust User Balance (`adjust_user_balance`)
- **Required Permission**: `manage_balances` (super_admin, admin, finance)
- **Request**:
  ```json
  {
    "action": "adjust_user_balance",
    "userId": "e2a8019b-67d4-4a21-9988-cb9468e8e78a",
    "amount": 5.00,
    "type": "credit",
    "reason": "Contest bonus payout"
  }
  ```

---

### 5.3 Withdrawal Processing

#### Fetch Withdrawals (`get_withdrawals`)
- **Required Permission**: `manage_withdrawals`
- **Request**:
  ```json
  { "action": "get_withdrawals", "status": "pending", "page": 1, "limit": 25 }
  ```

#### Approve Withdrawal (`approve_withdrawal`)
- **Required Permission**: `manage_withdrawals`
- **Request**:
  ```json
  {
    "action": "approve_withdrawal",
    "withdrawalId": "1b8973a0-47b2-4cd8-89f4-cf36f7db1951",
    "txHash": "0x38b29d91f80164c81a...",
    "note": "Paid via TronLink hot wallet"
  }
  ```

#### Reject Withdrawal (`reject_withdrawal`)
*(Automatically restores the reserved amount to the user's wallet atomically).*
- **Required Permission**: `manage_withdrawals`
- **Request**:
  ```json
  {
    "action": "reject_withdrawal",
    "withdrawalId": "1b8973a0-47b2-4cd8-89f4-cf36f7db1951",
    "reason": "Invalid TRC20 recipient wallet address"
  }
  ```

---

### 5.4 Task Proof Reviews

#### Review Submission (`review_submission`)
- **Required Permission**: `review_submissions`
- **Request**:
  ```json
  {
    "action": "review_submission",
    "submissionId": "481a5f6e-9311-4700-9ef2-5b967dc253b2",
    "decision": "approved",
    "comment": "Channel subscription verified"
  }
  ```
*(When approved, `atomic_wallet_credit` is called server-side to credit the user reward atomically).*

---

### 5.5 Audit Logs & Settings

#### View Audit Trail (`get_audit_logs`)
- **Required Permission**: `view_audit_logs`
- **Request**:
  ```json
  { "action": "get_audit_logs", "page": 1, "limit": 50 }
  ```

#### Update System Setting (`update_setting`)
- **Required Permission**: `manage_settings`
- **Request**:
  ```json
  {
    "action": "update_setting",
    "key": "payout_config",
    "value": { "min_withdrawal": 1.00, "withdrawals_enabled": true, "supported_methods": ["usdt", "trx", "payeer"] }
  }
  ```

---

## 6. Role-Based Access Control (RBAC) Matrix

| Permission | `super_admin` | `admin` | `finance_admin` / `finance` | `moderator` | `support` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `view_dashboard` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `manage_users` | ✅ | ✅ | ❌ | ✅ | ✅ |
| `manage_balances` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `manage_tasks` | ✅ | ✅ | ❌ | ✅ | ✅ |
| `review_submissions` | ✅ | ✅ | ❌ | ✅ | ✅ |
| `manage_withdrawals` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `view_transactions` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `manage_settings` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `view_audit_logs` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `manage_admins` | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 7. Provisioning New Administrators

Run this query in Supabase Dashboard SQL Editor to assign roles:

```sql
-- Link user from auth.users to admin_users table
INSERT INTO public.admin_users (auth_user_id, email, full_name, role, status)
VALUES (
  'PASTE_AUTH_USER_UUID_HERE',
  'finance@payvora.com',
  'Finance Manager',
  'finance',
  'active'
)
ON CONFLICT (email) DO UPDATE SET
  role = EXCLUDED.role,
  status = 'active';
```
