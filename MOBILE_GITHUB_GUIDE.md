# 📱 Hagaha Rasmiga ah ee Loo Dalbado Supabase (Mobile & GitHub)

Maadaama aadan haysan Computer isla markaasna aad mobile isticmaalayso, waxaan idiin habeeyay **GitHub Actions** si aad ugu shubto Edge Functions-ka adoon isticmaalin (Supabase CLI) ama Terminals dhib badan.

Code-ka oo dhan waxaan u habeeyay sidii uu toos u aqoonsan lahaa GitHub si uu u geeyo (deploy) Supabase Server-ka. Kaliya raac qodobadan fudud adigoo isticmaalaya browser-ka Mobile-kaaga (Chrome/Safari):

## Tillaabada 1aad: Ku Dhis SQL-ka Supabase Dashboard
Tani waxay dhisaysaa rules-ka iyo database-ga:
1. Mobile-kaaga ka fur **Supabase Dashboard** (https://supabase.com/dashboard).
2. Gal project-gaaga, kadib dhanka bidix uga gal **SQL Editor**.
3. Guji **New Query**.
4. Kusoo copy garee code-ka ku jira file-ka aan horay kuu siiyay ee `supabase_config/schema.sql`, kadib taabo **Run**.
5. Fur **New query** kale.
6. Kusoo copy garee code-ka ku jira file-ka `supabase_config/secure_rpc.sql` oo taabo **Run**.

*(Hadda Database-kaagii waa diyaar!)*

## Tillaabada 2aad: Ku Geli Xogaha Qarsoon (Secrets) Supabase
Edge functions-ku waa inay ogaadaan Bot Token-kaaga si ay u xaqiijiyaan users-ka.
1. Supabase Dashboard bidixda uga gal **Edge Functions**.
2. Samee dhowr functions haddaan loo baahnayn waa caadi in ay madhan yihiin, la soco dhanka kore guji qeybta **Secrets**.
3. Guji **Add new secret** waxaadna ku dartaa labadan (si sax ah ugu qor far waaweyn):
   - Name: `TELEGRAM_BOT_TOKEN` | Value: (Geli token-ka dhabta ah ee bot-kaaga)
   - Name: `ADMIN_TELEGRAM_ID` | Value: `5806129562`

## Tillaabada 3aad: U Dhoofi Project-gan GitHub (Export)
Ku noqo meesha aad hadda ila hadlayso (Google AI Studio Preview):
1. Dhanka sare ee midigta (Settings menu), guji **Export to GitHub**.
2. Sii magac aad u baxsatay (Tusaale: `telegram-mini-app-backend`).
3. Sug ilaa uu wada geynayo GitHub.

## Tillaabada 4aad: Kaxee Supabase Access Token
Hadda waa inaad u ogolaata GitHub inuu code-kaaga u daabuli karo (deploy) Supabase-kaaga:
1. Browser-ka mobiile-kaaga kaga laabo Supabase Dashboard.
2. Dhanka kore midigta, taabo sawirkaaga (Profile) oo dooro **Access Tokens**.
3. Taabo **Generate new token**, u bixi magac (Tusaale: "GitHub Deploy"), kadib soo copy garee Token-ka (wuxuu u egyahay sbp_xxxx...). *Kari meel ammaan ah ha dumin*
4. Waxaad sidoo kale u baahan tahay **Project ID-gaaga** (Wuxuu ku jiraa URL-ka project-gaaga ee Supabase, tusaale ahaan `https://supabase.com/dashboard/project/abcdefghijklmnopqrst` -> aqoonsiga waa `abcdefghijklmnopqrst`).

## Tillaabada 5aad: Ku Xir Github (Deploy)
1. Browser-ka mobiile-kaaga ka fur **GitHub** oo gal repo-gii aad sameysay markii aad "Export to GitHub" lahayd.
2. Kor uga gal batoonka **Settings** (Astaanta giraangirta/gear).
3. Hoos ugu dhaadhac qaybta **Secrets and variables** > kadibna guji **Actions**.
4. Guji batoonka cagaaran ee **New repository secret**.
5. Ku dar labadan sir (Secrets):
   - Name: `SUPABASE_ACCESS_TOKEN` | Secret: (Kusoo paste garee Tokenkii `sbp_xxxx` ahaa ee aad soo qaadatay)
   - Name: `SUPABASE_PROJECT_ID` | Secret: (Kusoo paste garee Project ID-gaagii aad xagga sare kasoo qaadatay `abcdef...`)

## Tillaabada 6aad: Shid Bot-ka
GitHub Actins iskeed ayay u shaqayn doontaa markasta oo aad xog ku kordhiso. 
Si aad markii ugu horeysay u kaxayso:
1. GitHub repo-gaaga, dhanka sare ka guji qaybta ugu qoran **Actions**.
2. Guji **Deploy Supabase Edge Functions** ee ku dhex qoran dhanka bidix.
3. Midigta waxaad ku arkaysaa batoon leh **Run workflow**, taabo!

Sug ilaa 2-3 daqiiqo. GitHub ayaa toos u qaadi doonta 5-ta Edge Functions ugana dhisi doonta Supabase-gaaga. Hambaalyo! Haddaba code-kaagu wuxuu u nabad galyo sugan yahay si heer sare ah! 🎉
