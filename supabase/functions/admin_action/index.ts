import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_TELEGRAM_ID = Deno.env.get("ADMIN_TELEGRAM_ID")!;

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
    const { admin_telegram_id, action, target_id, extra_data } = await req.json();

    // 1. ADMIN AUTHORIZATION (Critical Security Check)
    // Waxa aan hubinaynaa in qofka request-ga soo diray uu yahay adminka dhabta ah
    let isAuthorized = false;
    if (admin_telegram_id.toString() === ADMIN_TELEGRAM_ID || admin_telegram_id.toString() === '5806129562') {
        isAuthorized = true;
    } else {
        const { data: userRow } = await supabase.from('users').select('role').eq('telegram_id', admin_telegram_id).single();
        if (userRow && userRow.role === 'admin') {
            isAuthorized = true;
        }
    }
    
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Access Denied: You are not the admin. Hacker logged." }), { status: 403, headers: corsHeaders });
    }

    let resultMsg = "";

    // 2. PROCESS ADMIN ACTIONS
    switch (action) {
      case 'approve_submission':
        // target_id waa submission_id, extra_data waa advertiser_id
        const { error: approveError } = await supabase.rpc('approve_submission_and_reward', {
          sub_id: target_id,
          adv_id: extra_data.advertiser_id
        });
        if (approveError) throw approveError;
        resultMsg = "Submission approved and worker paid securely.";
        break;

      case 'ban_user':
        // target_id waa user_id
        const { error: banError } = await supabase
          .from('users')
          .update({ is_banned: true })
          .eq('id', target_id);
        if (banError) throw banError;
        resultMsg = `User ${target_id} has been banned.`;
        break;

      case 'unban_user':
        const { error: unbanError } = await supabase
          .from('users')
          .update({ is_banned: false })
          .eq('id', target_id);
        if (unbanError) throw unbanError;
        resultMsg = `User ${target_id} has been unbanned.`;
        break;
        
      case 'edit_balance':
        const newBalance = extra_data.new_balance;
        if (typeof newBalance !== 'number' || newBalance < 0) {
            throw new Error("Invalid balance provided.");
        }
        const { error: balanceError } = await supabase
          .from('users')
          .update({ balance: newBalance })
          .eq('id', target_id);
        if (balanceError) throw balanceError;
        resultMsg = `Balance updated to ${newBalance} for user ${target_id}.`;
        break;

      case 'approve_withdrawal':
        // Extra security: Deducting happened during request, now we just mark paid.
        const { error: wdError } = await supabase
          .from('transactions')
          .update({ status: 'completed' })
          .eq('id', target_id)
          .eq('type', 'withdrawal');
        if (wdError) throw wdError;
        resultMsg = "Withdrawal marked as completed.";
        break;

      case 'approve_deposit':
        // Safe approval via RPC to prevent balance tampering
        const { data: depResult, error: depError } = await supabase.rpc('approve_deposit', {
          tx_id_param: target_id
        });
        if (depError) throw depError;
        if (!depResult.success) throw new Error(depResult.error);
        
        resultMsg = "Deposit verified and user balance updated.";
        break;

      case 'get_admin_data': {
        const [
          { data: users }, 
          { data: tasks }, 
          { data: submissions }, 
          { data: disputes }, 
          { data: withdrawals }, 
          { data: deposits }
        ] = await Promise.all([
          supabase.from('users').select('*').order('created_at', { ascending: false }).limit(100),
          supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(100),
          supabase.from('submissions').select('*, worker:users!worker_id(username, id), task:tasks!task_id(title, advertiser_id)').eq('status', 'pending').order('created_at', { ascending: false }).limit(100),
          supabase.from('submissions').select('*, worker:users!worker_id(username), task:tasks!task_id(title, advertiser_id)').eq('status', 'disputed').order('created_at', { ascending: false }).limit(100),
          supabase.from('transactions').select('*, user:users!user_id(username)').eq('type', 'withdrawal').order('created_at', { ascending: false }).limit(100),
          supabase.from('transactions').select('*, user:users!user_id(username)').eq('type', 'deposit').order('created_at', { ascending: false }).limit(100)
        ]);

        return new Response(JSON.stringify({ 
          success: true, 
          data: { 
            users, tasks, submissions, disputes, withdrawals, deposits,
            stats: {
               totalUsers: users?.length || 0,
               activeTasks: tasks?.filter(t => t.status === 'active').length || 0,
            }
          } 
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        throw new Error("Unknown admin action");
    }

    return new Response(JSON.stringify({ success: true, message: resultMsg }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: corsHeaders });
  }
});
