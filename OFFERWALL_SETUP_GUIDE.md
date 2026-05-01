# Hagaha Setup-ka Offerwall & Secure Postback (Pro Level)

Halkan waxaa ku qoran hagaha sida loo xiro loona xaqiijiyo (secure) dhammaan network-yada offerwall laga soo bilaabo midka koowaad ilaa ka ugu dambeeya.

Waxaan isticmaaleynaa **Supabase Edge Functions** si loo sameeyo **Secure S2S (Server-to-Server) Postback**. Kani waa habka kaliya ee xaqiijinaya in dadka jabsada (hackers) aysan app-kaaga lacag been ah (fake rewards) ku darsan karin.

---

## 1. Waa maxay Postback URL?

Marka user-kaaga uu offer (sida game ama survey) ku dhameeyo Ayet ama AdGate, shirkadaasi waxay si qarsoodi ah (backend) u soo wacaysaa server-kaaga si ay kuugu sheegto in user-ku offer-ka dhameeyay lacagtiisana loo shubo.

URL-ka ay soo wacayaan waxaa loo yaqaanaa **Postback URL** ama **Callback URL**.

### Tusaalaha Postback URL-kaaga:
Haddii aad Supabase isticmaalysid, Edge function-kaaga wuxuu noqonayaa mid u eg sidan:
`https://[YOUR_SUPABASE_PROJECT_REF].supabase.co/functions/v1/postback?provider=ayet&uid={user_id}&currency_amount={currency}&transaction_id={transaction_id}&secret=YOUR_AYET_SECRET`

---

## 2. Diyaarinta Code-ka (Edge Function)

Waxaan horeyba kuugu diyaariyay code-ka postback-ga oo ku dhex jira folder-ka `supabase/functions/postback/index.ts`. Function-kani wuxuu soo qabtaa requests-ka, wuxuu xaqiijiyaa in sirta (secret key) sax tahay, wuxuuna balance-ka ugu shubaa database-ka isagoon dhinac kale marin.

### Sida loo deploy gareeyo Edge Function-ka:
1. Geli terminal-kaaga.
2. Login garee Supabase: `npx supabase login`
3. Ku xir project-gaaga: `npx supabase link --project-ref [YOUR_PROJECT_ID]`
4. Deploy function-ka dhaha postback:
   `npx supabase functions deploy postback --no-verify-jwt`

*(Fiiro gaar ah: `--no-verify-jwt` waxay u ogolaanaysaa offerwall-yada inay soo diraan request iyagoon user token heysan, waayo waa backend-to-backend).*

---

## 3. Sida Network Kasta Loo Xiro (Mid ka mid ah)

### 🎮 1. ayeT-Studios
1. Gal ayeT-Studios Publisher Dashboard > **Placements**.
2. Samee placement cusub, dooro **API / Network** ama Website.
3. Qaybta **Callback URL**, geli:
   `https://[YOUR_PROJECT].supabase.co/functions/v1/postback?provider=ayet&uid={uid}&currency_amount={currency_amount}&transaction_id={transaction_id}&secret=[YOUR_AYET_SECRET]`
4. **Security Check**: Geli Supabase Secrets-kaaga `AYET_SECRET` adigoo terminal ka garaacaya:
   `npx supabase secrets set AYET_SECRET="YOUR_AYET_SECRET"`

### 🎮 2. Torox
1. Gal Torox Dashboard > App Settings.
2. Hel Postback / Callback settings.
3. Callback URL:
   `https://[YOUR_PROJECT].supabase.co/functions/v1/postback?provider=torox&user_id={user_id}&amount={amount}&tx_id={tx_id}`
4. Torox waxay sida caadiga ah isticmaashaa HMAC ama IP whitelisting. Si joogto ah ugu dar sirtooda secrets-ka: 
   `npx supabase secrets set TOROX_SECRET="sirta_torox"`

### 📱 3. AdGate Media
1. Gal AdGate > Wall Settings > **Postbacks**.
2. URL format-koodu waa:
   `https://[YOUR_PROJECT].supabase.co/functions/v1/postback?provider=adgate&s1={s1}&points={points}&tx_id={transaction_id}&secret=[YOUR_ADGATE_SECRET]`
3. Goobta app-kaaga, marka aad load garayso iframe-ka AdGate, iska hubi in `s1` la socdo user-kaaga ID-giisa: `&s1=${user.id}`.
4. Set the secret: `npx supabase secrets set ADGATE_SECRET="YOUR_ADGATE_SECRET"`

### 📱 4. Lootably
1. Gal Lootably Publisher Dashboard > Apps > Postback.
2. URL:
   `https://[YOUR_PROJECT].supabase.co/functions/v1/postback?provider=lootably&userID={userID}&reward={reward}&transactionId={transactionId}&hash={hash}`
3. Set the secret: `npx supabase secrets set LOOTABLY_SECRET="YOUR_LOOTABLY_SECRET"`

### 📝 5. CPX Research (Surveys)
1. Gal dashboard-ka CPX Research.
2. Qaybta **Server-to-Server Callback**, ku qor URL-ka:
   `https://[YOUR_PROJECT].supabase.co/functions/v1/postback?provider=cpx&ext_user_id={ext_user_id}&amount_local={amount_local}&trans_id={trans_id}&secure_hash={secure_hash}`
3. Qaybta `secure_hash` waxay hubinaysaa in offer-ku jaban yahay (secure).
4. Set the secret oo ah CPX Hash Key-ga: `npx supabase secrets set CPX_SECRET="YOUR_CPX_HASH"`

### 🌐 6. CPA Offers (CPALead ama network kasta oo CPA ah)
- Network-yada CPA waxay inta badan u shaqeeyaan isku si. Diyaari callback parameter-ka (`sub1` ama `s1`) inuu noqdo User ID, si lacagta ugu dhacdo user-kii saxda ahaa.

---

## 4. Talooyin Amniga Heerka Ugu Sarreeya (Pro Security Tips)
Si aysan kuugu dhicin in lacag lagala baxo app-ka:

- **IP Whitelisting**: Had iyo jeer hubi in Edge Function-kaaga postback-ga uu hubiyo in Request-ga ka imanayo IP-yada saxda ah ee Ayet, AdGate, iwm kaga leeyihiin documentation-kooda rasmiga ah. Tusaale ahaan Ayet waxay leeyihiin IP address-yo u gaar ah.
- **Transaction Deduplication**: Koodhka aan kuu qoray wuxuu eegayaa table-ka `transactions` haddii `transactionId` uu mar hore jiro si aan lacag isla hal offer ah dhowr jeer loo bixin (Duplicate payment prevention).
- **Abuse Prevention Rules**: Waligaa (QATAN!) ha samayn API update balance client-side ka imaanaya si user kasta uusan browser console lacag ugu dirsan karin. Lacag bixinta dhamaanteed waa in ay ku dhacdaa oo keliya Postback Edge Function-kan.

Hambalyo! Hadda waxaad haysataa qaab-dhismeedka rasmiga ee **Payvora Enterprise**. Waa secure, waa la xakameyn karaa, wayna ku shubi kartaa malaayiin transactions ah iyadoon jabin.
