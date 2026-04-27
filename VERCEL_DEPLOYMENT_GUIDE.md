# 🌐 Sida Frontend-ka Loogu Xiro Supabase Iyadoo La Isticmaalayo Vercel (Mobile Guide)

Marka aad dhamaystirto backend-ka (Supabase), waa in aan Frontend-ka (React/Vite) ku xirnaa Supabase si loo wada shaqaysiiyo. Waa in aynu adeegsanaa **Environment Variables (.env)** si ammaan ah, maadaama Vercel lagu host garaynayo.

Maadaama aad Mobile isticmaalayso, raac tillaabooyinkan fudud ee Vercel Dashboard:

## Tillaabada 1aad: Helitaanka VITE_SUPABASE_URL iyo VITE_SUPABASE_ANON_KEY
Ka hor inta aadan aadin Vercel, waa inaad soo koobi gareysaa Furayaasha (Keys) Supabase-kaaga:
1. Gal **Supabase Dashboard** (https://supabase.com/dashboard).
2. Fur project-gaaga.
3. Hoos uga deg dhanka bidix, guji astaanta giringirta / gear (⚙️ **Project Settings**).
4. Dooro qaybta in yar hoos u xigta ee **API**.
5. Waxaad arki doontaa labo shay oo muhiim ah:
   - **Project URL:** Soo copy garee linkiga halkaas ku yaal. (Wuxuu u noqon doonaa `VITE_SUPABASE_URL`).
   - **Project API Keys:** Soo copy garee key-ga ugu horeeya ee lagu magacaabay `anon` iyo `public`. (Wuxuu u noqon doonaa `VITE_SUPABASE_ANON_KEY`).

Ku qor Notebook-ga mobiilkaaga ama meel Copy kusii hay.

## Tillaabada 2aad: Ku Geli Furayaasha Vercel
Marka aad project-gaaga dib ugu soo daabushay GitHub, ugu xir Vercel sidan (haddii uusan horay ugu xirneyn Vercel, soo import garee repo-gaaga):

1. Ka fur browser-ka mobiile-kaaga: **Vercel Dashboard** (https://vercel.com/dashboard).
2. Dooro Project-gaaga app-kan (Tusaale: `telegram-mini-app`).
3. Kor ka dooro **Settings**.
4. Menu-ga bidix (ama ka dooro hoos-u-dhaca mobiilka), guji **Environment Variables**.
5. Hadda, ku dar labadii shay ee aad ka keentay Supabase:

   **Shayga 1aad:**
   - **Key:** `VITE_SUPABASE_URL`
   - **Value:** (Ku paste garee URL-kii aad ka keentay Supabase e.g., `https://xxxx.supabase.co`)
   - Taabo **Save** ama **Add**.

   **Shayga 2aad:**
   - **Key:** `VITE_SUPABASE_ANON_KEY`
   - **Value:** (Ku paste garee koodhkii dheeraa `anon` `public` key ee aad ka keentay Supabase "eyJ...")
   - Taabo **Save** ama **Add**.

## Tillaabada 3aad: Dib u Dhis (Redeploy)
Si Variables-ka cusub ay app-ka uga shaqeeyaan, waa in aan mar labaad la dhiso (Redeploy):
1. Vercel dashboard isla project-ga, guji tab-ka korka ee **Deployments**.
2. Guji kii ugu dambeeyay (midka ugu sareeya) xagga midigta ee leh 3 dhibcood (`...`).
3. Dooro **Redeploy**.
4. Sug daqiiqado in uu dhiso (Build).

Hadda App-kaagu wuxuu ula xiriiraa Database-ka Supabase qaab toos ah oo Ammaan ah. Koodhka frontend-ka isagaa toos isugu fahmaya `.env` ka aad galisay.

## Talooyin Dheeraad ah (Local Development)
Haddii aad gadaal ka hesho computer oo aad rabto inaad app-ka local ahaan ku tijaabiso adigoon Vercel dhigin, kaliya waxaad samaynaysaa fail magaciisu yahay `.env` (oo aan laheyn .example) Root-ga (folderka ugu horeeya) ee application-kaaga, geli sidan:
```env
VITE_SUPABASE_URL=https://xxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh....
```

Fadlan ilaali Furayaashaada hana u wadaagin ciddna! (Vercel dhexdiisa si nabad ah ayay ugu kaydsan yihiin).
