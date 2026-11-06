# PAYVORA — Backend Architecture & System Design

This document details the architectural blueprint of the Payvora platform, illustrating the dual-frontend topology, trust boundaries, Edge Function routing, and transaction lifecycles.

---

## 1. System Topology Overview

Payvora operates on a **dual-frontend, single-backend** architecture:

```
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│     PAYVORA USER FRONTEND       │       │    PAYVORA ADMIN FRONTEND       │
│      (Telegram Mini App)        │       │  (Separate Dedicated Dashboard) │
│  • React 18 / Tailwind / Vite   │       │  • React Admin Dashboard        │
│  • Runs inside Telegram WebApp  │       │  • Runs on admin.payvora.com    │
│  • Zero administrative code     │       │  • Pure administrator interface │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
        Telegram initData                         Supabase Auth JWT
         (HMAC-SHA256)                            (Role-Gated RBAC)
                 │                                         │
                 ▼                                         ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                       SUPABASE EDGE FUNCTIONS LAYER                       │
│                                                                           │
│   User & Webhook Functions:              Admin Functions:                 │
│   • /auth (InitData HMAC verify)         • /admin_api (RBAC & actions)    │
│   • /withdraw (Atomic withdrawal)        • /admin_action (Forwarder)      │
│   • /submit_task (Task proof)                                             │
│   • /get_cpx_url (Survey URL sign)                                        │
│   • /cpx_postback (CPX Webhook)                                           │
│   • /postback (Partner Webhooks)                                          │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
                   PostgreSQL Connection / Service Role
                                      │
                                      ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                   SUPABASE POSTGRESQL DATABASE & RLS                      │
│                                                                           │
│   • public.users                       • public.tasks                     │
│   • public.withdrawals                 • public.submissions               │
│   • public.transactions                • public.offerwall_logs            │
│   • public.admin_users                 • public.audit_logs                │
│   • public.app_settings                • public.referrals                 │
│                                                                           │
│   Atomic Procedures (Row Locking):                                        │
│   • request_withdrawal()               • admin_approve_withdrawal()        │
│   • atomic_wallet_credit()             • admin_reject_withdrawal()         │
│   • admin_review_submission()          • reward_user()                    │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Trust Boundaries & Security Enclaves

1. **User Client Boundary (Untrusted)**:
   - The user browser / Telegram WebView environment is inherently untrusted.
   - Client-side balances, IDs, and parameters are never accepted without cryptographic validation.
   - User identity is strictly established via Telegram's server-signed `initData`.

2. **Admin Client Boundary (Semi-Trusted)**:
   - The administrator client must present a valid Supabase Auth JWT.
   - The JWT is re-verified against `public.admin_users` on **every single request** to ensure the administrator is active and holds the necessary permission scope.

3. **Backend Service Boundary (Trusted)**:
   - Supabase Edge Functions execute in isolated Deno V8 isolates.
   - Service role keys are kept strictly within server-side environment variables (`SUPABASE_SERVICE_ROLE_KEY`).
   - Direct database access utilizes row-level locking to guarantee serializability.

---

## 3. Authentication & Verification Lifecycles

### 3.1 Telegram User Authentication Flow

```
User App (Telegram Mini App)            Edge Function (/auth)              PostgreSQL
    │                                          │                                │
    ├───────── 1. Send window.Telegram ───────>│                                │
    │          .WebApp.initData                │                                │
    │                                          ├─ 2. Calculate HMAC-SHA256      │
    │                                          │     using BOT_TOKEN secret     │
    │                                          ├─ 3. Check auth_date < 24h      │
    │                                          │                                │
    │                                          ├───────── 4. Upsert User ──────>│
    │                                          │          by telegram_id        │
    │                                          │<──────── User Profile ─────────┤
    │                                          │                                │
    │<──────── 5. Return User Session ─────────┤                                │
```

### 3.2 Admin Authentication & RBAC Flow

```
Admin Frontend (admin.payvora.com)       Edge Function (/admin_api)        PostgreSQL
    │                                          │                                │
    ├───────── 1. Login with Email/Pass ──────>│ (Supabase Auth)                │
    │<──────── 2. Receives Supabase JWT ───────┤                                │
    │                                          │                                │
    ├───────── 3. Action Request ─────────────>│                                │
    │          Headers: Bearer <JWT>           ├─ 4. Verify JWT Signature       │
    │          Body: { action: "approve_wd" }  │                                │
    │                                          ├───────── 5. Lookup Admin ─────>│
    │                                          │          in admin_users        │
    │                                          │<──────── Role & Active ────────┤
    │                                          │                                │
    │                                          ├─ 6. Check Role Permissions     │
    │                                          │     (e.g., manage_withdrawals) │
    │                                          │                                │
    │                                          ├───────── 7. Execute RPC ──────>│
    │                                          │<──────── Result ───────────────┤
    │                                          │                                │
    │                                          ├───────── 8. Write Audit Log ──>│
    │<──────── 9. Return Action Result ────────┤                                │
```

---

## 4. Financial Transaction Lifecycles

### 4.1 User Withdrawal Lifecycle
1. **User Request**: User submits withdrawal request specifying amount ($ \ge \$1.00 $) and method (`usdt_trc20`, `trx`, or `payeer`).
2. **Server Validation**: `/withdraw` checks user auth token, rate limits, and address formatting.
3. **Pessimistic Lock**: Database procedure `request_withdrawal()` executes `SELECT ... FOR UPDATE` on the user row.
4. **Fund Reservation**: If balance $\ge$ amount, the requested amount is deducted immediately from `wallet_balance` and status set to `pending`.
5. **Admin Review**: Admin reviews pending withdrawals via the Admin Frontend.
6. **Resolution**:
   - **Approval**: Admin records transaction hash (`tx_hash`). Status moves to `completed`.
   - **Rejection**: Admin submits reason. Status moves to `rejected`, and the system automatically restores the deducted funds to `wallet_balance` atomically.

### 4.2 Offerwall Postback Lifecycle
1. **Webhook Reception**: Survey provider (e.g., CPX Research) sends GET/POST webhook.
2. **Signature Verification**: Edge function checks MD5 / SHA-256 signature against secret salt.
3. **Idempotency Gate**: Edge function checks if `(network, transaction_id)` already exists in `offerwall_logs`. If found, immediately returns HTTP 200 without double-crediting.
4. **Atomic Credit**: Invokes `atomic_wallet_credit()`, updating user balance and registering the unique transaction.
5. **Referral Commission**: If user was invited by a referrer, calculates 10% referral commission and credits the referrer's wallet.
