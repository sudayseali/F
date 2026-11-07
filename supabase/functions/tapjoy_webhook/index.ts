import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { constantTimeCompare } from "../_shared/telegram-verification.ts";

/**
 * Tapjoy Server-to-Server Callback
 * https://dev.tapjoy.com/en/publisher/server-to-server-callbacks
 */
serve(async (req) => {
  try {
    const url = new URL(req.url);

    const userId = url.searchParams.get("snuid");
    const currency = url.searchParams.get("currency");
    const transactionId = url.searchParams.get("id");
    const verifier = url.searchParams.get("verifier");
    const tapjoySecret = Deno.env.get("TAPJOY_SECRET_KEY") || Deno.env.get("TAPJOY_SECRET");

    if (!userId || !currency) {
      return new Response("Missing required parameters (snuid or currency)", { status: 400 });
    }

    // Security Verification: Tapjoy MD5 hash of id:snuid:currency:secret_key
    if (tapjoySecret) {
      if (!verifier) {
        return new Response("403 Forbidden - Missing required verifier signature", { status: 403 });
      }

      const rawString = `${transactionId || ""}:${userId}:${currency}:${tapjoySecret}`;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("MD5", encoder.encode(rawString)).catch(() => null);
      
      if (hashBuffer) {
        const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        if (!constantTimeCompare(verifier.toLowerCase(), hashHex.toLowerCase())) {
          return new Response("403 Forbidden - Invalid Tapjoy Verifier Signature", { status: 403 });
        }
      }
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

    // Fetch user (support UUID or Telegram ID)
    let targetUserId = userId;
    if (/^\d+$/.test(userId)) {
      const { data: userByTg } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("telegram_id", parseInt(userId, 10))
        .maybeSingle();
      if (userByTg) targetUserId = userByTg.id;
    }

    const { data: user, error: uErr } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", targetUserId)
      .maybeSingle();

    if (uErr || !user) {
      return new Response("User not found", { status: 404 });
    }

    const idempotencyKey = transactionId ? `tapjoy_${transactionId}` : `tapjoy_${Date.now()}`;

    // Atomic credit with duplicate defense
    const { error: creditError } = await supabaseAdmin.rpc("atomic_wallet_credit", {
      p_user_id: user.id,
      p_amount: payout,
      p_type: "offer_reward",
      p_idempotency_key: idempotencyKey,
      p_reference_id: transactionId,
      p_description: `Tapjoy Offer Reward (Tx: ${transactionId || "direct"})`
    });

    if (creditError) throw creditError;

    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Tapjoy Postback error:", error);
    return new Response("Error Processing Postback", { status: 500 });
  }
});
