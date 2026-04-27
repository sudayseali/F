# 🚀 Sida Loo Diyaariyo Supabase Backend (Edge Functions & PostgreSQL)

Si aad u shaqaysiiso code-kan ammaaniga ah (secure), raac tillaabooyinkan isku-xiga. Waxaad u baahan doontaa in aad kombuyuutarkaaga ku shubto Supabase CLI.

## Tillaabada 1aad: Dhismaha Database-ka (SQL Schema & RPC)

Kani waa tillaabada ugu horraysa. Waa in aad SQL-ka galisaa Supabase si database-ka iyo server-side functions-ka (RPC) ay u dhismaan.

1. Gal account-kaaga: [Supabase Dashboard](https://supabase.com/dashboard)
2. Fur project-gaaga.
3. Bidixda ka dooro **SQL Editor**.
4. Guji **New query**.
5. Soo koobi (Copy) code-ka ku jira file-ka `supabase_config/schema.sql` oo ku dhex paste garee dhanka midig, kadibna taabo **Run**.
6. Marka uu kaas dhammaado, fur **New query** kale.
7. Soo koobi code-ka ku jira `supabase_config/secure_rpc.sql` oo Run dheh.

*Hadda database-kaaga, rules-ka RLS (Row Level Security), iyo Secure Functions-ka waa diyaar.*

---

## Tillaabada 2aad: Ku xir Terminal-kaaga (Supabase CLI)

Waxaad u baahantahay in aad soo dejiso (install) Supabase CLI si aad edge functions-ka u geyso (deploy) server-ka.

**Terminal-kaaga ku qor:**
```bash
# Haddii aad isticmaalayso NPM (Node.js)
npm install -g supabase

# Hubi inuu shaqaynayo
supabase -v
```

**Gudaha gal oo xir project-gaaga:**
```bash
# Samee login (waxay ku geyneysaa browser-ka si aad u ogolaato)
supabase login

# Xiriir project-gaaga (Bedel 'your-project-ref' kaas oo aad ka helayso Supabase Settings > API)
supabase link --project-ref your-project-ref
```

---

## Tillaabada 3aad: Abuur Folders-ka Edge Functions-ka

Supabase waxay edge functions-ka ka akhrisaa galka `supabase/functions/`. Haddaba aan dhisno!

**Terminal-ka ku qor:**
```bash
supabase init

supabase functions new auth
supabase functions new submit_task
supabase functions new withdraw
supabase functions new deposit
supabase functions new admin_action
```

**Kadib, koobi garee (copy) files-kii aan horay u qornay:**
1. Fur `supabase_config/edge_functions/auth.ts` -> oo gali gudaha `supabase/functions/auth/index.ts`
2. Fur `supabase_config/edge_functions/submit_task.ts` -> oo gali gudaha `supabase/functions/submit_task/index.ts`
3. Fur `supabase_config/edge_functions/withdraw.ts` -> oo gali gudaha `supabase/functions/withdraw/index.ts`
4. Fur `supabase_config/edge_functions/deposit.ts` -> oo gali gudaha `supabase/functions/deposit/index.ts`
5. Fur `supabase_config/edge_functions/admin_action.ts` -> oo gali gudaha `supabase/functions/admin_action/index.ts`

*(Fiiro gaar ah: Files-ka aad abuurayso waa inay noqdaan `index.ts` oo ku dhex jira folder-ada magaca function-ka wata).*

---

## Tillaabada 4aad: Geli Xogta Qarsoodiga ah (Secrets)

Edge functions-ku waxay u baahan yihiin `TELEGRAM_BOT_TOKEN` iyo xogaha kale si aysan u dhicin in hackers-ku soo galaan. 
*(Note: `SUPABASE_URL` iyo `SUPABASE_SERVICE_ROLE_KEY` iskeed ayay Supabase u dhex galisaa functions-ka marwalba, marka uma baahnid inaad adigu set garayso).*

**Terminal-ka ku qor si aad Environment Variables ugu shubto server-ka Supabase:**
```bash
# Ku dar Telegram Bot Token-kaaga dhabta ah
supabase secrets set TELEGRAM_BOT_TOKEN="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"

# Ku dar Telegram ID-gaaga Adminka ah
supabase secrets set ADMIN_TELEGRAM_ID="5806129562"
```

---

## Tillaabada 5aad: U dir Server-ka (Deploy)

Markii intaas oo dhan aad dhamayso, waxaad code-ka u diraysaa Supabase Server.

**Terminal-ka ku qor:**
```bash
supabase functions deploy auth
supabase functions deploy submit_task
supabase functions deploy withdraw
supabase functions deploy deposit
supabase functions deploy admin_action
```

Marka aad deploy garayso, Supabase waxay ku siin doontaa URL-lada Functions-ka. (Tusaale: `https://xxxxxxx.supabase.co/functions/v1/auth`).

---

## Tillaabada 6aad: Sida Frontend-ka loogu Isticmaalayo

Hadda Frontend-ka (React/Vite) qaybta aad calls-ka ka samaynaysay, waxaad isticmaali doontaa URL-yada cusub.

Tusaale marka user-ku auth samaynayo React:
```javascript
const response = await fetch('https://your-project-ref.supabase.co/functions/v1/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ initData: window.Telegram.WebApp.initData })
});

const data = await response.json();
if (data.success) {
  // Save data.user_uuid in local state/storage
  // data.is_admin will be true/false securely
}
```

Tusaale marka la Withdraw-garaynayo (Lacag lala baxayo):
```javascript
const response = await fetch('https://your-project-ref.supabase.co/functions/v1/withdraw', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    user_uuid: currentUserId, // UUID-ga lagu siiyay markii aad auth-ga samaysay
    amount: 10.50, 
    wallet_address: "T123xxxx...", 
    method: "trx" 
  })
});

const data = await response.json();
// Tani waxay toos hoos uga jaraysaa Balance-ka (PostgreSQL dhexdiisa)
```
