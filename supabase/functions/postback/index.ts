import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

// Initialize Supabase Admin Client
// This requires the PROJECT_URL and SERVICE_ROLE_KEY to be set in the edge function environment.
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider'); // e.g., ?provider=ayet
    
    // Parse the query parameters sent by the offerwall
    const params = Object.fromEntries(url.searchParams.entries());
    
    // Default variables we need to extract from varying network params
    let userId = '';
    let rewardAmount = 0;
    let transactionId = '';
    let isSecure = false;

    // --- 1. AYET STUDIOS ---
    if (provider === 'ayet') {
      // Ayet sends params like: uid, currency_amount, transaction_id, payout_usd
      userId = params.uid ? params.uid.replace(/[\[\]{}"]/g, '') : '';
      rewardAmount = parseFloat(params.currency_amount);
      transactionId = params.transaction_id;
      
      const ayetSecret = Deno.env.get('AYET_SECRET');
      console.log(`[POSTBACK] Ayet Setup - Provided Secret: ${params.secret}, Env Secret exists: ${!!ayetSecret}`);
      
      if (!ayetSecret) {
         return new Response(`403 Forbidden - AYET_SECRET environment variable is not set in Supabase Edge Function! Please run 'supabase secrets set AYET_SECRET="your_secret"' and redeploy.`, { status: 403 });
      }

      if (params.secret === ayetSecret) {
        isSecure = true; 
      } else {
         return new Response(`403 Forbidden - Security Hash Mismatch for ayet. Provided secret in URL does not match AYET_SECRET in Supabase. Lengths: URL(${params.secret?.length}), ENV(${ayetSecret?.length})`, { status: 403 });
      }
    }
    
    // --- 2. TOROX ---
    else if (provider === 'torox') {
      userId = params.user_id;
      rewardAmount = parseFloat(params.amount);
      transactionId = params.tx_id;
      
      // Torox sends a signature parameter typically MD5(uid + tx_id + secret)
      const toroxSecret = Deno.env.get('TOROX_SECRET');
      // Validation logic here based on their specific hashing algorithm...
      isSecure = true; // Placeholder
    }

    // --- 3. ADGATE MEDIA ---
    else if (provider === 'adgate') {
      userId = params.s1; // Usually passed in sub id 1
      rewardAmount = parseFloat(params.points);
      transactionId = params.tx_id;
      isSecure = params.secret === Deno.env.get('ADGATE_SECRET');
    }

    // --- 4. LOOTABLY ---
    else if (provider === 'lootably') {
      userId = params.userID;
      rewardAmount = parseFloat(params.reward);
      transactionId = params.transactionId;
      isSecure = params.hash === Deno.env.get('LOOTABLY_SECRET');
    }
    
    // --- 5. CPX RESEARCH ---
    else if (provider === 'cpx') {
      userId = params.ext_user_id;
      rewardAmount = parseFloat(params.amount_local);
      transactionId = params.trans_id;
      isSecure = params.secure_hash === Deno.env.get('CPX_SECRET');
    }

    if (!isSecure) {
      console.error(`[POSTBACK] 403 Forbidden. Secret mismatch or missing for ${provider}. Is Env Secret set? ${!!Deno.env.get('AYET_SECRET')}`);
      return new Response(`403 Forbidden - Security Hash Mismatch for ${provider}`, { status: 403 });
    }

    if (userId) {
      userId = userId.replace(/[\[\]{}"]/g, '');
    }

    if (!userId || isNaN(rewardAmount) || rewardAmount <= 0) {
      return new Response('400 Bad Request - Missing Parameters', { status: 400 });
    }

    // --- PROCESS THE REWARD ---

    // 1. Check if transaction ID already exists to prevent double crediting
    const { data: existingTx, error: txCheckError } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('reference_id', transactionId)
      .maybeSingle();

    if (txCheckError) {
      console.error(`[POSTBACK] Tx lookup error:`, txCheckError);
      return new Response(`500 Internal Server Error (Tx Lookup): ${JSON.stringify(txCheckError)}`, { status: 500 });
    }

    if (existingTx) {
      return new Response('200 OK - Duplicate, already processed', { status: 200 });
    }

    // 2. Fetch the current user balance
    // The userId passed by the offerwall might be the Telegram ID (number)
    let userQuery = supabaseAdmin.from('users').select('id, balance');
    
    console.log(`[POSTBACK] Searching for user with id/telegram_id: ${userId}`);

    if (/^\d+$/.test(userId)) {
      // It's a Telegram ID. We pass it as a string to avoid precision loss on BIGINT in Postgres.
      userQuery = userQuery.eq('telegram_id', userId);
    } else {
      // It's a UUID
      userQuery = userQuery.eq('id', userId);
    }

    const { data: userRecord, error: userError } = await userQuery.maybeSingle();

    if (userError) {
      console.error(`[POSTBACK] User lookup error:`, userError);
      return new Response(`500 Internal Server Error (User Lookup): ${JSON.stringify(userError)}`, { status: 500 });
    }

    if (!userRecord) {
      console.warn(`[POSTBACK] User not found for: ${userId}`);
      return new Response('404 User Not Found', { status: 404 });
    }

    console.log(`[POSTBACK] User found: ${userRecord.id}, Current Balance: ${userRecord.balance}`);
    const newBalance = Number(userRecord.balance) + rewardAmount;

    // 3. Update User Balance
    const { error: rpcError } = await supabaseAdmin.rpc("reward_user", {
      user_id: userRecord.id,
      amount: rewardAmount,
    });

    if (rpcError) throw rpcError;

    // 4. Note: reward_user already records the transaction, but if we need a specific reference_id,
    // we might have to update the transaction table, or modify the RPC.
    // To preserve transactionId logic without changing RPC immediately:
    // Actually, `reward_user` records a generic transaction. Let's record the reference_id manually
    // by updating the newly created transaction if we want, or just insert the tapjoy transaction
    // and rely on reward_user for balance.
    // For now, reward_user creates a transaction with type 'task_reward'.
    // If we want to record the transactionId specifically for postbacks, 
    // let's insert it just to be safe so duplicate checks work.
    
    // We already recorded transaction in reward_user but it lacks reference_id.
    // Let's insert a tracking record with amount=0 or just the reference_id if needed,
    // OR we change the RPC. But let's just use `transactions` table with 0 amount to mark it tracked 
    // or just leave it as is and use the txError insert. Wait, if we use reward_user, it gives balance.
    const { error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userRecord.id,
        amount: 0, // already credited in reward_user, this is just to prevent duplicates
        type: 'postback_reference',
        status: 'completed',
        reference_id: transactionId,
      });

    if (txError) throw txError;

    // Return successfully so the Offerwall network stops pinging
    // Some networks require '1'. AdGate/Ayet generally look for HTTP 200.
    return new Response('1', { status: 200 });

  } catch (err) {
    console.error('Postback Error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
});
