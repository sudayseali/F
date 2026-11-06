# PAYVORA — Comprehensive Security Audit Report

**Date**: May 6, 2026  
**Assessment Type**: Full-Stack Architecture Security Audit & Vulnerability Assessment  
**Auditor**: Senior Software Engineer & Application Security Architect  
**Classification**: Highly Confidential  

---

## 1. Executive Summary

This security audit was conducted on the PAYVORA application stack, consisting of a React-based Telegram Mini App (User Frontend) and a Supabase backend (PostgreSQL 15+, Edge Functions, RLS, and Auth) that interfaces with an independently developed separate Admin Frontend.

The audit identified critical vulnerabilities in the legacy implementation spanning **identity spoofing**, **concurrency race conditions (double-spending)**, **client-side database upsert operations**, **unrestricted CORS origins**, and **insufficient role enforcement**. All vulnerabilities have been mapped, analyzed, and remediated in the codebase.

---

## 2. Vulnerability Severity Matrix

| Vulnerability ID | Title | CVSS v3.1 | Initial Severity | Remediated Status |
| :--- | :--- | :---: | :---: | :---: |
| **SEC-01** | Withdrawal Identity Spoofing via `body.user_uuid` Fallback | 9.8 | **CRITICAL** | **FIXED** |
| **SEC-02** | Insecure Client-Side User Creation via Direct Database Upsert | 9.1 | **CRITICAL** | **FIXED** |
| **SEC-03** | Lack of Clock-Tolerance and Constant-Time Telegram HMAC Verification | 8.8 | **HIGH** | **FIXED** |
| **SEC-04** | Admin Identity Email Fallback & Missing Role Separation | 8.5 | **HIGH** | **FIXED** |
| **SEC-05** | Unrestricted Production CORS Wildcard (`*`) | 7.5 | **HIGH** | **FIXED** |
| **SEC-06** | Task Proof Submission Identity Spoofing | 7.4 | **HIGH** | **FIXED** |
| **SEC-07** | Non-Idempotent Offerwall Callback Processing | 7.1 | **HIGH** | **FIXED** |
| **SEC-08** | In-Memory-Only Rate Limiting in Serverless Architecture | 6.5 | **MEDIUM** | **FIXED** |
| **SEC-09** | Unrestricted `search_path` in `SECURITY DEFINER` Database Functions | 6.2 | **MEDIUM** | **FIXED** |

---

## 3. Detailed Vulnerability Analyses

### SEC-01: Withdrawal Identity Spoofing (`withdraw/index.ts`)
- **Location**: `supabase/functions/withdraw/index.ts`
- **Root Cause**: The withdrawal handler included an insecure fallback block:
  ```typescript
  // INSECURE LEGACY CODE:
  try {
    const verifiedUser = await verifyUserRequest(req);
    authenticatedUserId = verifiedUser.id;
  } catch {
    if (!body.user_uuid) throw new AppError("Authentication required.", 401);
    authenticatedUserId = body.user_uuid; // CRITICAL: Trusted client body!
  }
  ```
- **Exploit Scenario**: An unauthenticated attacker sending an HTTP POST with `{ "user_uuid": "victim_uuid", "amount": 10.0, "wallet_address": "attacker_address", "method": "usdt" }` could drain victim funds without possessing their credentials.
- **Remediation**:
  1. Completely eradicated the `body.user_uuid` fallback.
  2. The authenticated user ID is derived strictly and exclusively from `verifyUserRequest(req)`.
  3. Added explicit rejection (`403 IDENTITY_MISMATCH`) if the request body attempts to specify any other user ID.
  4. Added duplicate pending withdrawal detection and atomic `request_withdrawal()` RPC locking.

---

### SEC-02: Client-Side Database User Creation (`TelegramContext.tsx`)
- **Location**: `src/contexts/TelegramContext.tsx`
- **Root Cause**: The frontend component executed direct database queries:
  ```typescript
  // INSECURE LEGACY CODE:
  const { data: newData, error: upsertError } = await supabase.from('users').upsert({
    telegram_id: telegramId,
    username: 'user_' + telegramId,
    first_name: 'User',
    wallet_balance: 0
  }, { onConflict: 'telegram_id' });
  ```
- **Exploit Scenario**: If RLS was permissive, any user could modify user balances or inject spoofed Telegram accounts directly from browser consoles.
- **Remediation**:
  1. Eradicated all direct `supabase.from('users').upsert` calls from the React codebase.
  2. All Telegram authentication routes through the server-side Edge Function (`/auth`).
  3. The server validates Telegram WebApp `initData` cryptographically before returning the authenticated user profile and JWT.
  4. Client only reads own profile via authenticated session (`supabase.from('users').select('*').eq('id', user.uuid)`).

---

### SEC-03: Telegram HMAC Verification Deficiencies (`telegram-verification.ts`)
- **Location**: `supabase/functions/_shared/telegram-verification.ts`
- **Root Cause**:
  1. Future timestamps were not checked against clock drift (`auth_date > now + tolerance`).
  2. Hex comparison used JavaScript `!==`, which is vulnerable to side-channel timing attacks.
  3. Missing validation of hex format and Telegram user payload structure.
- **Remediation**:
  1. Implemented `constantTimeCompare()` preventing byte-by-byte timing leakages.
  2. Implemented strict rejection of timestamps outside clock tolerance (`auth_date > now + 60s`).
  3. Enforced 24-hour expiration (`auth_date < now - 86400s`).
  4. Validated 64-character hexadecimal regex format.

---

### SEC-04: Insecure Admin Authentication Fallback (`admin-auth.ts`)
- **Location**: `supabase/functions/_shared/admin-auth.ts`
- **Root Cause**:
  ```typescript
  // INSECURE LEGACY CODE:
  if (!admin && payload.email) {
    const { data: byEmail } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('email', payload.email)
      .maybeSingle();
    admin = byEmail;
  }
  ```
- **Exploit Scenario**: An attacker registering a regular Supabase account or Telegram account with an email matching an admin account could gain administrative access if UUID matching failed.
- **Remediation**:
  1. Removed all email-based lookups.
  2. Admin identity is verified strictly against `auth_user_id = payload.sub` in `public.admin_users`.
  3. Added explicit rejection of Telegram user tokens (`@telegram.local`).
  4. Expanded and enforced RBAC roles: `super_admin`, `admin`, `finance_admin`, `finance`, `moderator`, `support`.
  5. Rejected suspended or revoked administrator accounts (`status !== 'active'`).

---

### SEC-05: Wildcard Production CORS (`cors.ts`)
- **Location**: `supabase/functions/_shared/cors.ts`
- **Root Cause**: `Access-Control-Allow-Origin: *` was returned on all requests, permitting cross-origin malicious scripts on other sites to interact with API endpoints.
- **Remediation**:
  1. Replaced wildcard with strict origin allowlist (`https://web.telegram.org`, `localhost`, `payvora-tan.vercel.app`, and `ALLOWED_ORIGINS` env var).
  2. Preflight `OPTIONS` requests from unauthorized origins receive HTTP 403.
  3. Set `Access-Control-Allow-Credentials: true` and `Vary: Origin` only for verified origins.

---

### SEC-06 & SEC-07: Task Proof & Offerwall Postback Integrity
- **Locations**: `submit_task/index.ts`, `postback/index.ts`, `cpa_postback/index.ts`
- **Root Causes**:
  - `submit_task` trusted `user_uuid` from body without checking JWT.
  - `postback` queried `users.balance` (schema column is `wallet_balance`) and lacked atomic crediting.
  - `cpa_postback` lacked transaction deduplication.
- **Remediation**:
  1. Bound `submit_task` to `verifyUserRequest(req)` to derive caller identity from JWT.
  2. Routed all postbacks through `atomic_wallet_credit()` with unique `idempotency_key`.
  3. Checked `offerwall_logs` for `(provider, external_transaction_id)` to ensure replay immunity.

---

### SEC-08 & SEC-09: Database Function & Architecture Hardening
- **Locations**: PostgreSQL stored procedures and migrations
- **Root Causes**:
  - `SET search_path = public` lacked `pg_temp` protection against search_path hijacking.
  - In-memory rate limiting could not coordinate across multiple edge serverless instances.
- **Remediation**:
  1. Added `public.rate_limits` table and atomic `check_distributed_rate_limit()` RPC.
  2. Set `SET search_path = public, pg_temp` on all `SECURITY DEFINER` functions.
  3. Revoked direct `EXECUTE` on financial and administrative procedures from `PUBLIC` and `anon`.
