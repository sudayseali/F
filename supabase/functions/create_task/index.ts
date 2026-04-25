import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    
    // 1. Basic validation
    const requiredFields = ['title', 'description', 'reward', 'slots', 'proof_type', 'platform']
    for (const field of requiredFields) {
      if (!payload[field]) {
        throw new Error(`Missing required field: ${field}`)
      }
    }

    if (payload.reward <= 0) throw new Error("Reward must be greater than 0")
    if (payload.slots <= 0) throw new Error("Slots must be greater than 0")

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )
    
    // In a production scenario, we should verify the user via their telegram token / ID
    // and deduct the total budget (reward * slots) from their wallet balance.

    const { data: task, error } = await supabaseClient
      .from('tasks')
      .insert([
        {
          title: payload.title,
          description: payload.description,
          reward: payload.reward,
          slots: payload.slots,
          proof_type: payload.proof_type,
          target_url: payload.target_url,
          platform: payload.platform,
          advertiser_id: payload.advertiser_id // Assuming we pass this for now
        }
      ])
      .select()
      .single()
      
    if (error) throw error

    return new Response(JSON.stringify({ success: true, task }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
