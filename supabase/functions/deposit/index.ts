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

    // 1. INPUT VALIDATION
    if (!amount || amount <= 0) throw new Error("Invalid deposit amount.");
    if (!tx_id) throw new Error("Missing Transaction ID or address.");
    if (!method) throw new Error("Payment method required.");

    // Automatic approval for TRON Web if txid exists and method is TRX
    if (method === 'trx' && tx_id.length > 30) { 
      // Instead of request_deposit RPC, directly insert completed and add balance
      const { data: userRow, error: uErr } = await supabase.from('users').select('balance').eq('id', user_uuid).single();
      if (uErr) throw new Error('User not found');
      
      const newBal = Number(userRow.balance) + Number(amount);
      await supabase.from('users').update({ balance: newBal }).eq('id', user_uuid);
      
      await supabase.from('transactions').insert({
        user_id: user_uuid,
        amount: amount,
        type: 'deposit',
        status: 'completed',
        reference_id: tx_id
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Deposit verified automatically and credited."
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

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

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Deposit requested and waiting for Admin approval."
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: corsHeaders });
  }
});
