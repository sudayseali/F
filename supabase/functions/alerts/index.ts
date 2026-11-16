// supabase/functions/alerts/index.ts
// Authenticated user alerts inbox & notification preference endpoint

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { verifyUserRequest } from "../_shared/auth.ts";
import { isValidUuid } from "../_shared/validation.ts";
import { DEFAULT_ALERT_PREFS, normalizeAlertPrefs } from "../_shared/alerts.ts";
import { checkDistributedRateLimit, getClientIp } from "../_shared/rate-limit.ts";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) {
    throw new AppError("Server configuration missing database credentials", 500, "CONFIG_ERROR");
  }
  return createClient(url, key);
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
    const ipRate = await checkDistributedRateLimit(supabaseAdmin, `alerts_ip_${clientIp}`, 60, 60);
    if (!ipRate.allowed) {
      throw new AppError("Too many requests. Please wait a moment.", 429, "RATE_LIMIT_EXCEEDED");
    }

    const user = await verifyUserRequest(req);
    const userRate = await checkDistributedRateLimit(supabaseAdmin, `alerts_usr_${user.id}`, 30, 60);
    if (!userRate.allowed) {
      throw new AppError("Too many alert requests. Please wait a moment.", 429, "RATE_LIMIT_EXCEEDED");
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    if (action === "list") {
      const category = body.category;
      let query = supabaseAdmin
        .from("user_notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(40);

      if (category && ["referral", "task", "offer", "system"].includes(category)) {
        query = query.eq("category", category);
      }

      const [notifRes, unreadRes, userRes] = await Promise.all([
        query,
        supabaseAdmin
          .from("user_notifications")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("is_read", false),
        supabaseAdmin
          .from("users")
          .select("alert_prefs")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

      // Graceful fallback if migration not yet applied
      const tableMissing =
        notifRes.error &&
        (notifRes.error.code === "42P01" ||
          String(notifRes.error.message || "").includes("does not exist"));

      if (tableMissing) {
        return successResponse(
          {
            notifications: [],
            unreadCount: 0,
            prefs: DEFAULT_ALERT_PREFS,
            migrationPending: true,
          },
          200,
          req
        );
      }

      if (notifRes.error) throw notifRes.error;

      return successResponse(
        {
          notifications: notifRes.data || [],
          unreadCount: unreadRes.count || 0,
          prefs: normalizeAlertPrefs(userRes.data?.alert_prefs),
        },
        200,
        req
      );
    }

    if (action === "mark_read") {
      const notificationId = body.notification_id;
      const nowIso = new Date().toISOString();

      if (notificationId) {
        if (!isValidUuid(notificationId)) {
          throw new AppError("Invalid notification ID.", 400, "INVALID_NOTIFICATION_ID");
        }
        const { error } = await supabaseAdmin
          .from("user_notifications")
          .update({ is_read: true, read_at: nowIso })
          .eq("id", notificationId)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabaseAdmin
          .from("user_notifications")
          .update({ is_read: true, read_at: nowIso })
          .eq("user_id", user.id)
          .eq("is_read", false);

        if (error) throw error;
      }

      return successResponse({ updated: true }, 200, req);
    }

    if (action === "update_prefs") {
      const incoming = body.prefs || {};
      const { data: currentRow } = await supabaseAdmin
        .from("users")
        .select("alert_prefs")
        .eq("id", user.id)
        .maybeSingle();

      const current = normalizeAlertPrefs(currentRow?.alert_prefs);
      const nextPrefs = {
        referral: typeof incoming.referral === "boolean" ? incoming.referral : current.referral,
        task: typeof incoming.task === "boolean" ? incoming.task : current.task,
        offer: typeof incoming.offer === "boolean" ? incoming.offer : current.offer,
        telegram_push:
          typeof incoming.telegram_push === "boolean"
            ? incoming.telegram_push
            : current.telegram_push,
      };

      const { error } = await supabaseAdmin
        .from("users")
        .update({ alert_prefs: nextPrefs })
        .eq("id", user.id);

      if (error) throw error;

      return successResponse({ prefs: nextPrefs }, 200, req);
    }

    throw new AppError(`Unknown alerts action: '${action}'`, 400, "UNKNOWN_ACTION");
  } catch (err) {
    return errorResponse(err, req);
  }
});
