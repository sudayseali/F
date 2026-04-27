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
    const { user_uuid, task_id, proof_text, user_ip } = await req.json();

    // 1. INPUT VALIDATION
    if (!user_uuid || !task_id || !proof_text) {
      throw new Error("Missing required parameters.");
    }
    
    // Prevent oversized proofs from crashing the database (DDoS prevention)
    if (proof_text.length > 2000) {
      throw new Error("Proof text is too long (Max 2000 characters).");
    }

    // 2. CALL SECURE DATABASE RPC
    // Tani waxay ka hortagaysaa in user-ku isku mar soo diro 50 submission si uu u buuxiyo boosaska 
    // shaqada intuu "Race Condition" isticmaalayo. Postgres ayaa la tacaalaya lock-ga.
    const { data: dbResult, error: rpcError } = await supabase.rpc('submit_task_proof', {
      user_id_param: user_uuid,
      task_id_param: task_id,
      proof_text: proof_text,
      user_ip: user_ip || 'unknown'
    });

    if (rpcError) throw rpcError;
    
    if (!dbResult.success) {
      return new Response(JSON.stringify({ error: dbResult.error }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: dbResult.message 
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: corsHeaders });
  }
});
