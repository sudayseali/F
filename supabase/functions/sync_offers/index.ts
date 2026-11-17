// supabase/functions/sync_offers/index.ts
// Provider Catalog Synchronization Runner (Admin Authorized or Scheduled Cron Secret)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { verifyAdminRequest } from "../_shared/admin-auth.ts";
import { constantTimeCompare } from "../_shared/telegram-verification.ts";
import { logAuditEvent } from "../_shared/audit-log.ts";
import { getClientIp } from "../_shared/rate-limit.ts";
import { syncAllEnabledProviders, syncProviderOffers } from "../_shared/offers/sync-engine.ts";

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

  try {
    if (req.method !== "POST") {
      throw new AppError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const clientIp = getClientIp(req);
    const cronHeader = (req.headers.get("x-sync-secret") || "").trim();
    const cronSecret = (Deno.env.get("SYNC_CRON_SECRET") || "").trim();

    let authorizedAs: "cron" | "admin" | null = null;
    let adminId: string | undefined;

    if (cronHeader && cronSecret && constantTimeCompare(cronHeader, cronSecret)) {
      authorizedAs = "cron";
    } else {
      const admin = await verifyAdminRequest(req, "manage_settings");
      authorizedAs = "admin";
      adminId = admin.id;
    }

    const supabaseAdmin = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));
    const providerKey = typeof body.providerKey === "string" ? body.providerKey.trim().toLowerCase() : "";
    const country = typeof body.country === "string" ? body.country.trim().toUpperCase() : undefined;

    const results = providerKey
      ? [await syncProviderOffers(supabaseAdmin, providerKey, { country, forceEvenIfSyncDisabled: authorizedAs === "admin" })]
      : await syncAllEnabledProviders(supabaseAdmin);

    if (authorizedAs === "admin" && adminId) {
      await logAuditEvent({
        actorId: adminId,
        actorType: "admin",
        action: "offers_sync_triggered",
        targetType: "offer_provider",
        targetId: providerKey || "all_enabled",
        details: { results },
        ipAddress: clientIp,
      });
    }

    return successResponse({ triggeredBy: authorizedAs, results }, 200, req);
  } catch (err) {
    return errorResponse(err, req);
  }
});
