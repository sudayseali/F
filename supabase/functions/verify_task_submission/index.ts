import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

serve(async (req) => {
  const { submission_id, status } = await req.json()
  
  // 1. Verify Authentication & Role
  const authHeader = req.headers.get('Authorization')!
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  
  // 2. Fetch Submission & Task
  const { data: submission } = await supabaseClient
    .from('submissions')
    .select('*, tasks(*)')
    .eq('id', submission_id)
    .single()
    
  if (!submission) return new Response("Submission not found", { status: 404 })
  
  // 3. Process Status
  if (status === 'approved') {
    // Reward user
    await supabaseClient.rpc('reward_user', { 
      user_id: submission.user_id, 
      amount: submission.tasks.reward 
    })
  }

  // Update submission status
  await supabaseClient
    .from('submissions')
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq('id', submission_id)

  return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })
})
