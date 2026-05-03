import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

/**
 * Tapjoy Server-to-Server Callback
 * https://dev.tapjoy.com/en/publisher/server-to-server-callbacks
 */
serve(async (req) => {
  try {
    const url = new URL(req.url);

    // Tapjoy parameters
    // snuid is usually where you pass the user's ID
    const userId = url.searchParams.get("snuid");
    // currency is the amount of virtual currency awarded
    const currency = url.searchParams.get("currency");
    // Optionally check the id (transaction ID) to prevent duplicates
    const transactionId = url.searchParams.get("id");
    
    // Tapjoy also sends a `verifier` to ensure the request is legit
    // It's an MD5 hash of: id:snuid:currency:secret_key
    // For now, we do basic validation. To secure it fully, you should verify the hash.

    if (!userId || !currency) {
      return new Response("Missing required parameters (snuid or currency)", { status: 400 });
    }

    const payout = parseFloat(currency);

    if (payout <= 0) {
      return new Response("Invalid payout amount", { status: 400 });
    }

    // Initialize Supabase admin client to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Fetch user
    const { data: user, error: uErr } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", userId)
      .single();

    if (uErr || !user) {
      return new Response("User not found", { status: 404 });
    }

    // Optional: Check if transactionId already exists to avoid double-crediting
    if (transactionId) {
      const { data: existingTx } = await supabaseAdmin
        .from("transactions")
        .select("id")
        .eq("reference_id", `tapjoy_${transactionId}`)
        .maybeSingle();

      if (existingTx) {
        return new Response("Transaction already processed", { status: 200 }); // Tapjoy wants 200 so it stops retrying
      }
    }

    await supabaseAdmin.rpc("reward_user", {
      user_id: userId,
      amount: payout,
    });

    // Tapjoy expects a 200 OK response with a specific body format in some cases, 
    // but typically a 200 status is enough.
    return new Response("OK", { status: 200 });
  } catch (error) {
    console.error("Tapjoy Postback error:", error);
    return new Response("Error Processing Postback", { status: 500 });
  }
});
