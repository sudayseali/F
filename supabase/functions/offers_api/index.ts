// supabase/functions/offers_api/index.ts
// Authenticated User Offers Marketplace API (Discovery, Details, History, Disputes & Partner Walls)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors } from "../_shared/cors.ts";
import { verifyUserRequest } from "../_shared/auth.ts";
import { errorResponse, successResponse, AppError } from "../_shared/errors.ts";
import { checkDistributedRateLimit, getClientIp } from "../_shared/rate-limit.ts";
import { isValidUuid, sanitizeString } from "../_shared/validation.ts";
import { getAllProviderStatuses, getProviderAdapter } from "../_shared/providers/registry.ts";
import { buildRewardCalculator, loadCommissionConfig } from "../_shared/offers/reward-engine.ts";
import type { DeviceType } from "../_shared/providers/types.ts";

function getSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) {
    throw new AppError("Server configuration missing database credentials", 500, "CONFIG_ERROR");
  }
  return createClient(url, key);
}

function checkOfferEligibility(
  offer: {
    countries?: string[] | null;
    excluded_countries?: string[] | null;
    device_types?: string[] | null;
    expires_at?: string | null;
    starts_at?: string | null;
    is_active?: boolean;
  },
  userCountry: string | null,
  userDevice: DeviceType
): { eligible: boolean; reason?: string } {
  if (offer.is_active === false) {
    return { eligible: false, reason: "This offer is no longer active." };
  }

  const nowMs = Date.now();
  if (offer.starts_at && new Date(offer.starts_at).getTime() > nowMs) {
    return { eligible: false, reason: "This campaign has not started yet." };
  }
  if (offer.expires_at && new Date(offer.expires_at).getTime() <= nowMs) {
    return { eligible: false, reason: "This offer has expired." };
  }

  const allowedCountries = Array.isArray(offer.countries) ? offer.countries : [];
  const excludedCountries = Array.isArray(offer.excluded_countries) ? offer.excluded_countries : [];

  if (userCountry) {
    const cc = userCountry.toUpperCase();
    if (excludedCountries.includes(cc)) {
      return { eligible: false, reason: `Not available in ${cc}.` };
    }
    if (allowedCountries.length > 0 && !allowedCountries.includes(cc)) {
      return { eligible: false, reason: `Available only in ${allowedCountries.slice(0, 4).join(", ")}.` };
    }
  }

  const allowedDevices = Array.isArray(offer.device_types) && offer.device_types.length > 0
    ? offer.device_types
    : ["all"];

  if (
    userDevice !== "all" &&
    !allowedDevices.includes("all") &&
    !allowedDevices.includes(userDevice)
  ) {
    return {
      eligible: false,
      reason: `Requires ${allowedDevices.map((d) => d.toUpperCase()).join(" or ")} device.`,
    };
  }

  return { eligible: true };
}

function detectClientDevice(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase();
  if (ua.includes("android")) return "android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "ios";
  if (ua.includes("windows") || ua.includes("macintosh") || ua.includes("linux")) return "desktop";
  return "all";
}

function sanitizeOfferForClient(
  row: any,
  providerMap: Map<string, any>,
  progressMap: Map<string, any>,
  userCountry: string | null,
  userDevice: DeviceType
) {
  const prov = providerMap.get(row.provider_id);
  const prog = progressMap.get(row.id);
  const elig = checkOfferEligibility(row, userCountry, userDevice);

  return {
    id: row.id,
    provider_key: prov?.provider_key || "unknown",
    provider_name: prov?.display_name || "Partner",
    external_offer_id: row.external_offer_id,
    title: row.title,
    description: row.description,
    instructions: row.instructions,
    steps: Array.isArray(row.steps) ? row.steps : [],
    category: row.category,
    image_url: row.image_url,
    thumbnail_url: row.thumbnail_url,
    user_reward: Number(row.user_reward || 0),
    currency: row.currency || "USD",
    is_estimated_reward: Boolean(row.is_estimated_reward),
    estimated_time: row.estimated_time ?? null,
    countries: Array.isArray(row.countries) ? row.countries : [],
    excluded_countries: Array.isArray(row.excluded_countries) ? row.excluded_countries : [],
    device_types: Array.isArray(row.device_types) ? row.device_types : ["all"],
    new_user_only: Boolean(row.new_user_only),
    tracking_type: row.tracking_type || "s2s",
    is_featured: Boolean(row.is_featured),
    starts_at: row.starts_at,
    expires_at: row.expires_at,
    synced_at: row.synced_at,
    progress_status: prog?.progress_status || "available",
    reward_earned: Number(prog?.reward_amount || 0),
    eligible: elig.eligible,
    ineligible_reason: elig.reason || null,
  };
}

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    if (req.method !== "GET" && req.method !== "POST") {
      throw new AppError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const supabaseAdmin = getSupabaseAdmin();
    const clientIp = getClientIp(req);

    const rate = await checkDistributedRateLimit(supabaseAdmin, `offers_api_${clientIp}`, 60, 60);
    if (!rate.allowed) {
      throw new AppError("Too many requests. Please wait a moment.", 429, "RATE_LIMIT_EXCEEDED");
    }

    const verifiedUser = await verifyUserRequest(req);
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body.action || url.searchParams.get("action") || "list_marketplace").trim();

    const headerCountry = (req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country") || "").trim().toUpperCase();
    const requestedCountry = String(body.country || url.searchParams.get("country") || "").trim().toUpperCase();
    const userCountry = /^[A-Z]{2}$/.test(requestedCountry)
      ? requestedCountry
      : /^[A-Z]{2}$/.test(headerCountry)
      ? headerCountry
      : null;

    const requestedDevice = String(body.device || url.searchParams.get("device") || "").toLowerCase();
    const userDevice: DeviceType = ["android", "ios", "desktop", "all"].includes(requestedDevice)
      ? (requestedDevice as DeviceType)
      : detectClientDevice(req.headers.get("user-agent") || "");

    // ========================================================================
    // 1. LIST MARKETPLACE (CATALOG OFFERS + LIVE CPX SURVEYS + PARTNER WALLS)
    // ========================================================================
    if (action === "list_marketplace") {
      const category = String(body.category || url.searchParams.get("category") || "all").toLowerCase();
      const providerFilter = String(body.providerKey || url.searchParams.get("provider") || "all").toLowerCase();
      const search = sanitizeString(body.search || url.searchParams.get("search") || "", 80).toLowerCase();
      const sort = String(body.sort || url.searchParams.get("sort") || "featured").toLowerCase();
      const includeCpxLive = body.includeCpxLive !== false;

      const [{ data: providers }, { data: rawOffers }, { data: progressRows }, { data: completionRows }] =
        await Promise.all([
          supabaseAdmin
            .from("offer_providers")
            .select("id, provider_key, display_name, integration_type, status, api_enabled, custom_listing_enabled, hosted_wall_url_template, commission_override_percent, last_sync_at, metadata")
            .order("display_name", { ascending: true }),
          supabaseAdmin
            .from("offers")
            .select("*")
            .eq("is_active", true)
            .order("is_featured", { ascending: false })
            .order("user_reward", { ascending: false })
            .limit(200),
          supabaseAdmin
            .from("offer_user_status")
            .select("offer_id, progress_status, reward_amount, status_note, last_updated_at")
            .eq("user_id", verifiedUser.id),
          supabaseAdmin
            .from("offer_completions")
            .select("user_reward, status")
            .eq("user_id", verifiedUser.id),
        ]);

      const providerMap = new Map<string, any>();
      const providerByKey = new Map<string, any>();
      for (const p of providers || []) {
        providerMap.set(p.id, p);
        providerByKey.set(p.provider_key, p);
      }

      // Live CPX survey hydration when configured (user-specific API)
      const cpxProv = providerByKey.get("cpx");
      const cpxAdapter = getProviderAdapter("cpx");
      const cpxStatus = cpxAdapter?.getProviderStatus();
      if (
        includeCpxLive &&
        cpxProv?.status === "active" &&
        cpxAdapter &&
        cpxStatus?.configuredForApi &&
        (category === "all" || category === "surveys") &&
        (providerFilter === "all" || providerFilter === "cpx")
      ) {
        try {
          const liveFetch = await cpxAdapter.fetchOffers({
            userId: verifiedUser.id,
            userIp: clientIp,
            userAgent: req.headers.get("user-agent") || "",
            limit: 8,
            timeoutMs: 4500,
          });
          if (liveFetch.offers.length > 0) {
            const cfg = await loadCommissionConfig(supabaseAdmin);
            const calc = buildRewardCalculator(
              cfg,
              "cpx",
              cpxProv.commission_override_percent !== null ? Number(cpxProv.commission_override_percent) : null
            );
            const cpxAppId = (Deno.env.get("CPX_APP_ID") || "").trim();
            const nowIso = new Date().toISOString();
            const cpxUpserts: Record<string, unknown>[] = [];

            for (const rawSurvey of liveFetch.offers) {
              const norm = cpxAdapter.normalizeOffer(rawSurvey, calc);
              if (!norm) continue;
              // Never persist user-signed ext_user_id/secure_hash in shared offers table
              const cleanSurveyUrl = cpxAppId
                ? `https://offers.cpx-research.com/index.php?app_id=${encodeURIComponent(cpxAppId)}&survey_id=${encodeURIComponent(norm.external_offer_id)}`
                : norm.destination_url;
              cpxUpserts.push({
                provider_id: cpxProv.id,
                external_offer_id: norm.external_offer_id,
                title: norm.title,
                description: norm.description,
                instructions: norm.instructions,
                steps: norm.steps,
                category: "surveys",
                provider_reward: norm.provider_reward,
                user_reward: norm.user_reward,
                commission_percent: norm.commission_percent,
                currency: norm.currency,
                is_estimated_reward: false,
                estimated_time: norm.estimated_time,
                countries: [],
                excluded_countries: [],
                device_types: ["all"],
                new_user_only: false,
                tracking_type: "survey",
                destination_url: cleanSurveyUrl,
                is_featured: norm.is_featured,
                is_active: true,
                synced_at: nowIso,
                updated_at: nowIso,
              });
            }

            if (cpxUpserts.length > 0) {
              await supabaseAdmin
                .from("offers")
                .upsert(cpxUpserts, { onConflict: "provider_id,external_offer_id" });
            }
          }
        } catch (err) {
          console.warn("[OFFERS_API_CPX_LIVE_WARN]", err);
        }
      }

      // Re-read active offers if CPX live surveys were just refreshed or use existing
      let catalogRows = rawOffers || [];
      if (includeCpxLive && cpxProv?.status === "active" && cpxStatus?.configuredForApi) {
        const { data: refreshedOffers } = await supabaseAdmin
          .from("offers")
          .select("*")
          .eq("is_active", true)
          .order("is_featured", { ascending: false })
          .order("user_reward", { ascending: false })
          .limit(200);
        if (refreshedOffers) catalogRows = refreshedOffers;
      }

      const progressMap = new Map<string, any>();
      let startedCount = 0;
      let pendingCount = 0;
      for (const pr of progressRows || []) {
        progressMap.set(pr.offer_id, pr);
        if (pr.progress_status === "started") startedCount++;
        if (pr.progress_status === "pending") pendingCount++;
      }

      let completedCount = 0;
      let totalEarned = 0;
      for (const comp of completionRows || []) {
        if (comp.status === "credited" || comp.status === "partially_reversed") {
          completedCount++;
          totalEarned += Math.max(0, Number(comp.user_reward || 0));
        }
      }

      const sanitizedAll = catalogRows
        .filter((row: any) => {
          const prov = providerMap.get(row.provider_id);
          if (!prov || prov.status !== "active") return false;
          if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return false;
          return true;
        })
        .map((row: any) => sanitizeOfferForClient(row, providerMap, progressMap, userCountry, userDevice));

      // Apply user filters
      let filtered = sanitizedAll.filter((o: any) => {
        if (category !== "all" && o.category !== category) return false;
        if (providerFilter !== "all" && o.provider_key !== providerFilter) return false;
        if (search) {
          const hay = `${o.title} ${o.description} ${o.provider_name}`.toLowerCase();
          if (!hay.includes(search)) return false;
        }
        return true;
      });

      if (sort === "highest") {
        filtered.sort((a: any, b: any) => b.user_reward - a.user_reward);
      } else if (sort === "fastest") {
        filtered.sort((a: any, b: any) => (a.estimated_time ?? 999) - (b.estimated_time ?? 999));
      } else if (sort === "newest") {
        filtered.sort(
          (a: any, b: any) => new Date(b.synced_at || 0).getTime() - new Date(a.synced_at || 0).getTime()
        );
      } else {
        filtered.sort((a: any, b: any) => {
          if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
          if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
          return b.user_reward - a.user_reward;
        });
      }

      const adapterStatusMap = new Map(getAllProviderStatuses().map((s) => [s.providerKey, s]));

      const partnerWalls = (providers || [])
        .filter((p: any) => p.status === "active" || p.status === "pending_approval")
        .map((p: any) => {
          const st = adapterStatusMap.get(p.provider_key);
          return {
            provider_key: p.provider_key,
            display_name: p.display_name,
            integration_type: p.integration_type,
            status: p.status,
            supports_custom_listing: Boolean(p.custom_listing_enabled || st?.supportsCustomListing),
            supports_hosted_wall: Boolean(st?.supportsHostedWall || p.hosted_wall_url_template),
            configured_for_wall: Boolean(st?.supportsHostedWall),
            categories: Array.isArray(p.metadata?.categories) ? p.metadata.categories : [],
            note: p.metadata?.note || st?.note || null,
          };
        });

      const availableCategories = Array.from(new Set(sanitizedAll.map((o: any) => o.category)));

      return successResponse(
        {
          offers: filtered,
          totalCatalogOffers: sanitizedAll.length,
          availableCategories,
          partnerWalls,
          detectedContext: {
            country: userCountry,
            device: userDevice,
          },
          userSummary: {
            startedCount,
            pendingCount,
            completedCount,
            totalEarned: Math.round(totalEarned * 100) / 100,
          },
        },
        200,
        req
      );
    }

    // ========================================================================
    // 2. GET SINGLE OFFER DETAILS
    // ========================================================================
    if (action === "get_offer_details") {
      const offerId = String(body.offerId || url.searchParams.get("offerId") || "").trim();
      if (!offerId || !isValidUuid(offerId)) {
        throw new AppError("Valid offerId required.", 400, "INVALID_OFFER_ID");
      }

      const [{ data: offerRow, error: offerErr }, { data: progress }, { data: disputes }, { data: clicks }] =
        await Promise.all([
          supabaseAdmin.from("offers").select("*").eq("id", offerId).maybeSingle(),
          supabaseAdmin
            .from("offer_user_status")
            .select("*")
            .eq("user_id", verifiedUser.id)
            .eq("offer_id", offerId)
            .maybeSingle(),
          supabaseAdmin
            .from("offer_disputes")
            .select("id, reason, status, admin_note, created_at, resolved_at")
            .eq("user_id", verifiedUser.id)
            .eq("offer_id", offerId)
            .order("created_at", { ascending: false }),
          supabaseAdmin
            .from("offer_clicks")
            .select("id, opaque_click_id, status, clicked_at, expires_at")
            .eq("user_id", verifiedUser.id)
            .eq("offer_id", offerId)
            .order("clicked_at", { ascending: false })
            .limit(3),
        ]);

      if (offerErr || !offerRow) {
        throw new AppError("Offer not found.", 404, "OFFER_NOT_FOUND");
      }

      const { data: provRow } = await supabaseAdmin
        .from("offer_providers")
        .select("id, provider_key, display_name, status")
        .eq("id", offerRow.provider_id)
        .single();

      const provMap = new Map([[provRow.id, provRow]]);
      const progMap = new Map(progress ? [[offerId, progress]] : []);

      return successResponse(
        {
          offer: sanitizeOfferForClient(offerRow, provMap, progMap, userCountry, userDevice),
          progress: progress || null,
          clicks: clicks || [],
          disputes: disputes || [],
        },
        200,
        req
      );
    }

    // ========================================================================
    // 3. GET USER OFFER HISTORY (STARTED / PENDING / COMPLETED / REVERSED)
    // ========================================================================
    if (action === "get_user_history") {
      const [{ data: statusRows }, { data: compRows }, { data: disputeRows }, { data: legacyLogs }] =
        await Promise.all([
          supabaseAdmin
            .from("offer_user_status")
            .select("id, offer_id, click_id, progress_status, reward_amount, status_note, started_at, completed_at, last_updated_at, offer:offers(id, title, category, user_reward, thumbnail_url, provider:offer_providers(provider_key, display_name))")
            .eq("user_id", verifiedUser.id)
            .order("last_updated_at", { ascending: false })
            .limit(50),
          supabaseAdmin
            .from("offer_completions")
            .select("id, offer_id, external_transaction_id, user_reward, reversed_amount, status, credited_at, reversed_at, created_at, offer:offers(title, category), provider:offer_providers(provider_key, display_name)")
            .eq("user_id", verifiedUser.id)
            .order("created_at", { ascending: false })
            .limit(50),
          supabaseAdmin
            .from("offer_disputes")
            .select("id, offer_id, reason, status, admin_note, created_at, resolved_at, offer:offers(title)")
            .eq("user_id", verifiedUser.id)
            .order("created_at", { ascending: false })
            .limit(25),
          supabaseAdmin
            .from("offerwall_logs")
            .select("id, provider, external_transaction_id, amount, status, created_at")
            .eq("user_id", verifiedUser.id)
            .order("created_at", { ascending: false })
            .limit(30),
        ]);

      return successResponse(
        {
          progressItems: statusRows || [],
          completions: compRows || [],
          disputes: disputeRows || [],
          legacyLogs: legacyLogs || [],
        },
        200,
        req
      );
    }

    // ========================================================================
    // 4. SUBMIT MISSING REWARD DISPUTE
    // ========================================================================
    if (action === "submit_dispute") {
      const offerId = body.offerId ? String(body.offerId).trim() : null;
      const clickId = body.clickId ? String(body.clickId).trim() : null;
      const reason = sanitizeString(body.reason || "", 500);

      if (reason.length < 10) {
        throw new AppError("Please explain what you completed (minimum 10 characters).", 400, "INVALID_REASON");
      }
      if (offerId && !isValidUuid(offerId)) {
        throw new AppError("Invalid offerId.", 400, "INVALID_OFFER_ID");
      }
      if (clickId && !isValidUuid(clickId)) {
        throw new AppError("Invalid clickId.", 400, "INVALID_CLICK_ID");
      }

      let providerId: string | null = null;
      let resolvedClickId: string | null = null;

      if (offerId) {
        const { data: off } = await supabaseAdmin
          .from("offers")
          .select("id, provider_id")
          .eq("id", offerId)
          .maybeSingle();
        if (!off) throw new AppError("Offer not found.", 404, "OFFER_NOT_FOUND");
        providerId = off.provider_id;

        const { data: openDup } = await supabaseAdmin
          .from("offer_disputes")
          .select("id")
          .eq("user_id", verifiedUser.id)
          .eq("offer_id", offerId)
          .in("status", ["open", "investigating"])
          .maybeSingle();

        if (openDup) {
          throw new AppError("You already have an open support review for this offer.", 409, "DUPLICATE_DISPUTE");
        }
      }

      if (clickId) {
        const { data: clk } = await supabaseAdmin
          .from("offer_clicks")
          .select("id, provider_id")
          .eq("id", clickId)
          .eq("user_id", verifiedUser.id)
          .maybeSingle();
        if (clk) {
          resolvedClickId = clk.id;
          providerId = providerId || clk.provider_id;
        }
      }

      const { data: created, error: insErr } = await supabaseAdmin
        .from("offer_disputes")
        .insert({
          user_id: verifiedUser.id,
          offer_id: offerId,
          provider_id: providerId,
          click_id: resolvedClickId,
          reason,
          status: "open",
        })
        .select("id, status, created_at")
        .single();

      if (insErr) throw insErr;

      return successResponse({ dispute: created, message: "Reward review ticket submitted." }, 201, req);
    }

    throw new AppError(`Unknown offers_api action '${action}'`, 400, "UNKNOWN_ACTION");
  } catch (err) {
    return errorResponse(err, req);
  }
});
