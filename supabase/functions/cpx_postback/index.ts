import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);

    const status = url.searchParams.get("status");
    const transId = url.searchParams.get("trans_id");
    const userId = url.searchParams.get("user_id") || url.searchParams.get("sub_id");
    const amountLocal = parseFloat(url.searchParams.get("amount_local") || "0");
    const secureHash = url.searchParams.get("hash");

    if (!userId) {
      return new Response("Missing User ID", { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Only reward for complete status (usually 1 for CPX)
    if (status === "1" && amountLocal > 0) {
      const { data: user, error: uErr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();
      if (uErr || !user) throw new Error("User not found");

      await supabaseAdmin.rpc("reward_user", {
        user_id: userId,
        amount: amountLocal,
      });

      // To prevent duplicate credits, record the transaction ID in the transactions table
      if (transId) {
        await supabaseAdmin.from("transactions").insert({
          user_id: userId,
          amount: 0,
          type: "postback_reference",
          status: "completed",
          reference_id: `cpx_${transId}`,
        });
      }
    }

    return new Response("CPX Postback Success", { status: 200 });
  } catch (error) {
    console.error("CPX Postback error:", error);
    return new Response("Error Processing CPX Postback", { status: 500 });
  }
});
