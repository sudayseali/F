import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const url = new URL(req.url);

    // CPX Research usually sends: subid=?, payout=?
    // Adjust these based on actual CPX documentation
    const userId = url.searchParams.get("subid");
    let payout = parseFloat(url.searchParams.get("payout") || "0");

    if (!userId) {
      return new Response("Missing SubID (User ID)", { status: 400 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (payout > 0) {
      const { data: user, error: uErr } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("id", userId)
        .single();
      if (uErr || !user) throw new Error("User not found");

      await supabaseAdmin.rpc("reward_user", {
        user_id: userId,
        amount: payout,
      });
    }

    return new Response("CPX Postback Success", { status: 200 });
  } catch (error) {
    console.error("CPX Postback error:", error);
    return new Response("Error Processing CPX Postback", { status: 500 });
  }
});
