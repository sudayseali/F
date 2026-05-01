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
      userId = params.uid;
      rewardAmount = parseFloat(params.currency_amount);
      transactionId = params.transaction_id;
      
      // Security: Ayet requires checking the exact server IPs or an HMAC signature
      // For this example, let's assume a secret key validation.
      // E.g., verifying an HMAC sent in headers if configured, or a custom secret param.
      const ayetSecret = Deno.env.get('AYET_SECRET');
      if (params.secret === ayetSecret) isSecure = true; 
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
      console.error(`Invalid Security Signature for ${provider}`);
      return new Response('403 Forbidden', { status: 403 });
    }

    if (!userId || isNaN(rewardAmount) || rewardAmount <= 0) {
      return new Response('400 Bad Request - Missing Parameters', { status: 400 });
    }

    // --- PROCESS THE REWARD ---

    // 1. Check if transaction ID already exists to prevent double crediting
    const { data: existingTx } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('id', transactionId)
      .single();

    if (existingTx) {
      return new Response('200 OK - Duplicate, already processed', { status: 200 });
    }

    // 2. Fetch the current user balance
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single();

    if (!profile) {
      return new Response('404 User Not Found', { status: 404 });
    }

    const newBalance = profile.balance + rewardAmount;

    // 3. Update User Balance
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ balance: newBalance })
      .eq('id', userId);

    if (profileError) throw profileError;

    // 4. Record the specific transaction
    const { error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        id: transactionId,
        user_id: userId,
        amount: rewardAmount,
        type: 'offerwall_reward',
        status: 'completed',
        created_at: new Date().toISOString(),
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
