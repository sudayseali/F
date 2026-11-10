// supabase/functions/auth/index.ts
// Secure Telegram WebApp Authentication & Session Edge Function

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { verifyTelegramInitData } from "../_shared/telegram-verification.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { logAuditEvent } from "../_shared/audit-log.ts";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceKey) {
    throw new AppError("Server configuration missing: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.", 500, "CONFIG_ERROR");
  }
  return createClient(url, serviceKey);
}

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  // Rate Limiting: 20 auth attempts per minute per IP
  const rate = checkRateLimit(`auth_${clientIp}`, 20, 60000);
  if (!rate.allowed) {
    return errorResponse(new AppError("Too many authentication attempts. Please try again later.", 429, "RATE_LIMIT_EXCEEDED"), req);
  }

  try {
    if (req.method !== "POST") {
      throw new AppError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const BOT_TOKEN = (Deno.env.get("TELEGRAM_BOT_TOKEN") || "").trim().replace(/^["']|["']$/g, '').trim();
    const JWT_SECRET = Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET") || Deno.env.get("CUSTOM_JWT_SECRET");

    const body = await req.json().catch(() => ({}));
    const { initData, start_param } = body;

    if (!initData) {
      throw new AppError("Missing required Telegram initData parameter.", 400, "MISSING_INIT_DATA");
    }

    if (!BOT_TOKEN) {
      throw new AppError("Server configuration error: TELEGRAM_BOT_TOKEN is not set.", 500, "CONFIG_ERROR");
    }

    if (!JWT_SECRET) {
      throw new AppError("Server configuration error: JWT_SECRET is not set.", 500, "CONFIG_ERROR");
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 1. Cryptographic HMAC-SHA256 Verification with Clock Tolerance & Replay Check
    const verification = await verifyTelegramInitData(initData, BOT_TOKEN);
    if (!verification.valid || !verification.user) {
      await logAuditEvent({
        actorType: "system",
        action: "auth_failed_invalid_signature",
        details: { error: verification.error, errorCode: verification.errorCode, clientIp },
        ipAddress: clientIp,
      });
      throw new AppError(
        verification.error || "Unauthorized: Cryptographic signature verification failed.",
        401,
        verification.errorCode || "INVALID_SIGNATURE"
      );
    }

    const tgUser = verification.user;

    // 2. Lookup existing user by telegram_id
    const { data: existingUser, error: lookupErr } = await supabaseAdmin
      .from("users")
      .select("id, status, wallet_balance, total_earned, total_withdrawn")
      .eq("telegram_id", tgUser.id)
      .maybeSingle();

    if (lookupErr) throw lookupErr;

    const isNewUser = !existingUser;

    // Check account status if existing
    if (existingUser && existingUser.status === "suspended") {
      await logAuditEvent({
        actorId: existingUser.id,
        actorType: "user",
        action: "auth_attempt_suspended_user",
        details: { telegram_id: tgUser.id },
        ipAddress: clientIp,
      });
      throw new AppError("This account has been suspended. Please contact support.", 403, "ACCOUNT_SUSPENDED");
    }

    // 3. Upsert User Profile securely via Server Admin Client
    const { data: userRow, error: upsertErr } = await supabaseAdmin
      .from("users")
      .upsert({
        telegram_id: tgUser.id,
        username: tgUser.username,
        first_name: tgUser.first_name,
        last_name: tgUser.last_name,
        last_active_at: new Date().toISOString()
      }, { onConflict: "telegram_id" })
      .select("id, telegram_id, username, first_name, last_name, wallet_balance, total_earned, total_withdrawn, status, created_at")
      .single();

    if (upsertErr || !userRow) throw upsertErr || new Error("Failed to persist user profile");

    // 4. Handle Referrals for New Users
    if (isNewUser && start_param) {
      try {
        const referrerTgId = parseInt(String(start_param).replace(/^ref_/, ""), 10);
        if (!isNaN(referrerTgId) && referrerTgId !== tgUser.id) {
          const { data: referrer } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("telegram_id", referrerTgId)
            .maybeSingle();

          if (referrer) {
            await supabaseAdmin.from("referrals").insert({
              referrer_id: referrer.id,
              referred_user_id: userRow.id,
            });
            await logAuditEvent({
              actorId: userRow.id,
              actorType: "user",
              action: "referral_registered",
              targetType: "user",
              targetId: referrer.id,
              details: { referrerTelegramId: referrerTgId },
              ipAddress: clientIp,
            });
          }
        }
      } catch (refErr) {
        console.error("[REFERRAL_PROCESSING_ERROR]", refErr);
      }
    }

    // 5. Issue Cryptographically Signed User JWT
    const secret = new TextEncoder().encode(JWT_SECRET);
    const jwt = await new jose.SignJWT({
      aud: "authenticated",
      role: "authenticated",
      sub: userRow.id,
      email: `${tgUser.id}@telegram.local`,
      app_metadata: { provider: "telegram" },
      user_metadata: { tg_id: tgUser.id, username: tgUser.username }
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("24h")
      .sign(secret);

    // 6. Return Verified Session and Profile
    return successResponse({
      access_token: jwt,
      user_uuid: userRow.id,
      user: {
        id: userRow.id,
        telegram_id: userRow.telegram_id,
        username: userRow.username,
        first_name: userRow.first_name,
        last_name: userRow.last_name,
        wallet_balance: Number(userRow.wallet_balance || 0),
        total_earned: Number(userRow.total_earned || 0),
        total_withdrawn: Number(userRow.total_withdrawn || 0),
        status: userRow.status
      }
    }, 200, req);

  } catch (err) {
    return errorResponse(err, req);
  }
});
