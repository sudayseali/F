# Micro Task Platform

A complete micro-task platform specifically designed for Telegram Mini Apps and Web Dashboard.

## Architecture

*   **Frontend:** ReactJS with Tailwind CSS, utilizing React Router for navigation.
*   **Backend:** Designed for Supabase (PostgreSQL + Edge Functions).

## Setup & Deployment

### 1. Database Setup (Supabase)
1. Create a new Supabase project.
2. Go to the SQL Editor and run the SQL script found in `supabase/schema.sql`.
3. This creates all necessary tables (`users`, `tasks`, `submissions`, `transactions`, `withdrawals`, `referrals`) and sets up basic Row Level Security (RLS).

### 2. Edge Functions
We have created placeholders for the requested Edge Functions.
To deploy them to Supabase, ensure you have the Supabase CLI installed.

```bash
supabase functions deploy verify_task_submission --no-verify-jwt
```
(Repeat for the other functions, creating them as necessary).

### 3. Telegram Integration
To integrate with Telegram:
1. Speak to BotFather to create a new bot.
2. Get the Bot Token and configure the Web App URL to your hosted application URL.
3. In a real-world scenario, you would intercept `window.Telegram.WebApp.initData` inside the React application (perhaps in an Auth provider that wraps `<App />`), validate this locally or submit it to an Edge Function to verify signature hash, and then login/signup the user.

### 4. Running Locally
Simply run:
```bash
npm install
npm run dev
```
