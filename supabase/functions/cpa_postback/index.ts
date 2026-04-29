import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);

    // Example: GET /cpa_postback?subid=USER_UUID&payout=1.50&network=mylead
    const userId =
      url.searchParams.get("subid") || url.searchParams.get("aff_sub");
    let payout = parseFloat(url.searchParams.get("payout") || "0");

    if (!userId) {
      return new Response("Missing SubID", { status: 400 });
    }

    // Initialize Supabase admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (payout > 0) {
      // Fetch current user
      const { data: user, error: uErr } = await supabaseAdmin
        .from("users")
        .select("balance")
        .eq("id", userId)
        .single();
      if (uErr || !user) throw new Error("User not found");

      const newBal = Number(user.balance) + payout;

      // Credit user
      await supabaseAdmin
        .from("users")
        .update({ balance: newBal })
        .eq("id", userId);

      // Record transaction
      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        amount: payout,
        type: "reward",
        status: "completed",
        reference_id: `cpa_${Date.now()}`,
      });
    }

    return new Response("Postback Success", { status: 200 });
  } catch (error) {
    console.error("Postback error:", error);
    return new Response("Error Processing Postback", { status: 500 });
  }
});
