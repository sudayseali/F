# Payvora - Telegram Mini App Platform

A production-grade, highly-aesthetic Telegram Mini App for micro-tasks, paid surveys, and crypto rewards.

---

## 📁 Habka Folders-ka iyo Files-ka (Folder Structure)

Koodhka waxaa loo habeeyay qaab modular ah si qof kasta uu si fudud wax uga beddeli karo:

```text
├── src/
│   ├── config/
│   │   └── appConfig.ts       <- ⭐️ HALKAN KA BEDDEL: Magaca app-ka, Bot-ka, Links-ka, Offerwalls, & Payouts
│   ├── types/
│   │   └── index.ts           <- ⭐️ Central TypeScript types (User, Provider, PaymentMethod, Task, iwm.)
│   ├── lib/
│   │   ├── assets.ts          <- ⭐️ Dhammaan 3D icons iyo sawirrada app-ka
│   │   ├── supabase.ts        <- Supabase Client & Backend connection
│   │   ├── telegram.ts        <- Telegram WebApp SDK helpers (Haptics, BackButton, Links)
│   │   └── utils.ts           <- Helper functions (cn class merging)
│   ├── contexts/
│   │   └── TelegramContext.tsx <- User authentication & live balance state
│   ├── components/
│   │   ├── index.ts           <- Barrel exports (fududeeya import-ka)
│   │   ├── Layout.tsx         <- Main wrapper layout
│   │   ├── Navigation.tsx     <- Top App Bar & Bottom Navigation Dock
│   │   ├── TelegramModal.tsx  <- Native Telegram-style alert/modal
│   │   └── SplashScreen.tsx   <- Initial app loading animation
│   ├── pages/
│   │   ├── index.ts           <- Barrel exports for pages
│   │   ├── Dashboard.tsx      <- Home screen (3D Wallet hero, quick actions, featured offers)
│   │   ├── Offerwall.tsx      <- Partner offerwalls (CPX, ayeT, Torox, Lootably, AdGate, CPA)
│   │   ├── Tasks.tsx          <- Active micro-tasks, task stats & bounties
│   │   ├── TaskDetails.tsx    <- Task proof submission & details
│   │   ├── Wallet.tsx         <- Payouts (USDT TRC20, TRON TRX, Payeer USD) & history
│   │   ├── Profile.tsx        <- User account, verified status & settings menu
│   │   └── Referrals.tsx      <- 10% lifetime referral invite program
│   ├── App.tsx                <- Router & routes configuration
│   └── main.tsx               <- React DOM root entry
├── public/
│   └── assets/
│       └── icons3d/           <- 16-ka calaamadood ee 3D-ga ah ee transparent PNG ah
├── supabase/
│   ├── functions/             <- Edge Functions (withdraw, cpx_postback, verify_task)
│   └── migrations/            <- Database SQL tables and security policies
└── .env.example               <- Environment variables template
```

---

## 🛠 Sida Wax Looga Beddelo (How to Customize)

### 1. Beddelka Xogta Guud (Settings & Links)
Gal faylka: `src/config/appConfig.ts`:
- **Bot Link**: `APP_CONFIG.telegram.botUrl`
- **Channel / Community**: `APP_CONFIG.telegram.communityUrl`
- **Support**: `APP_CONFIG.telegram.supportUrl`
- **CPX Research App ID**: `APP_CONFIG.offerwalls.cpx.appId`
- **ayeT-Studios ID**: `APP_CONFIG.offerwalls.ayet.appId`
- **Lacag Bixinta (USDT, TRX, Payeer)**: `APP_CONFIG.payouts`

### 2. Beddelka Astaamaha 3D-ga ah (Icons & Images)
Gal faylka: `src/lib/assets.ts`:
- Dhammaan dariiqyada 3D icons-ka waxay ku jiraan `ASSETS_3D`.

### 3. Beddelka Habka Lacag Bixinta (Payment Methods)
Gal faylka: `src/pages/Wallet.tsx` ama `src/config/appConfig.ts`:
- Hadda waxa si buuxda u shaqaynaya **USDT (TRC20)**, **TRON (TRX)**, iyo **Payeer USD**.

---

## 🚀 Orodka iyo Tijaabada (Running & Testing)

```bash
# Ku shub dependencies
npm install

# Orod dev server-ka (Port 3000)
npm run dev

# Hubi koodhka & dhismaha
npm run build
```
