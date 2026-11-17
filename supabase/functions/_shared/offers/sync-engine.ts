// supabase/functions/_shared/offers/sync-engine.ts
// Provider Offer Synchronization Engine with pagination, backoff, safe upsert, and history preservation

import { getProviderAdapter } from "../providers/registry.ts";
import { sanitizeDestinationUrl, type NormalizedOffer } from "../providers/types.ts";
import { buildRewardCalculator, loadCommissionConfig } from "./reward-engine.ts";

export interface SyncProviderSummary {
  providerKey: string;
  status: "success" | "partial" | "failed" | "skipped";
  offersReceived: number;
  offersCreated: number;
  offersUpdated: number;
  offersDeactivated: number;
  note?: string;
  error?: string;
}

const MAX_SYNC_PAGES = 10;

export async function syncProviderOffers(
  supabaseAdmin: any,
  providerKey: string,
  options: { country?: string; forceEvenIfSyncDisabled?: boolean } = {}
): Promise<SyncProviderSummary> {
  const cleanKey = providerKey.toLowerCase().trim();
  const startedAt = new Date().toISOString();

  const { data: providerRow, error: provErr } = await supabaseAdmin
    .from("offer_providers")
    .select("*")
    .eq("provider_key", cleanKey)
    .maybeSingle();

  if (provErr || !providerRow) {
    return {
      providerKey: cleanKey,
      status: "failed",
      offersReceived: 0,
      offersCreated: 0,
      offersUpdated: 0,
      offersDeactivated: 0,
      error: `Provider '${cleanKey}' is not registered in offer_providers.`,
    };
  }

  const adapter = getProviderAdapter(cleanKey);
  if (!adapter) {
    return {
      providerKey: cleanKey,
      status: "failed",
      offersReceived: 0,
      offersCreated: 0,
      offersUpdated: 0,
      offersDeactivated: 0,
      error: `No adapter implementation found for '${cleanKey}'.`,
    };
  }

  if (!providerRow.sync_enabled && !options.forceEvenIfSyncDisabled) {
    return {
      providerKey: cleanKey,
      status: "skipped",
      offersReceived: 0,
      offersCreated: 0,
      offersUpdated: 0,
      offersDeactivated: 0,
      note: "Provider catalog sync is disabled in offer_providers.",
    };
  }

  const { data: logRow } = await supabaseAdmin
    .from("provider_sync_logs")
    .insert({
      provider_id: providerRow.id,
      sync_status: "running",
      started_at: startedAt,
    })
    .select("id")
    .single();

  const logId: string | null = logRow?.id || null;

  let offersReceived = 0;
  let offersCreated = 0;
  let offersUpdated = 0;
  let offersDeactivated = 0;
  let finalStatus: "success" | "partial" | "failed" | "skipped" = "success";
  let statusNote: string | undefined;
  let errorMessage: string | undefined;

  try {
    const commissionConfig = await loadCommissionConfig(supabaseAdmin);
    const calc = buildRewardCalculator(
      commissionConfig,
      cleanKey,
      providerRow.commission_override_percent !== null
        ? Number(providerRow.commission_override_percent)
        : null
    );

    const allowedDomains = Array.from(
      new Set([
        ...adapter.allowedRedirectDomains,
        ...(Array.isArray(providerRow.allowed_redirect_domains)
          ? providerRow.allowed_redirect_domains
          : []),
      ])
    );

    const normalizedMap = new Map<string, NormalizedOffer>();
    let page = 1;
    let hasMore = true;
    let completedFullSweep = true;
    const nowMs = Date.now();

    while (hasMore && page <= MAX_SYNC_PAGES) {
      const fetchRes = await adapter.fetchOffers({
        page,
        limit: 50,
        country: options.country,
        timeoutMs: 12000,
      });

      if (fetchRes.unsupportedByProvider) {
        finalStatus = "skipped";
        statusNote = fetchRes.note || "Provider does not expose a global offer catalog API.";
        completedFullSweep = false;
        break;
      }

      if (fetchRes.rateLimited) {
        finalStatus = page > 1 ? "partial" : "skipped";
        statusNote = fetchRes.note || "Provider API rate limit reached.";
        completedFullSweep = false;
        break;
      }

      if (page === 1 && fetchRes.offers.length === 0 && fetchRes.note) {
        finalStatus = "skipped";
        statusNote = fetchRes.note;
        completedFullSweep = false;
        break;
      }

      offersReceived += fetchRes.offers.length;

      for (const rawOffer of fetchRes.offers) {
        const normalized = adapter.normalizeOffer(rawOffer, calc);
        if (!normalized) continue;

        // Re-verify destination URL domain & skip already-expired campaigns
        const safeUrl = sanitizeDestinationUrl(normalized.destination_url, allowedDomains);
        if (!safeUrl) continue;
        normalized.destination_url = safeUrl;

        if (normalized.expires_at) {
          const expMs = new Date(normalized.expires_at).getTime();
          if (Number.isFinite(expMs) && expMs <= nowMs) {
            continue;
          }
        }

        // Duplicate detection within provider feed
        if (!normalizedMap.has(normalized.external_offer_id)) {
          normalizedMap.set(normalized.external_offer_id, normalized);
        }
      }

      hasMore = Boolean(fetchRes.hasMore);
      page = fetchRes.nextPage || page + 1;
    }

    if (normalizedMap.size > 0) {
      const { data: existingRows } = await supabaseAdmin
        .from("offers")
        .select("id, external_offer_id, is_active")
        .eq("provider_id", providerRow.id);

      const existingByExt = new Map<string, { id: string; is_active: boolean }>();
      for (const r of existingRows || []) {
        existingByExt.set(r.external_offer_id, { id: r.id, is_active: r.is_active });
      }

      const nowIso = new Date().toISOString();
      const upsertRows: Record<string, unknown>[] = [];

      for (const norm of normalizedMap.values()) {
        if (existingByExt.has(norm.external_offer_id)) {
          offersUpdated++;
        } else {
          offersCreated++;
        }

        upsertRows.push({
          provider_id: providerRow.id,
          external_offer_id: norm.external_offer_id,
          title: norm.title,
          description: norm.description,
          instructions: norm.instructions,
          steps: norm.steps,
          category: norm.category,
          image_url: norm.image_url,
          thumbnail_url: norm.thumbnail_url,
          provider_reward: norm.provider_reward,
          user_reward: norm.user_reward,
          commission_percent: norm.commission_percent,
          currency: norm.currency,
          is_estimated_reward: norm.is_estimated_reward,
          estimated_time: norm.estimated_time,
          countries: norm.countries,
          excluded_countries: norm.excluded_countries,
          device_types: norm.device_types,
          new_user_only: norm.new_user_only,
          tracking_type: norm.tracking_type,
          destination_url: norm.destination_url,
          is_featured: norm.is_featured,
          is_active: norm.is_active,
          starts_at: norm.starts_at,
          expires_at: norm.expires_at,
          synced_at: nowIso,
          updated_at: nowIso,
        });
      }

      const { error: upsertErr } = await supabaseAdmin
        .from("offers")
        .upsert(upsertRows, { onConflict: "provider_id,external_offer_id" });

      if (upsertErr) throw upsertErr;

      // Deactivate offers missing from live feed ONLY if full sweep completed cleanly (never delete history!)
      if (completedFullSweep) {
        const missingActiveIds: string[] = [];
        for (const [extId, row] of existingByExt.entries()) {
          if (row.is_active && !normalizedMap.has(extId)) {
            missingActiveIds.push(row.id);
          }
        }
        if (missingActiveIds.length > 0) {
          const { error: deactErr } = await supabaseAdmin
            .from("offers")
            .update({ is_active: false, updated_at: nowIso })
            .in("id", missingActiveIds);
          if (!deactErr) offersDeactivated += missingActiveIds.length;
        }
      }
    }

    // Always deactivate expired offers regardless of feed output
    const { data: expiredDeactivated } = await supabaseAdmin
      .from("offers")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("provider_id", providerRow.id)
      .eq("is_active", true)
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (Array.isArray(expiredDeactivated)) {
      offersDeactivated += expiredDeactivated.length;
    }
  } catch (err: any) {
    finalStatus = "failed";
    errorMessage = err?.message || "Unexpected synchronization error";
  }

  const finishedAt = new Date().toISOString();

  if (logId) {
    await supabaseAdmin
      .from("provider_sync_logs")
      .update({
        sync_status: finalStatus,
        offers_received: offersReceived,
        offers_created: offersCreated,
        offers_updated: offersUpdated,
        offers_deactivated: offersDeactivated,
        error_message: errorMessage || statusNote || null,
        finished_at: finishedAt,
      })
      .eq("id", logId);
  }

  await supabaseAdmin
    .from("offer_providers")
    .update({
      last_sync_at: finishedAt,
      last_sync_status: finalStatus,
      last_error: errorMessage || (finalStatus === "skipped" ? statusNote || null : null),
      updated_at: finishedAt,
    })
    .eq("id", providerRow.id);

  return {
    providerKey: cleanKey,
    status: finalStatus,
    offersReceived,
    offersCreated,
    offersUpdated,
    offersDeactivated,
    note: statusNote,
    error: errorMessage,
  };
}

export async function syncAllEnabledProviders(
  supabaseAdmin: any
): Promise<SyncProviderSummary[]> {
  const { data: providers } = await supabaseAdmin
    .from("offer_providers")
    .select("provider_key, sync_enabled, status")
    .eq("sync_enabled", true)
    .eq("status", "active");

  const results: SyncProviderSummary[] = [];
  for (const p of providers || []) {
    const summary = await syncProviderOffers(supabaseAdmin, p.provider_key);
    results.push(summary);
  }
  return results;
}
