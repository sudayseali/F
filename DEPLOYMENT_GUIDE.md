# PAYVORA — Complete Deployment & Operations Guide

This guide details the end-to-end deployment procedure for the Payvora platform, covering the shared Supabase backend, database migrations, Edge Function secrets, and dual frontend configurations.

---

## 1. Prerequisites

Before beginning deployment, ensure you have:
1. A **Supabase Project** (cloud or self-hosted).
2. **Supabase CLI** installed locally:
   ```bash
   npm install -g supabase
   ```
3. A **Telegram Bot** created via [@BotFather](https://t.me/BotFather) with your `BOT_TOKEN`.
4. Offerwall partner credentials (e.g., CPX Research App ID & Secure Hash).

---

## 2. Step 1: Database Schema & Migration Deployment

Apply the security reconstruction migration to your Supabase project.

### Option A: Via Supabase CLI (Recommended)
```bash
# Link to your Supabase project
supabase link --project-ref your-project-id

# Push all migrations
supabase db push
```

### Option B: Via Supabase Dashboard SQL Editor
1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor**.
3. Open and execute the contents of:
   `supabase/migrations/20260506000000_security_reconstruction.sql`
4. Confirm successful execution. Verify the creation of `admin_users`, `audit_logs`, and atomic stored procedures.

---

## 3. Step 2: Configure Environment Secrets

Supabase Edge Functions require specific environment secrets to perform cryptographic verifications.

Run the following command in your terminal:

```bash
supabase secrets set \
  TELEGRAM_BOT_TOKEN="123456789:ABCdefGHIjklMNOpqrsTUVwxyz" \
  CPX_SECURE_HASH="your_cpx_secure_hash_here" \
  CPX_APP_ID="12345" \
  SUPABASE_JWT_SECRET="your_supabase_jwt_secret" \
  APP_ENV="production"
```

*Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the Supabase runtime.*

---

## 4. Step 3: Deploy Edge Functions

Deploy the full suite of edge functions to your Supabase project:

```bash
# Shared functions
supabase functions deploy auth --no-verify-jwt
supabase functions deploy withdraw --no-verify-jwt
supabase functions deploy submit_task --no-verify-jwt
supabase functions deploy get_cpx_url --no-verify-jwt

# Webhooks & Postbacks
supabase functions deploy cpx_postback --no-verify-jwt
supabase functions deploy cpa_postback --no-verify-jwt
supabase functions deploy postback --no-verify-jwt
supabase functions deploy tapjoy_webhook --no-verify-jwt

# Administrator API (Edge Function verifies JWT internally with RBAC)
supabase functions deploy admin_api --no-verify-jwt
supabase functions deploy admin_action --no-verify-jwt
```

---

## 5. Step 4: Provision the Initial Super Admin

To access your separate Admin Frontend, create an administrator record:

1. In Supabase Dashboard, go to **Authentication -> Users** and click **Invite User** or **Add User** (e.g., `admin@payvora.com` with a strong password).
2. Copy the resulting `User UID`.
3. In SQL Editor, run:
   ```sql
   INSERT INTO public.admin_users (id, email, role, is_active)
   VALUES (
     'PASTE_USER_UID_HERE',
     'admin@payvora.com',
     'super_admin',
     true
   );
   ```

---

## 6. Step 5: Frontend Deployments

### 6.1 Payvora User Frontend (Telegram Mini App)
- **Framework**: React 18 / Vite / Tailwind
- **Hosting**: Vercel / Cloudflare Pages / Netlify
- **Environment Variables**:
  ```env
  VITE_SUPABASE_URL=https://your-project-id.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
  VITE_CPX_APP_ID=12345
  ```
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Telegram Bot Configuration**:
  In `@BotFather`, set the Mini App URL to your deployed user domain (e.g., `https://app.payvora.com`).

### 6.2 Payvora Admin Frontend (Separate Dashboard)
- **Framework**: Your existing separate React Admin repository
- **Hosting**: Separate production domain (e.g., `https://admin.payvora.com`)
- **Environment Variables**:
  ```env
  VITE_SUPABASE_URL=https://your-project-id.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
  VITE_ADMIN_API_URL=https://your-project-id.supabase.co/functions/v1/admin_api
  ```
- Connects using the integration guide provided in `ADMIN_BACKEND_INTEGRATION_GUIDE.md`.

---

## 7. Step 6: Post-Deployment Verification Checklist

- [ ] Telegram user authenticates cleanly inside Telegram Mini App.
- [ ] User wallet balance reflects correct amount.
- [ ] Withdrawal request with valid TRON/USDT address creates a pending record.
- [ ] Concurrent withdrawal attempts correctly fail if balance is insufficient.
- [ ] Admin logs into separate Admin Frontend via Supabase Auth.
- [ ] Admin can view pending withdrawals and approve or reject with automatic refund.
- [ ] Offerwall test postback successfully credits user wallet idempotently.
- [ ] Non-admin user tokens are rejected with HTTP 403 when calling `/admin_api`.
