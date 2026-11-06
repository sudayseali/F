# PAYVORA — Comprehensive API Documentation

This document describes all API endpoints exposed by the Payvora Supabase Edge Functions suite, including User Endpoints, Offerwall Postback Webhooks, and Administrator Endpoints.

---

## 1. Base URL & Common Conventions

- **Base URL**: `https://<YOUR-PROJECT-REF>.supabase.co/functions/v1/`
- **Response Format**: `application/json`
- **Standard Success Response**:
  ```json
  {
    "success": true,
    "data": { ... }
  }
  ```
- **Standard Error Response**:
  ```json
  {
    "success": false,
    "error": "Human-readable error explanation",
    "code": "SPECIFIC_ERROR_CODE"
  }
  ```

---

## 2. User Endpoints

### 2.1 User Authentication (`/auth`)

Verifies official Telegram WebApp `initData` using the cryptographic HMAC-SHA256 algorithm and syncs the user profile in the database.

- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "initData": "query_id=AAHd...&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22John%22%7D&auth_date=1715000000&hash=d8a..."
  }
  ```
- **Validation Rules**:
  - Validates `hash` parameter against `HMAC_SHA256(secret_key, data_check_string)`.
  - Verifies `auth_date` is not older than 86,400 seconds (24 hours) to prevent replay attacks.
  - Extracts and trusts only the validated Telegram user ID.
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "76d8b981-d419-4876-b52b-7c70281b37fa",
        "telegram_id": 123456789,
        "first_name": "John",
        "username": "johndoe",
        "wallet_balance": 12.50,
        "total_earned": 25.00,
        "total_withdrawn": 12.50,
        "referral_code": "REF_123456789",
        "status": "active"
      },
      "token": "eyJhbGciOi..."
    }
  }
  ```

---

### 2.2 Generate Signed CPX Research URL (`/get_cpx_url`)

Generates a secure, authenticated survey URL for the calling user.

- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <USER_JWT>`
- **Request Body**:
  ```json
  {
    "userId": "123456789",
    "subId": "optional_sub_tracking_id"
  }
  ```
- **Validation Rules**:
  - Validates caller identity via Bearer JWT or verified session.
  - Appends secure hash query parameter: `md5(user_id + '-' + CPX_SECURE_HASH)`.
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "url": "https://offers.cpx-research.com/index.php?app_id=12345&ext_user_id=123456789&secure_hash=8a9b7c..."
  }
  ```

---

### 2.3 Submit Micro-Task Proof (`/submit_task`)

Submits user proof (screenshot URL or text answer) for an active community or partner task.

- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <USER_JWT>`
- **Request Body**:
  ```json
  {
    "taskId": "c1f76d90-67a1-4322-a72d-8e811f016f40",
    "proofData": "https://storage.payvora.com/proofs/scr_1234.png",
    "proofText": "Subscribed to channel with handle @johnny"
  }
  ```
- **Validation Rules**:
  - Verifies task exists and is currently `active`.
  - Checks if user has already submitted this task (prevents duplicate submissions).
  - Rate limited to 10 submissions per 5 minutes per user.
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "submissionId": "481a5f6e-9311-4700-9ef2-5b967dc253b2",
      "status": "pending",
      "message": "Submission received and queued for admin review."
    }
  }
  ```

---

### 2.4 Request Wallet Withdrawal (`/withdraw`)

Initiates an atomic withdrawal request, validating limits and reserving user funds immediately.

- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <USER_JWT>`
- **Request Body**:
  ```json
  {
    "amount": 5.00,
    "method": "usdt_trc20",
    "payoutAddress": "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"
  }
  ```
- **Supported Methods**:
  - `usdt_trc20`: USDT on Tron Network (Minimum $1.00)
  - `trx`: Tron Native Coin (Minimum $1.00)
  - `payeer`: Payeer Account Number (Minimum $1.00)
- **Validation Rules**:
  - Amount must be $\ge 1.00$ and strictly positive.
  - Payout address format is validated using regex (e.g., TRON addresses start with `T` and are 34 characters).
  - Calls `request_withdrawal()` PostgreSQL RPC with `SELECT ... FOR UPDATE` row-level lock.
  - If user balance < requested amount, returns `INSUFFICIENT_FUNDS` without debiting.
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "withdrawalId": "1b8973a0-47b2-4cd8-89f4-cf36f7db1951",
      "amount": 5.00,
      "remainingBalance": 7.50,
      "status": "pending",
      "requestedAt": "2026-05-06T12:00:00Z"
    }
  }
  ```

---

## 3. Offerwall & Partner Postback Webhooks

### 3.1 CPX Research Webhook (`/cpx_postback`)

Processes completed survey postbacks from CPX Research.

- **Method**: `GET`
- **Query Parameters**:
  - `status`: `1` (awarded) or `2` (chargeback)
  - `trans_id`: Unique CPX transaction ID
  - `user_id`: Payvora user ID or Telegram ID
  - `amount_local`: Local currency reward credited to user
  - `secure_hash`: MD5 signature of `trans_id + '-' + CPX_HASH`
- **Security Protections**:
  - Verifies MD5 signature against environment secret `CPX_SECURE_HASH`.
  - Checks `offerwall_logs` table for `trans_id` to prevent duplicate crediting.
  - Executes credit via `atomic_wallet_credit` with `idempotency_key = 'cpx_' || trans_id`.
- **Response**: `OK` (CPX required format)

---

### 3.2 Generic Offerwall Postback (`/postback`)

Supports postbacks from Lootably, Torox, and AdGate Media.

- **Method**: `GET` or `POST`
- **Payload/Query**:
  - `network`: `lootably` | `torox` | `adgate`
  - `tx_id`: Partner transaction ID
  - `user_id`: Payvora user identifier
  - `reward`: Payout amount
  - `signature`: Secret hash signature
- **Response**:
  ```json
  { "success": true, "credited": 1.25 }
  ```

---

## 4. Administrator Endpoints (`/admin_api`)

Requires administrator authentication via Supabase Auth JWT and verified role in `public.admin_users`.

- **Base Endpoint**: `https://<PROJECT-REF>.supabase.co/functions/v1/admin_api`
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <ADMIN_SUPABASE_JWT>`

### 4.1 Actions Summary Table

| Action Name | Description | Required Role | Payload Key Params |
| :--- | :--- | :--- | :--- |
| `get_dashboard_stats` | Platform metrics, treasury, pending counts | Any admin | None |
| `get_users` | Paginated user search & balance review | `manage_users` | `{ page, limit, search }` |
| `update_user_status` | Suspend or activate a user | `manage_users` | `{ userId, status, reason }` |
| `adjust_user_balance` | Atomically adjust user wallet balance | `manage_balances` | `{ userId, amount, type, reason }` |
| `get_withdrawals` | Query pending or historical withdrawals | `manage_withdrawals` | `{ status, page, limit }` |
| `approve_withdrawal` | Mark withdrawal completed with tx hash | `manage_withdrawals` | `{ withdrawalId, txHash, note }` |
| `reject_withdrawal` | Reject request & auto-refund user balance | `manage_withdrawals` | `{ withdrawalId, reason }` |
| `get_tasks` | List all tasks | `manage_tasks` | None |
| `create_task` | Create a new task with reward & limits | `manage_tasks` | `{ title, description, reward, ... }` |
| `update_task_status` | Change task status (active/paused/archived)| `manage_tasks` | `{ taskId, status }` |
| `get_submissions` | Review task proof submissions | `review_submissions` | `{ status, page, limit }` |
| `review_submission` | Approve/reject submission & reward user | `review_submissions` | `{ submissionId, decision, comment }` |
| `get_settings` | Retrieve system settings & limits | `manage_settings` | None |
| `update_setting` | Upsert system setting JSON object | `manage_settings` | `{ key, value }` |
| `get_audit_logs` | View immutable administrative audit trail | `view_audit_logs` | `{ page, limit }` |
