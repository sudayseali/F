import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { user_uuid, amount, method, tx_id } = await req.json();

    // 1. INPUT VALIDATION (Never trust frontend)
    if (!amount || amount <= 0) throw new Error("Invalid deposit amount.");
    if (!tx_id || tx_id.length < 5) throw new Error("Invalid Transaction ID.");
    if (!method) throw new Error("Payment method required.");

    // 2. SECURE DEPOSIT REQUEST (Store pending deposit safely)
    const { data: dbResult, error: rpcError } = await supabase.rpc('request_deposit', {
      user_id_param: user_uuid,
      amount_param: amount,
      payment_method: method,
      tx_id_proof: tx_id
    });

    if (rpcError) throw rpcError;
    
    if (!dbResult.success) {
      return new Response(JSON.stringify({ error: dbResult.error }), { status: 400, headers: corsHeaders });
    }

    // You would typically send a notification to Admin Telegram here
    // fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${ADMIN_ID}&text=New Deposit...`)

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Deposit requested and waiting for Admin approval."
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: corsHeaders });
  }
});
