# Payvora — Telegram Mini App Rewards & Micro-Task Platform

**Payvora** waa nidaam dhammaystiran oo ah **Telegram Mini App** loogu talagalay shaqooyinka yaryar (**Micro-Tasks**), sahannada iyo dallacaadaha (**Offerwalls & Surveys**), abaalmarinta maalinlaha ah (**Daily Check-In**), iyo martiqaadka (**10% Lifetime Referrals**) iyadoo lacag-bixinta lagu sameeyo Crypto (**USDT TRC20**, **USDT BEP20**, iyo **TRON TRX**).

---

## ⚙️ Sida Payvora u Shaqayso (How Payvora Works)

### 1. Gelitaanka & Xaqiijinta Telegram (Auth, VPN & Channel Gate)
Marka user-ku furo Payvora gudaha Telegram:
1. **Single-Flight Auth (`TelegramContext.tsx` & `telegramAuth.ts`):** Frontend-ku wuxuu hubiyaa `Telegram.WebApp.initData` wuxuuna u diraa Edge Function-ka `auth` hal codsi oo mideysan (wuxuuna dib u isku dayaa cilladaha network/5xx oo kaliya — marnaba dib uguma celiyo `401`/`403`).
2. **Xaqiijinta Saxeexa Telegram (`_shared/telegram-verification.ts`):** Backend-ku wuxuu ku xaqiijiyaa `HMAC-SHA256` isagoo adeegsanaya `TELEGRAM_BOT_TOKEN` iyo xilli-dhaca 1 saac ah (`3600s`) si looga hortago *replay attacks*.
3. **Baarista VPN / Proxy / Tor (`_shared/vpn-check.ts`):** IP-ga user-ka waxaa lagu hubiyaa `ip_risk_cache` iyo adeegyada IP reputation; haddii VPN, Proxy, Tor, ama Datacenter la ogaado waa la xiraa (`VPN_DETECTED`), iyadoo khaladaadka kaydinta cache-ku aanay marnaba jebin karin gelitaanka.
4. **Xubinimada Channel-ka (`@PayvoraCommunity`):** Kahor inta aan JWT la siin, Bot-ku (`getChatMember`) wuxuu hubiyaa in user-ku ku biiray channel-ka rasmiga ah; haddii kale waxaa loo soo bandhigaa shaashadda ku biirista.
5. **Maamulka Session-ka:** Haddii user-ku dhaafiyo shuruudaha, waxaa loo abuuraa ama loo cusboonaysiiyaa xogtiisa jadwalka `users` waxaana la siiyaa **Supabase JWT** (akoonnada `suspended` ah waa laga xiraa RLS & API).

---

### 2. Nidaamka Shaqooyinka (Micro-Tasks Lifecycle)
Bogagga **`Tasks.tsx`** iyo **`TaskDetails.tsx`** waxay ku xiran yihiin RPC-yada SQL iyo Edge Function-ka **`submit_task`**:

#### A. Labada Hab ee Xaqiijinta Task-ga
1. **Manual Screenshot Verification (`manual_screenshot`):**
   - User-ku wuxuu qabtaa shaqada, wuxuu qoraa `@username`-kiisa, wuxuuna soo geliyaa sawir caddayn ah (`PNG`, `JPG`, `WebP` ilaa `5MB`) gudaha Storage bucket gaar ah (`proofs/<user_uuid>/...`).
   - Backend-ku (`_shared/proof-hash.ts`) wuxuu ka soo dejiyaa faylka Storage-ka, wuxuu xaqiijiyaa *magic bytes*-ka sawirka dhabta ah, wuxuuna xisaabiyaa **SHA-256 hash**.
   - **Ka-hortagga Sawirrada la Koobiyey (`DUPLICATE_SCREENSHOT_PROOF`):** Haddii isla SHA-256 hash-kaas horay loogu soo diray isla task-gaas koonto kale, toos ayaa loo diidaa sawirkana waa laga tirtiraa Storage-ka. Haddii koonto kale horay ugu isticmaashay task kale, waxaa lagu calaamadeeyaa `audit_logs` (`suspicious_cross_task_screenshot_reuse`).
   - User-ka waxaa loo gudbiyaa xaaladda **Pending** iyadoo booskaas laga xirayo (`remaining_slots`) inta Admin-ku ka eegayo.
2. **Instant Telegram Auto-Verification (`auto_telegram_join`):**
   - Shaqooyinka ku biirista Channel/Group-ka Telegram, user-ku wuxuu gujiyaa **Verify & Claim**.
   - Backend-ku (`_shared/channel-check.ts`) wuxuu isla ilbiriqsigaas wacaa Telegram Bot API (`getChatMember`); haddii user-ku xubin yahay, `complete_auto_telegram_task_atomic` ayaa si toos ah ugu diiwaangelisa `approved`, u kordhisa wallet-ka, una dirta 10% referral commission iyadoon **Pending** gelin.

#### B. Qulqulka Boosaska, Ka-bixidda Tooska ah & Dib-u-gudbinta (Auto-Hide & Rejected Resubmit)
- **Available / Pending / Completed / Declined Tabs:**
  - Task-ga la soo gudbiyay ee **`pending`** ama **`approved`** ah isla markiiba wuu ka baxaa **Available**, wuxuuna u wareegaa **Pending** ama **Completed**.
  - **Ka-bixidda Tooska ah Marka Boosasku Dhammaadaan:** Marka boosaska bannaan (`remaining_slots = max_completions - approved - pending`) ay gaaraan `0` ama `current_completions >= max_completions` (`status = 'completed'`), SQL-ka (`get_active_tasks_with_slots`) iyo Frontend-kuba (oo adeegsada **Supabase Realtime + Focus auto-refresh**) si toos ah ayay task-ga uga saaraan **Available**.
  - **Haddii User Lagu Diido (`rejected`):** Haddii admin-ku diido caddaynta oo task-gu weli `active` yahay boosna bannaan yahay (`remaining_slots > 0`), iskudayga user-kuna ka yar yahay **3 jeer** (`attempt_count < 3`), task-gu wuxuu **dib ugu soo muuqdaa Available** isagoo leh calaamadda **"Declined · Resubmit"** iyo sababtii diidmada (sidoo kalena wuxuu ku jiraa tab-ka **Declined**). Marka user-ku caddayn cusub soo diro, sawirkii hore ee la diiday Storage-ka waa laga tirtiraa.
  - **Xakamaynta Waddamada (`allowed_countries`):** Haddii task loo xaddiday waddamo gaar ah, `submit_task` wuxuu hubiyaa waddanka IP-ga user-ka (`COUNTRY_NOT_ELIGIBLE`).
  - **Category & Search:** Qaybaha (`All`, `Social`, `Reviews`, `Other`) iyo sanduuqa raadinta waxay si sax ah u kala soocaan Telegram/YouTube/Twitter/Follow (`Social`) iyo Trustpilot/Feedback (`Reviews`).

---

### 3. Custom Offers Engine & Offerwalls
Bogga **`Offerwall.tsx`** iyo nidaamka offers-ka ee backend-ku (`offers_api`, `offer_click`, `sync_offers`, `get_cpx_url`, iyo postbacks) waxay isku xiraan **8 shabakadood oo partners ah**:
- **Torox, Lootably, ayeT-Studios, AdGate Media, AdGem, Adscend Media, CPX Research, iyo Tapjoy.**
- **Habka Shaqada:**
  - `sync_offers` wuxuu soo jiidaa offers-ka partners-ka isagoo xisaabinaya saamiga user-ka & faa'iidada Payvora (commission split & floor validation) kana saaraya links aan la hubin.
  - Marka user-ku furo offer, `offer_click` wuxuu abuuraa **opaque click token (`pv_...`)** oo qarinaya UUID-ga rasmiga ah ee user-ka.
  - Marka partner-ku soo diro webhook (`cpx_postback`, `cpa_postback`, `postback`, `tapjoy_webhook`), saxeexa sirta ah waxaa lagu hubiyaa *constant-time comparison*, waxaana lacagta lagu shubaa `atomic_wallet_credit` hal mar oo keliya (`idempotency_key`).
  - Haddii partner-ku soo diro **Chargeback / Reversal**, nidaamku wuxuu si aamin ah u jaraa lacagta (iyadoon wallet-ku marnaba hoos uga dhicin `$0.00`) wuuna dib u celiyaa referral commission-ka la xiriira.
  - **Missing Reward Disputes:** User-ku wuxuu furan karaa tikidh cabasho ah hadduu offer dhameeyo abaalmarintuna soo dhici weydo, kaas oo Admin-ku ka xalliyo `admin_api`.

---

### 4. Wallet, Lacag-bixinta (Withdrawals) & Daily Rewards
- **Qiyaasta Dhibcaha:** `1 USD = 1,000 PTS`.
- **Daily Check-In (`daily_checkin`):** User-ku wuxuu 24-kii saacba mar qaadan karaa **`+50 PTS`** isagoo leh ilaalinta VPN & rate limiting.
- **Hababka Lacag-bixinta (`Wallet.tsx` & `withdraw`):**
  - **USDT (TRC20)** — ugu yaraan `$1.00`
  - **USDT (BEP20)** — ugu yaraan `$1.00`
  - **TRON (TRX)** — ugu yaraan `$1.00`
- **Badbaadada Lacag-bixinta:** Codsiga withdrawal-ku wuxuu isticmaalaa database row lock (`FOR UPDATE`), wuxuuna jaraa hadhaaga isla marka la codsado; haddii Admin-ku diido (`admin_reject_withdrawal`), lacagta si toos ah ayaa loogu celiyaa wallet-ka.

---

### 5. Barnaamijka Martiqaadka (10% Lifetime Referrals)
Bogga **`Referrals.tsx`** wuxuu user kasta siiyaa link u gaar ah (`https://t.me/PayvoraBot?start=<telegram_id>`). Qof kasta oo ku soo biira wuxuu si toos ah **10% commission** uga helaa dakhliga tasks-ka iyo offerwalls-ka ee saaxiibkiis kasbado inta nidaamku jiro.

---

### 6. Ogeysiisyada & Telegram Bot Webhooks (`alerts` & `telegram-webhook`)
- User-ku wuxuu ka maamuli karaa **Profile.tsx** ogeysiisyada uu rabo (`task`, `offer`, `referral`, iyo `telegram_push`).
- Isbeddel kasta (task approved/rejected, instant credit, offer reward, referral commission, withdrawal approved/refunded, ama task cusub) wuxuu galaa **Alerts Bell** app-ka dhexdiisa iyo **Telegram Bot DM** iyadoo leh badhan toos u furaya Mini App-ka.

---

### 7. Amniga Guud & Maamulka Admin (`admin_api`)
- **Admin Console** waa frontend gaar ah oo ku xirma Edge Function-ka **`admin_api`** iyadoo leh **RBAC permissions** (`super_admin`, `admin`, `finance_admin`, `moderator`, `support`).
- Sawirrada caddaymaha ee private-ka ah waxaa admin-ka loogu furaa **1-hour Signed URLs**, fal kasta oo maamul ama mid shaki lehna waxaa lagu qoraa **`audit_logs`**.
- **Distributed Rate Limiting (`_shared/rate-limit.ts`):** Dhammaan endpoints-ka muhiimka ah waxay leeyihiin xaddidaad IP & User ID ah si looga hortago spam iyo bots.

---

## 📁 Qaabka Folders-ka & Files-ka (Project Structure)

```text
├── src/
│   ├── config/
│   │   └── appConfig.ts         # Magaca app-ka, Telegram links, Offerwalls, Payout limits & methods
│   ├── types/
│   │   └── index.ts             # TypeScript interfaces (TaskItem, UserTaskSubmissionItem, MarketplaceOffer, iwm.)
│   ├── lib/
│   │   ├── assets.ts            # 3D icons iyo sawirrada app-ka
│   │   ├── supabase.ts          # Supabase client & Edge Function invocation helpers
│   │   ├── taskLifecycle.ts     # Available/Pending/Completed/Declined filtering, Search, Category & Resubmit rules
│   │   ├── telegram.ts          # Telegram WebApp SDK helpers (Haptics, BackButton, Links)
│   │   ├── telegramAuth.ts      # Auth response classification, bounded retries & single-flight coalescing
│   │   └── utils.ts             # Class merging & helper utilities
│   ├── contexts/
│   │   └── TelegramContext.tsx  # Telegram login, channel gate, JWT session & live user state
│   ├── components/              # Layout, Navigation, PayvoraLoadingState, Modals, Notifications Bell
│   ├── pages/
│   │   ├── Dashboard.tsx        # Home screen, balance hero, daily check-in & quick actions
│   │   ├── Tasks.tsx            # Micro-tasks marketplace (Available, Pending, Completed, Declined + Realtime)
│   │   ├── TaskDetails.tsx      # Task instructions, Instant Verify, Screenshot Upload & Declined Resubmit
│   │   ├── Offerwall.tsx        # Multi-partner Custom Offers marketplace, history & dispute tickets
│   │   ├── Wallet.tsx           # Crypto withdrawals (USDT TRC20/BEP20, TRX) & transaction ledger
│   │   ├── Referrals.tsx        # Invite link, referral stats & 10% commission tracking
│   │   └── Profile.tsx          # Account info, alert preferences & support links
│   ├── App.tsx                  # Router configuration
│   └── main.tsx                 # React DOM entry point
├── supabase/
│   ├── functions/
│   │   ├── _shared/             # auth, admin-auth, vpn-check, channel-check, proof-hash, rate-limit, alerts, offers/, providers/
│   │   ├── auth/                # Telegram initData login & JWT issuance
│   │   ├── submit_task/         # Manual proof SHA-256 verification + Auto Telegram Join verification
│   │   ├── admin_api/           # Admin Console RBAC endpoints
│   │   ├── verify_task_submission/ # Legacy/admin task review hook
│   │   ├── daily_checkin/       # 24h +50 PTS claim endpoint
│   │   ├── withdraw/            # Atomic crypto payout requests
│   │   ├── offers_api/          # Custom offers catalog, user offer history & disputes
│   │   ├── offer_click/         # Opaque pv_ click tracking & partner redirect
│   │   ├── sync_offers/         # Partner offer catalog synchronization
│   │   ├── cpx_postback/        # CPX Research webhook
│   │   ├── cpa_postback/        # Generic CPA postback webhook
│   │   ├── postback/            # Multi-provider partner webhook
│   │   ├── tapjoy_webhook/      # Tapjoy callback webhook
│   │   ├── alerts/              # In-app notifications & preferences API
│   │   └── telegram-webhook/    # Bot commands & webhook updates
│   └── migrations/              # SQL schema, RLS policies, atomic RPCs & security hardening migrations
├── scripts/
│   ├── run-security-tests.ts    # Comprehensive security, auth, anti-fraud & task lifecycle tests
│   ├── run-offers-engine-tests.ts # Offerwall adapters, postbacks, VPN cache & reversal tests
│   └── deploy-backend.sh        # Automated Supabase migration & Edge Function deploy script
└── .github/workflows/
    └── deploy-supabase.yml      # GitHub Actions CI/CD to push SQL migrations & deploy Edge Functions on push to main
```

---

## 🛠 Sida Wax Looga Beddelo (Customization)

### 1. Xogta Guud, Telegram & Lacag-bixinta (`src/config/appConfig.ts`)
- **Bot & Community Links:** `APP_CONFIG.telegram.botUrl`, `communityUrl`, `supportUrl`
- **Offerwall IDs:** `APP_CONFIG.offerwalls.cpx.appId`, `ayet.appId`, `torox.pubId`
- **Daily Check-In & Referral %:** `APP_CONFIG.rewards.dailyCheckInPoints`, `referralBonusPercent`
- **Crypto Payout Methods:** `APP_CONFIG.payouts.supportedMethods` (**USDT TRC20**, **USDT BEP20**, **TRON TRX**) iyo `minWithdrawalUsd` (`$1.00`)

### 2. Astaamaha 3D (`src/lib/assets.ts`)
- Dhammaan sawirrada iyo calaamadaha 3D ee `public/assets/icons3d/` waxaa laga maamulaa `ASSETS_3D`.

---

## 🚀 Orodka, Tijaabada & Deploy-ga (Running, Testing & Deployment)

### 1. Orodka Deegaanka Horumarinta (Local Development)
```bash
# Ku shub dependencies
npm install

# Orod dev server-ka (Port 3000)
npm run dev

# Hubi TypeScript types-ka & dhismaha production-ka
npm run lint
npm run build
```

### 2. Tijaabooyinka Amniga & Offer Engine-ka (Automated Tests)
```bash
# Tijaabada amniga, auth, SHA-256 screenshot guard & task lifecycle
npm run test:security

# Tijaabada offerwall adapters, postback verification & VPN checks
npm run test:offers
```

### 3. Deploy-ga Supabase (SQL Migrations & Edge Functions)
- **GitHub Actions (Automatic on push to `main`):** Workflow-ga `.github/workflows/deploy-supabase.yml` wuxuu si toos ah u shubaa dhammaan SQL migrations-ka (`supabase db push`) iyo dhammaan Edge Functions-ka marka **Repository Secrets** lagu daro GitHub:
  - `SUPABASE_PROJECT_ID`
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_DB_PASSWORD`
  - Secrets-ka runtime-ka sida `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `JWT_SECRET`, iyo furayaasha partners/IP (`PROXYCHECK_KEY`, `IPAPI_KEY`, iwm).
- **Terminal Deploy:**
  ```bash
  export SUPABASE_ACCESS_TOKEN="sbp_..."
  export SUPABASE_DB_PASSWORD="..."
  npm run deploy:supabase
  ```
