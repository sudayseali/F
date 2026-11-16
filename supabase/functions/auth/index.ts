// supabase/functions/auth/index.ts
// Secure Telegram WebApp Authentication, Referral Attribution, Channel Gate & Session Edge Function

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";
import { handleCors } from "../_shared/cors.ts";
import { verifyTelegramInitData } from "../_shared/telegram-verification.ts";
import { checkTelegramChannelMembership } from "../_shared/channel-check.ts";
import { checkDistributedRateLimit, getClientIp } from "../_shared/rate-limit.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { logAuditEvent } from "../_shared/audit-log.ts";
import { sendUserAlert } from "../_shared/alerts.ts";

function isMissingColumnError(err: any, columnName?: string): boolean {
  if (!err || typeof err !== "object") return false;
  const code = String(err.code || "");
  const msg = String(err.message || "");
  if (code === "42703" || code === "PGRST204") {
    return columnName ? msg.toLowerCase().includes(columnName.toLowerCase()) : true;
  }
  return columnName
    ? new RegExp(`column .*${columnName}.* does not exist|could not find the '${columnName}' column`, "i").test(msg)
    : /column .* does not exist|could not find the '.*' column/i.test(msg);
}

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

  const clientIp = getClientIp(req);

  try {
    if (req.method !== "POST") {
      throw new AppError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Distributed Rate Limiting: 20 auth attempts per minute per IP
    const rate = await checkDistributedRateLimit(supabaseAdmin, `auth_ip_${clientIp}`, 20, 60);
    if (!rate.allowed) {
      throw new AppError("Too many authentication attempts. Please try again later.", 429, "RATE_LIMIT_EXCEEDED");
    }

    const BOT_TOKEN = (Deno.env.get("TELEGRAM_BOT_TOKEN") || "").trim().replace(/^["']|["']$/g, '').trim();
    const JWT_SECRET = (Deno.env.get("JWT_SECRET") || Deno.env.get("SUPABASE_JWT_SECRET") || Deno.env.get("CUSTOM_JWT_SECRET") || "").trim().replace(/^["']|["']$/g, '').trim();

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

    // 2. Lookup existing user by telegram_id (resilient if channel_joined migration is pending)
    let hasChannelJoinedCol = true;
    let existingUser: any = null;

    const lookupRes = await supabaseAdmin
      .from("users")
      .select("id, status, channel_joined, wallet_balance, total_earned, total_withdrawn")
      .eq("telegram_id", tgUser.id)
      .maybeSingle();

    if (lookupRes.error) {
      if (isMissingColumnError(lookupRes.error)) {
        hasChannelJoinedCol = !isMissingColumnError(lookupRes.error, "channel_joined");
        const fallbackLookup = await supabaseAdmin
          .from("users")
          .select("id, status, wallet_balance")
          .eq("telegram_id", tgUser.id)
          .maybeSingle();

        if (fallbackLookup.error) {
          // Last-resort minimal schema lookup
          const minimalLookup = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("telegram_id", tgUser.id)
            .maybeSingle();
          if (minimalLookup.error) throw minimalLookup.error;
          existingUser = minimalLookup.data;
        } else {
          existingUser = fallbackLookup.data;
        }
      } else {
        throw lookupRes.error;
      }
    } else {
      existingUser = lookupRes.data;
    }

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

    // 3. Upsert User Profile securely via Server Admin Client (resilient across schema versions)
    const upsertPayload: Record<string, unknown> = {
      telegram_id: tgUser.id,
      username: tgUser.username ?? null,
      first_name: tgUser.first_name ?? "Telegram User",
      last_name: tgUser.last_name ?? null,
      last_active_at: new Date().toISOString(),
    };

    const selectCols = hasChannelJoinedCol
      ? "id, telegram_id, username, first_name, last_name, wallet_balance, total_earned, total_withdrawn, status, channel_joined, created_at"
      : "id, telegram_id, username, first_name, last_name, wallet_balance, total_earned, total_withdrawn, status, created_at";

    let userRow: any = null;
    const upsertRes = await supabaseAdmin
      .from("users")
      .upsert(upsertPayload, { onConflict: "telegram_id" })
      .select(selectCols)
      .single();

    if (upsertRes.error || !upsertRes.data) {
      if (upsertRes.error && isMissingColumnError(upsertRes.error)) {
        hasChannelJoinedCol = false;
        const { last_active_at: _omit, ...baseUpsertPayload } = upsertPayload;

        let fallbackUpsert = await supabaseAdmin
          .from("users")
          .upsert(
            isMissingColumnError(upsertRes.error, "last_active_at") ? baseUpsertPayload : upsertPayload,
            { onConflict: "telegram_id" }
          )
          .select("id, telegram_id, username, first_name, last_name")
          .single();

        if (fallbackUpsert.error && isMissingColumnError(fallbackUpsert.error, "last_active_at")) {
          fallbackUpsert = await supabaseAdmin
            .from("users")
            .upsert(baseUpsertPayload, { onConflict: "telegram_id" })
            .select("id, telegram_id, username, first_name, last_name")
            .single();
        }

        if (fallbackUpsert.error || !fallbackUpsert.data) {
          throw fallbackUpsert.error || new Error("Failed to persist user profile");
        }
        userRow = {
          ...fallbackUpsert.data,
          wallet_balance: existingUser?.wallet_balance ?? 0,
          total_earned: existingUser?.total_earned ?? 0,
          total_withdrawn: existingUser?.total_withdrawn ?? 0,
          status: existingUser?.status ?? "active",
          channel_joined: false,
        };
      } else {
        throw upsertRes.error || new Error("Failed to persist user profile");
      }
    } else {
      userRow = upsertRes.data;
    }

    // 4. Handle Referrals for New Users (recorded immediately so attribution is never lost)
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
            const { error: refInsertErr } = await supabaseAdmin.from("referrals").insert({
              referrer_id: referrer.id,
              referred_user_id: userRow.id,
            });
            if (!refInsertErr) {
              await logAuditEvent({
                actorId: userRow.id,
                actorType: "user",
                action: "referral_registered",
                targetType: "user",
                targetId: referrer.id,
                details: { referrerTelegramId: referrerTgId },
                ipAddress: clientIp,
              });

              const inviteeLabel = tgUser.username
                ? `@${tgUser.username}`
                : tgUser.first_name || "A new friend";

              await sendUserAlert(supabaseAdmin, {
                userId: referrer.id,
                category: "referral",
                eventKey: "referral_joined",
                title: "New Referral Joined!",
                message: `${inviteeLabel} joined Payvora using your link. You earn 10% lifetime commission on their tasks & offers.`,
                actionUrl: "/referrals",
                ctaLabel: "🤝 View Referrals",
                metadata: { referred_user_id: userRow.id, referred_telegram_id: tgUser.id },
              });
            }
          }
        }
      } catch (refErr) {
        console.error("[REFERRAL_PROCESSING_ERROR]", refErr);
      }
    }

    // 5. Mandatory Official Channel Membership Verification for New / Unverified Users
    const alreadyVerifiedInDb = hasChannelJoinedCol ? Boolean(userRow.channel_joined) : !isNewUser;
    if (!alreadyVerifiedInDb) {
      const membership = await checkTelegramChannelMembership(BOT_TOKEN, tgUser.id);

      if (membership.ok && membership.isMember) {
        if (hasChannelJoinedCol) {
          await supabaseAdmin
            .from("users")
            .update({
              channel_joined: true,
              channel_verified_at: new Date().toISOString(),
            })
            .eq("id", userRow.id);
        }

        await logAuditEvent({
          actorId: userRow.id,
          actorType: "user",
          action: "channel_membership_verified",
          targetType: "channel",
          targetId: membership.channelUsername,
          details: { status: membership.status },
          ipAddress: clientIp,
        });
      } else {
        await logAuditEvent({
          actorId: userRow.id,
          actorType: "user",
          action: "channel_membership_required",
          targetType: "channel",
          targetId: membership.channelUsername,
          details: { status: membership.status || membership.errorCode },
          ipAddress: clientIp,
        });

        // Do NOT mint JWT until channel join is verified server-side
        return successResponse({
          requires_channel_join: true,
          channel_url: membership.channelUrl,
          channel_username: membership.channelUsername,
          verification_error: membership.errorMessage || null,
          member_status: membership.status || null,
          user_uuid: userRow.id,
        }, 200, req);
      }
    }

    // 6. Issue Cryptographically Signed User JWT
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
      .setExpirationTime("4h")
      .sign(secret);

    // 7. Return Verified Session and Profile
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
        status: userRow.status,
        channel_joined: true,
      }
    }, 200, req);

  } catch (err) {
    return errorResponse(err, req);
  }
});
