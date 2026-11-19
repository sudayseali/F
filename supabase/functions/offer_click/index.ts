// supabase/functions/offer_click/index.ts
// Authenticated Opaque Click Attribution & Signed Partner Wall Launcher

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { verifyUserRequest } from "../_shared/auth.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { checkDistributedRateLimit, getClientIp } from "../_shared/rate-limit.ts";
import { isValidUuid } from "../_shared/validation.ts";
import { sha256Hex } from "../_shared/crypto.ts";
import { enforceVpnPolicy } from "../_shared/vpn-check.ts";
import {
  buildHostedWallLaunchUrl,
  getProviderAdapter,
} from "../_shared/providers/registry.ts";
import type { DeviceType } from "../_shared/providers/types.ts";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) {
    throw new AppError("Server configuration missing database credentials", 500, "CONFIG_ERROR");
  }
  return createClient(url, key);
}

function detectDevice(req: Request, requestedDevice?: string): DeviceType {
  if (requestedDevice && ["android", "ios", "desktop", "all"].includes(requestedDevice.toLowerCase())) {
    return requestedDevice.toLowerCase() as DeviceType;
  }
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad")) return "ios";
  if (ua.includes("windows") || ua.includes("macintosh")) return "desktop";
  return "all";
}

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "POST") {
      throw new AppError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const supabaseAdmin = getSupabaseAdmin();
    const clientIp = getClientIp(req);

    const verifiedUser = await verifyUserRequest(req);

    const rate = await checkDistributedRateLimit(
      supabaseAdmin,
      `offer_click_${verifiedUser.id}`,
      30,
      60
    );
    if (!rate.allowed) {
      throw new AppError("Too many offer launches. Please wait a minute.", 429, "RATE_LIMIT_EXCEEDED");
    }

    // Multi-layer VPN / Proxy / Tor / Datacenter Block
    const vpnCheck = await enforceVpnPolicy(supabaseAdmin, req, clientIp, "offer_click", verifiedUser.id);

    const body = await req.json().catch(() => ({}));
    const offerId = body.offerId ? String(body.offerId).trim() : null;
    const providerKey = body.providerKey ? String(body.providerKey).toLowerCase().trim() : null;
    const headerCountry = (req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "").trim().toUpperCase();
    const ipIntelCountry = (vpnCheck.countryCode || "").trim().toUpperCase();
    const bodyCountry = typeof body.country === "string" ? body.country.trim().toUpperCase() : "";
    const country = /^[A-Z]{2}$/.test(headerCountry)
      ? headerCountry
      : /^[A-Z]{2}$/.test(ipIntelCountry)
      ? ipIntelCountry
      : /^[A-Z]{2}$/.test(bodyCountry)
      ? bodyCountry
      : undefined;
    const device = detectDevice(req, typeof body.device === "string" ? body.device : undefined);

    // ========================================================================
    // MODE A: LAUNCH INDIVIDUAL CATALOG OFFER WITH OPAQUE CLICK ATTRIBUTION
    // ========================================================================
    if (offerId) {
      if (!isValidUuid(offerId)) {
        throw new AppError("Valid offerId is required.", 400, "INVALID_OFFER_ID");
      }

      const { data: offerRow, error: offerErr } = await supabaseAdmin
        .from("offers")
        .select("*")
        .eq("id", offerId)
        .maybeSingle();

      if (offerErr || !offerRow) {
        throw new AppError("Offer not found.", 404, "OFFER_NOT_FOUND");
      }

      if (!offerRow.is_active) {
        throw new AppError("This offer is no longer active.", 400, "OFFER_INACTIVE");
      }

      const nowMs = Date.now();
      if (offerRow.starts_at && new Date(offerRow.starts_at).getTime() > nowMs) {
        throw new AppError("This offer campaign has not started yet.", 400, "OFFER_NOT_STARTED");
      }
      if (offerRow.expires_at && new Date(offerRow.expires_at).getTime() <= nowMs) {
        throw new AppError("This offer has expired.", 400, "OFFER_EXPIRED");
      }

      if (country) {
        if (Array.isArray(offerRow.excluded_countries) && offerRow.excluded_countries.includes(country)) {
          throw new AppError(`Offer is not available in ${country}.`, 400, "OFFER_INELIGIBLE_COUNTRY");
        }
        if (
          Array.isArray(offerRow.countries) &&
          offerRow.countries.length > 0 &&
          !offerRow.countries.includes(country)
        ) {
          throw new AppError(`Offer is only available in ${offerRow.countries.join(", ")}.`, 400, "OFFER_INELIGIBLE_COUNTRY");
        }
      }

      const allowedDevices = Array.isArray(offerRow.device_types) && offerRow.device_types.length > 0
        ? offerRow.device_types
        : ["all"];
      if (device !== "all" && !allowedDevices.includes("all") && !allowedDevices.includes(device)) {
        throw new AppError(`This offer requires ${allowedDevices.join(" or ").toUpperCase()}.`, 400, "OFFER_INELIGIBLE_DEVICE");
      }

      const { data: provRow } = await supabaseAdmin
        .from("offer_providers")
        .select("id, provider_key, display_name, status")
        .eq("id", offerRow.provider_id)
        .single();

      if (!provRow || provRow.status !== "active") {
        throw new AppError("This offer provider is currently paused.", 400, "PROVIDER_INACTIVE");
      }

      const { data: existingProg } = await supabaseAdmin
        .from("offer_user_status")
        .select("progress_status")
        .eq("user_id", verifiedUser.id)
        .eq("offer_id", offerRow.id)
        .maybeSingle();

      if (offerRow.new_user_only && existingProg?.progress_status === "completed") {
        throw new AppError("You have already completed and received credit for this offer.", 409, "ALREADY_COMPLETED");
      }

      const adapter = getProviderAdapter(provRow.provider_key);
      if (!adapter) {
        throw new AppError("Provider adapter unavailable.", 500, "ADAPTER_MISSING");
      }

      // Generate opaque attribution token (never leaks user UUID directly in query string)
      const opaqueClickId = `pv_${crypto.randomUUID().replace(/-/g, "")}`;
      const trackingTokenHash = await sha256Hex(`${opaqueClickId}:${verifiedUser.id}:${offerRow.id}`);
      const ipHash = await sha256Hex(clientIp || "unknown");

      const clickBuild = adapter.validateClick(
        {
          id: offerRow.id,
          external_offer_id: offerRow.external_offer_id,
          destination_url: offerRow.destination_url,
          countries: offerRow.countries || [],
          excluded_countries: offerRow.excluded_countries || [],
          device_types: offerRow.device_types || ["all"],
          expires_at: offerRow.expires_at,
          is_active: offerRow.is_active,
        },
        { id: verifiedUser.id, country, device },
        opaqueClickId
      );

      if (!clickBuild.valid || !clickBuild.trackingUrl) {
        throw new AppError(clickBuild.reason || "Offer redirect URL blocked by security policy.", 400, "INVALID_DESTINATION");
      }

      const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
      const { data: clickRow, error: clickErr } = await supabaseAdmin
        .from("offer_clicks")
        .insert({
          user_id: verifiedUser.id,
          offer_id: offerRow.id,
          provider_id: provRow.id,
          opaque_click_id: opaqueClickId,
          tracking_token_hash: trackingTokenHash,
          status: "clicked",
          user_country: country || null,
          user_device: device,
          ip_hash: ipHash,
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (clickErr) throw clickErr;

      // Record "started" progress without downgrading existing completed/pending records
      if (!existingProg) {
        await supabaseAdmin.from("offer_user_status").insert({
          user_id: verifiedUser.id,
          offer_id: offerRow.id,
          click_id: clickRow.id,
          progress_status: "started",
          status_note: `Launched via ${provRow.display_name}`,
        });
      } else if (existingProg.progress_status === "started" || existingProg.progress_status === "failed") {
        await supabaseAdmin
          .from("offer_user_status")
          .update({
            click_id: clickRow.id,
            progress_status: "started",
            last_updated_at: new Date().toISOString(),
          })
          .eq("user_id", verifiedUser.id)
          .eq("offer_id", offerRow.id);
      }

      return successResponse(
        {
          mode: "offer",
          trackingUrl: clickBuild.trackingUrl,
          opaqueClickId,
          clickId: clickRow.id,
          expiresAt,
          providerName: provRow.display_name,
        },
        200,
        req
      );
    }

    // ========================================================================
    // MODE B: LAUNCH HOSTED PARTNER WALL WITH SERVER-SIDE SIGNING
    // ========================================================================
    if (providerKey) {
      const { data: provRow } = await supabaseAdmin
        .from("offer_providers")
        .select("id, provider_key, display_name, status, hosted_wall_url_template")
        .eq("provider_key", providerKey)
        .maybeSingle();

      if (!provRow) {
        throw new AppError(`Unknown partner provider '${providerKey}'.`, 404, "PROVIDER_NOT_FOUND");
      }

      if (provRow.status !== "active") {
        throw new AppError(`${provRow.display_name} is awaiting approval or temporarily paused.`, 400, "PROVIDER_NOT_ACTIVE");
      }

      const wallResult = buildHostedWallLaunchUrl(
        provRow.provider_key,
        verifiedUser.id,
        provRow.hosted_wall_url_template
      );

      if (!wallResult.url) {
        throw new AppError(
          wallResult.reason || `${provRow.display_name} Hosted Wall is awaiting credentials.`,
          400,
          "PROVIDER_NOT_CONFIGURED"
        );
      }

      return successResponse(
        {
          mode: "hosted_wall",
          trackingUrl: wallResult.url,
          providerName: provRow.display_name,
          providerKey: provRow.provider_key,
        },
        200,
        req
      );
    }

    throw new AppError("Provide either offerId or providerKey.", 400, "MISSING_PARAMETERS");
  } catch (err) {
    return errorResponse(err, req);
  }
});
