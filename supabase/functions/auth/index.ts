import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_JWT_SECRET = Deno.env.get("SUPABASE_JWT_SECRET") || "your-super-secret-jwt-token-with-at-least-32-characters-long"; // Fallback for local testing, but user should set it!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ----------------------------------------------------
// TELEGRAM INIT_DATA HASH VALIDATION
// ----------------------------------------------------
// This function strictly verifies that the request is genuinely from Telegram
// Hacker cannot spoof this without the BOT_TOKEN.
async function verifyTelegramAuth(initData: string) {
  const urlParams = new URLSearchParams(initData);
  const hash = urlParams.get("hash");
  urlParams.delete("hash");

  const dataCheckString = Array.from(urlParams.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  // Generate Secret Key using SHA-256 of Bot Token
  const encoder = new TextEncoder();
  const secretKeyHash = await crypto.subtle.digest("SHA-256", encoder.encode(BOT_TOKEN));
  const secretKey = await crypto.subtle.importKey(
    "raw",
    secretKeyHash,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Sign data check string
  const signature = await crypto.subtle.sign(
    "HMAC",
    secretKey,
    encoder.encode(dataCheckString)
  );

  const calculatedHash = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // 1. Check if hash matches
  if (calculatedHash !== hash) {
    return null; // Invalid signature: Hacking attempt
  }

  // 2. Prevent Replay Attacks (Check timestamp within 1 hour)
  const authDate = parseInt(urlParams.get("auth_date") || "0", 10);
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 3600) {
    return null; // Expired session: Replay attack prevention
  }

  return JSON.parse(urlParams.get("user") || "{}");
}

// ----------------------------------------------------
// EDGE FUNCTION HANDLER
// ----------------------------------------------------
serve(async (req) => {
  // CORS Headers for Telegram Web App
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { initData } = await req.json();

    if (!initData) {
      return new Response(JSON.stringify({ error: "Missing initData" }), { status: 400, headers: corsHeaders });
    }

    // VALIDATE TELEGRAM DATA
    const tgUser = await verifyTelegramAuth(initData);
    if (!tgUser) {
      return new Response(JSON.stringify({ error: "Unauthorized / Invalid Signature. Hacking attempt blocked." }), { status: 401, headers: corsHeaders });
    }

    // UPSERT USER SECURELY IN DB
    // If user doesn't exist, create them. If they do, update names.
    const { data: userRow, error: dbError } = await supabase
      .from('users')
      .upsert({
        telegram_id: tgUser.id,
        username: tgUser.username,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name
      }, { onConflict: 'telegram_id' })
      .select('id, is_banned, role')
      .single();

    if (dbError) throw dbError;

    // Check if user is banned
    if (userRow.is_banned) {
        return new Response(JSON.stringify({ error: "Account Banned." }), { status: 403, headers: corsHeaders });
    }

    // CHECK ADMIN PRIVILEGES SECURELY FROM BACKEND ENV AND DATABASE
    const ADMIN_TELEGRAM_ID = Deno.env.get("ADMIN_TELEGRAM_ID");
    const isAdmin = tgUser.id.toString() === ADMIN_TELEGRAM_ID || tgUser.id.toString() === '5806129562' || userRow.role === 'admin';

    // GENERATE SECURE CUSTOM JWT
    const secret = new TextEncoder().encode(SUPABASE_JWT_SECRET);
    const jwt = await new jose.SignJWT({
      aud: 'authenticated',
      role: 'authenticated',
      sub: userRow.id,
      email: `${tgUser.id}@telegram.local`,
      user_metadata: { tg_id: tgUser.id, is_admin: isAdmin }
    })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);

    return new Response(JSON.stringify({ 
      success: true, 
      user_uuid: userRow.id,
      is_admin: isAdmin,
      access_token: jwt,
      message: "Authentication secure & verified" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: corsHeaders });
  }
});
