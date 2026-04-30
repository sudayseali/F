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
    // We assume the user sends their JWT token or user_id properly authenticated
    const { user_uuid, amount, wallet_address, method } = await req.json();

    // 1. INPUT VALIDATION (Never trust frontend!)
    if (!amount || amount <= 0) throw new Error("Invalid withdrawal amount.");
    if (!wallet_address || wallet_address.length < 5) throw new Error("Invalid wallet address or phone number.");
    
    // 2. CALL SECURE DATABASE RPC
    // By calling an RPC, we execute the 'lock row' logic inside PostgreSQL,
    // making it impossible for a hacker to trigger this 100 times simultaneously 
    // to bypass balance checks.
    const { data: dbResult, error: rpcError } = await supabase.rpc('request_withdrawal', {
      user_id_param: user_uuid,
      amount_param: amount,
      wallet_address: wallet_address,
      crypto_method: method
    });

    if (rpcError) throw rpcError;
    
    if (!dbResult.success) {
      return new Response(JSON.stringify({ error: dbResult.error }), { status: 400, headers: corsHeaders });
    }

    // 3. SEND TO TELEGRAM ADMIN OR LOG TO SLACK
    // Example: fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage...`)

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Withdrawal logged securely.",
      new_balance: dbResult.new_balance 
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: corsHeaders });
  }
});
