import {
  Search, Sparkles, ArrowLeft, ExternalLink, RotateCw,
  Compass, Layers, History, AlertCircle, SlidersHorizontal
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTelegram } from "../contexts/TelegramContext";
import { invokeEdgeFunction } from "../lib/supabase";
import { tgHaptics, tgBackButton, openTgLink } from "../lib/telegram";
import { TelegramModal } from "../components/TelegramModal";
import { PayvoraSpinner } from "../components";
import { OfferCard } from "../components/offers/OfferCard";
import { OfferDetailsSheet } from "../components/offers/OfferDetailsSheet";
import { OfferHistoryView } from "../components/offers/OfferHistoryView";
import { PartnerWallsSection } from "../components/offers/PartnerWallsSection";
import { APP_CONFIG } from "../config/appConfig";
import type {
  MarketplaceOffer,
  OfferDisputeItem,
  OfferHistoryProgressItem,
  OfferUserSummary,
  PartnerWallInfo,
} from "../types";

type MarketplaceTab = "explore" | "walls" | "history";
type SortOption = "featured" | "highest" | "fastest" | "newest";

const FALLBACK_PARTNER_WALLS: PartnerWallInfo[] = [
  {
    provider_key: "cpx",
    display_name: "CPX Research",
    integration_type: "survey_api",
    status: "active",
    supports_custom_listing: true,
    supports_hosted_wall: true,
    configured_for_wall: true,
    categories: ["surveys"],
    note: "Paid market research surveys with instant credit.",
  },
  {
    provider_key: "ayet",
    display_name: "ayeT-Studios",
    integration_type: "hybrid",
    status: "active",
    supports_custom_listing: false,
    supports_hosted_wall: true,
    configured_for_wall: true,
    categories: ["games", "apps"],
    note: "Level-based mobile games and app installs.",
  },
  {
    provider_key: "torox",
    display_name: "Torox",
    integration_type: "hybrid",
    status: "active",
    supports_custom_listing: false,
    supports_hosted_wall: true,
    configured_for_wall: true,
    categories: ["games", "apps", "registration"],
    note: "Multi-stage gaming and registration rewards.",
  },
  {
    provider_key: "lootably",
    display_name: "Lootably",
    integration_type: "hybrid",
    status: "active",
    supports_custom_listing: false,
    supports_hosted_wall: true,
    configured_for_wall: true,
    categories: ["apps", "games", "surveys"],
    note: "Interactive mobile apps and high-converting offers.",
  },
  {
    provider_key: "adgate",
    display_name: "AdGate Media",
    integration_type: "hybrid",
    status: "active",
    supports_custom_listing: false,
    supports_hosted_wall: true,
    configured_for_wall: true,
    categories: ["apps", "games", "trial"],
    note: "Global app discovery and trial offers.",
  },
  {
    provider_key: "tapjoy",
    display_name: "Tapjoy",
    integration_type: "hosted_wall",
    status: "active",
    supports_custom_listing: false,
    supports_hosted_wall: true,
    configured_for_wall: false,
    categories: ["games", "apps"],
    note: "Hosted Partner Wall integration.",
  },
];

const CATEGORY_FILTERS = [
  { key: "all", label: "All" },
  { key: "games", label: "Games" },
  { key: "apps", label: "Apps" },
  { key: "surveys", label: "Surveys" },
  { key: "registration", label: "Sign Up" },
  { key: "trial", label: "Trials" },
];

export function Offerwall() {
  const { user, refreshUser } = useTelegram();

  const [mainTab, setMainTab] = useState<MarketplaceTab>("explore");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortOption>("featured");
  const [searchQuery, setSearchQuery] = useState("");

  const [offers, setOffers] = useState<MarketplaceOffer[]>([]);
  const [partnerWalls, setPartnerWalls] = useState<PartnerWallInfo[]>(FALLBACK_PARTNER_WALLS);
  const [userSummary, setUserSummary] = useState<OfferUserSummary>({
    startedCount: 0,
    pendingCount: 0,
    completedCount: 0,
    totalEarned: 0,
  });

  const [loadingMarketplace, setLoadingMarketplace] = useState(true);
  const [marketplaceError, setMarketplaceError] = useState<string | null>(null);

  const [selectedOffer, setSelectedOffer] = useState<MarketplaceOffer | null>(null);
  const [startingOfferId, setStartingOfferId] = useState<string | null>(null);
  const [launchingWallKey, setLaunchingWallKey] = useState<string | null>(null);

  const [activeWallUrl, setActiveWallUrl] = useState<string | null>(null);
  const [activeWallName, setActiveWallName] = useState("");
  const [iframeLoading, setIframeLoading] = useState(true);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyProgress, setHistoryProgress] = useState<OfferHistoryProgressItem[]>([]);
  const [historyDisputes, setHistoryDisputes] = useState<OfferDisputeItem[]>([]);
  const [historyLegacy, setHistoryLegacy] = useState<any[]>([]);

  const [disputePrompt, setDisputePrompt] = useState<{
    open: boolean;
    offerId: string;
    clickId?: string | null;
    reason: string;
    submitting: boolean;
  }>({ open: false, offerId: "", clickId: null, reason: "", submitting: false });

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "info" | "error" | "success";
  }>({ isOpen: false, title: "", message: "", type: "info" });

  const loadMarketplace = useCallback(async () => {
    if (!user?.uuid) {
      setLoadingMarketplace(false);
      return;
    }
    setLoadingMarketplace(true);
    setMarketplaceError(null);
    try {
      const res = await invokeEdgeFunction<{
        offers?: MarketplaceOffer[];
        partnerWalls?: PartnerWallInfo[];
        userSummary?: OfferUserSummary;
      }>("offers_api", {
        action: "list_marketplace",
        category: "all",
        sort: "featured",
      });

      setOffers(Array.isArray(res?.offers) ? res.offers : []);
      if (Array.isArray(res?.partnerWalls) && res.partnerWalls.length > 0) {
        setPartnerWalls(res.partnerWalls);
      }
      if (res?.userSummary) {
        setUserSummary(res.userSummary);
      }
    } catch (err: any) {
      setMarketplaceError(err?.message || "Unable to load offers marketplace right now.");
    } finally {
      setLoadingMarketplace(false);
    }
  }, [user?.uuid]);

  const loadHistory = useCallback(async () => {
    if (!user?.uuid) return;
    setHistoryLoading(true);
    try {
      const res = await invokeEdgeFunction<{
        progressItems?: OfferHistoryProgressItem[];
        disputes?: OfferDisputeItem[];
        legacyLogs?: any[];
      }>("offers_api", { action: "get_user_history" });

      setHistoryProgress(Array.isArray(res?.progressItems) ? res.progressItems : []);
      setHistoryDisputes(Array.isArray(res?.disputes) ? res.disputes : []);
      setHistoryLegacy(Array.isArray(res?.legacyLogs) ? res.legacyLogs : []);
    } catch (err: any) {
      setModalState({
        isOpen: true,
        title: "History Unavailable",
        message: err?.message || "Could not load your offer history.",
        type: "error",
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.uuid]);

  useEffect(() => {
    loadMarketplace();
  }, [loadMarketplace]);

  useEffect(() => {
    if (mainTab === "history") {
      loadHistory();
    }
  }, [mainTab, loadHistory]);

  const closeWallViewer = useCallback(() => {
    tgHaptics.impact("light");
    setActiveWallUrl(null);
    setActiveWallName("");
    setIframeLoading(true);
    refreshUser?.();
  }, [refreshUser]);

  useEffect(() => {
    if (activeWallUrl) {
      tgBackButton.show(closeWallViewer);
      return () => tgBackButton.hide(closeWallViewer);
    }
    if (selectedOffer) {
      const closeDetail = () => setSelectedOffer(null);
      tgBackButton.show(closeDetail);
      return () => tgBackButton.hide(closeDetail);
    }
    tgBackButton.hide();
  }, [activeWallUrl, selectedOffer, closeWallViewer]);

  const filteredOffers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = offers.filter((o) => {
      if (category !== "all" && o.category !== category) return false;
      if (q) {
        const hay = `${o.title} ${o.description} ${o.provider_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list];
    if (sort === "highest") {
      sorted.sort((a, b) => b.user_reward - a.user_reward);
    } else if (sort === "fastest") {
      sorted.sort((a, b) => (a.estimated_time ?? 999) - (b.estimated_time ?? 999));
    } else if (sort === "newest") {
      sorted.sort((a, b) => new Date(b.synced_at || 0).getTime() - new Date(a.synced_at || 0).getTime());
    } else {
      sorted.sort((a, b) => {
        if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
        if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
        return b.user_reward - a.user_reward;
      });
    }
    return sorted;
  }, [offers, category, searchQuery, sort]);

  const featuredOffers = useMemo(
    () => offers.filter((o) => o.is_featured && o.eligible).slice(0, 6),
    [offers]
  );

  const visibleCategoryFilters = useMemo(() => {
    const present = new Set(offers.map((o) => o.category));
    if (present.size === 0) return CATEGORY_FILTERS.slice(0, 4);
    return CATEGORY_FILTERS.filter((c) => c.key === "all" || present.has(c.key as any));
  }, [offers]);

  const handleStartOffer = async (offer: MarketplaceOffer) => {
    tgHaptics.impact("medium");

    if (!user?.uuid) {
      setModalState({
        isOpen: true,
        title: "Authentication Required",
        message: `Please open Payvora via @${APP_CONFIG.telegram.botUsername} so your rewards track accurately to your wallet.`,
        type: "error",
      });
      return;
    }

    setStartingOfferId(offer.id);
    try {
      const res = await invokeEdgeFunction<{ trackingUrl?: string; providerName?: string }>(
        "offer_click",
        { offerId: offer.id }
      );

      if (!res?.trackingUrl) {
        throw new Error("Could not generate secure offer tracking link.");
      }

      // Mark as "started" in local UI state ONLY (never "completed" before verified postback!)
      setOffers((prev) =>
        prev.map((o) =>
          o.id === offer.id && o.progress_status === "available"
            ? { ...o, progress_status: "started" }
            : o
        )
      );
      setSelectedOffer((prev) =>
        prev && prev.id === offer.id && prev.progress_status === "available"
          ? { ...prev, progress_status: "started" }
          : prev
      );

      openTgLink(res.trackingUrl);
    } catch (err: any) {
      setModalState({
        isOpen: true,
        title: offer.title,
        message: err?.message || "This offer could not be launched right now.",
        type: "error",
      });
    } finally {
      setStartingOfferId(null);
    }
  };

  const handleLaunchWall = async (wall: PartnerWallInfo) => {
    tgHaptics.impact("medium");

    if (!user?.uuid) {
      setModalState({
        isOpen: true,
        title: "Authentication Required",
        message: `Please open Payvora via @${APP_CONFIG.telegram.botUsername} before launching partner offerwalls.`,
        type: "error",
      });
      return;
    }

    setLaunchingWallKey(wall.provider_key);
    try {
      const res = await invokeEdgeFunction<{ trackingUrl?: string; providerName?: string }>(
        "offer_click",
        { providerKey: wall.provider_key }
      );
      if (!res?.trackingUrl) {
        throw new Error(`${wall.display_name} session URL unavailable.`);
      }
      setActiveWallName(res.providerName || wall.display_name);
      setActiveWallUrl(res.trackingUrl);
      setIframeLoading(true);
    } catch (err: any) {
      setModalState({
        isOpen: true,
        title: wall.display_name,
        message: err?.message || `${wall.display_name} is temporarily unavailable.`,
        type: "info",
      });
    } finally {
      setLaunchingWallKey(null);
    }
  };

  const handleSubmitDispute = async (offerId: string, reason: string, clickId?: string | null) => {
    await invokeEdgeFunction("offers_api", {
      action: "submit_dispute",
      offerId,
      clickId: clickId || undefined,
      reason,
    });
    tgHaptics.notification("success");
    setModalState({
      isOpen: true,
      title: "Support Ticket Submitted",
      message: "Our team received your missing-reward inquiry. You will receive a @PayvoraBot update once reviewed.",
      type: "success",
    });
    if (mainTab === "history") loadHistory();
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Marketplace Hero Banner */}
      <div className="hero-balance-card p-4.5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-2">
          <div className="inline-flex items-center gap-1.5 text-[11px] font-bold text-sky-200">
            <Sparkles className="w-3.5 h-3.5 text-sky-300" />
            <span>Verified S2S Postbacks</span>
          </div>
          <span className="text-[11px] font-extrabold text-emerald-300 tabular-nums">
            Earned: ${userSummary.totalEarned.toFixed(2)}
          </span>
        </div>

        <h2 className="text-xl font-black text-white tracking-tight">
          Payvora Offers Marketplace
        </h2>
        <p className="text-xs text-sky-100/80 mt-1 max-w-sm">
          Explore games, mobile apps, and live surveys directly inside Payvora or open full partner walls.
        </p>

        {/* Compact Progress Strip */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/15 text-center">
          <div>
            <div className="text-[10px] font-semibold text-sky-200/80">Started</div>
            <div className="text-sm font-black text-white tabular-nums">{userSummary.startedCount}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-sky-200/80">Pending</div>
            <div className="text-sm font-black text-amber-300 tabular-nums">{userSummary.pendingCount}</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-sky-200/80">Completed</div>
            <div className="text-sm font-black text-emerald-300 tabular-nums">{userSummary.completedCount}</div>
          </div>
        </div>
      </div>

      {/* Primary Section Navigation */}
      <div className="grid grid-cols-3 gap-2 bg-[#0b1329] p-1 rounded-2xl border border-white/10">
        {[
          { key: "explore" as const, label: "Explore", icon: Compass },
          { key: "walls" as const, label: "Partner Walls", icon: Layers },
          { key: "history" as const, label: "My Activity", icon: History },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = mainTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                tgHaptics.selection();
                setMainTab(tab.key);
              }}
              className={`min-h-[40px] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                active
                  ? "bg-[#0284c7] text-white shadow-md shadow-sky-500/25"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: EXPLORE UNIFIED MARKETPLACE */}
      {mainTab === "explore" && (
        <div className="space-y-4">
          {/* Search & Sort Controls */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search games, apps, surveys..."
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-[#0b1329] border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="relative shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sort}
                onChange={(e) => {
                  tgHaptics.selection();
                  setSort(e.target.value as SortOption);
                }}
                aria-label="Sort offers"
                className="h-11 pl-8 pr-3 rounded-xl bg-[#0b1329] border border-white/10 text-xs font-bold text-slate-200 focus:outline-none focus:border-sky-500"
              >
                <option value="featured">Featured</option>
                <option value="highest">Highest Pay</option>
                <option value="fastest">Fastest</option>
                <option value="newest">Newest</option>
              </select>
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {visibleCategoryFilters.map((item) => {
              const active = category === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    tgHaptics.selection();
                    setCategory(item.key);
                  }}
                  className={`px-3.5 min-h-[36px] rounded-xl text-xs font-bold whitespace-nowrap transition-all active:scale-95 ${
                    active
                      ? "bg-[#0284c7] text-white shadow-md shadow-sky-500/30"
                      : "bg-[#0c162e] text-slate-400 hover:text-white border border-white/5"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Error State */}
          {marketplaceError && (
            <div className="card-glass-dark p-4 border-rose-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{marketplaceError}</span>
              </div>
              <button
                type="button"
                onClick={loadMarketplace}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-xs font-bold text-white shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading Skeletons */}
          {loadingMarketplace ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[78px] rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Featured Carousel */}
              {category === "all" && !searchQuery && featuredOffers.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Featured Offers
                    </h3>
                    <span className="text-[11px] font-semibold text-sky-400">
                      {featuredOffers.length} spotlight
                    </span>
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
                    {featuredOffers.map((offer) => (
                      <div key={`feat_${offer.id}`} className="shrink-0">
                        <OfferCard
                          offer={offer}
                          variant="featured"
                          onSelect={setSelectedOffer}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Unified Offers Feed or Empty Catalog Fallback */}
              {filteredOffers.length > 0 ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Available Offers ({filteredOffers.length})
                    </h3>
                  </div>
                  {filteredOffers.map((offer) => (
                    <div key={offer.id}>
                      <OfferCard
                        offer={offer}
                        variant="list"
                        onSelect={setSelectedOffer}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card-glass-dark p-6 text-center space-y-3">
                  <Compass className="w-8 h-8 text-sky-400 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white">
                      {searchQuery || category !== "all"
                        ? "No Matching Catalog Offers"
                        : "Direct Offer Feed Awaiting Sync"}
                    </h3>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      {searchQuery || category !== "all"
                        ? "Try clearing your search filter or check all categories."
                        : "Live CPX surveys and partner campaigns can also be launched directly inside Partner Walls right now."}
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    {(searchQuery || category !== "all") && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery("");
                          setCategory("all");
                        }}
                        className="px-4 min-h-[40px] rounded-xl bg-white/10 text-xs font-bold text-white"
                      >
                        Reset Filters
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMainTab("walls")}
                      className="btn-cyan-glow px-4 min-h-[40px] rounded-xl text-xs font-extrabold text-white"
                    >
                      Open Partner Walls
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* TAB 2: HOSTED PARTNER WALLS */}
      {mainTab === "walls" && (
        <PartnerWallsSection
          walls={partnerWalls}
          launchingProvider={launchingWallKey}
          onLaunchWall={handleLaunchWall}
        />
      )}

      {/* TAB 3: USER OFFER ACTIVITY & DISPUTES */}
      {mainTab === "history" && (
        <OfferHistoryView
          progressItems={historyProgress}
          disputes={historyDisputes}
          legacyLogs={historyLegacy}
          loading={historyLoading}
          onReportMissing={(offerId, clickId) =>
            setDisputePrompt({ open: true, offerId, clickId, reason: "", submitting: false })
          }
        />
      )}

      {/* Offer Detail Sheet */}
      <OfferDetailsSheet
        offer={selectedOffer}
        onClose={() => setSelectedOffer(null)}
        onStartOffer={handleStartOffer}
        onSubmitDispute={handleSubmitDispute}
        startingOfferId={startingOfferId}
      />

      {/* History Dispute Modal */}
      {disputePrompt.open && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#0b1329] border border-white/10 p-4 space-y-3">
            <h3 className="text-sm font-extrabold text-white">Report Missing Offer Reward</h3>
            <p className="text-xs text-slate-400">
              Include the date and goal/level completed (minimum 10 characters).
            </p>
            <textarea
              value={disputePrompt.reason}
              onChange={(e) => setDisputePrompt((prev) => ({ ...prev, reason: e.target.value }))}
              rows={3}
              placeholder="Explain what step or level you finished..."
              className="w-full rounded-xl bg-[#030712] border border-white/10 p-2.5 text-xs text-white focus:outline-none focus:border-sky-500"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDisputePrompt((prev) => ({ ...prev, open: false }))}
                className="px-3 py-2 text-xs font-bold text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={disputePrompt.reason.trim().length < 10 || disputePrompt.submitting}
                onClick={async () => {
                  setDisputePrompt((prev) => ({ ...prev, submitting: true }));
                  try {
                    await handleSubmitDispute(
                      disputePrompt.offerId,
                      disputePrompt.reason.trim(),
                      disputePrompt.clickId
                    );
                    setDisputePrompt({ open: false, offerId: "", clickId: null, reason: "", submitting: false });
                  } catch (err: any) {
                    setDisputePrompt((prev) => ({ ...prev, submitting: false }));
                    setModalState({
                      isOpen: true,
                      title: "Could Not Submit",
                      message: err?.message || "Please try again.",
                      type: "error",
                    });
                  }
                }}
                className="px-4 py-2 rounded-xl bg-sky-600 text-xs font-bold text-white disabled:opacity-50"
              >
                {disputePrompt.submitting ? "Submitting..." : "Submit Review"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hosted Partner Wall Viewer Modal */}
      <AnimatePresence>
        {activeWallUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-[#030712] flex flex-col"
          >
            <div className="h-12 bg-[#0c162e] border-b border-white/10 px-3 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={closeWallViewer}
                className="flex items-center gap-1.5 text-xs font-bold text-[#38bdf8] active:opacity-70 py-1.5 px-2 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <div className="text-xs font-bold text-white truncate max-w-[160px]">
                {activeWallName}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    tgHaptics.impact("light");
                    setIframeLoading(true);
                    const iframe = document.getElementById("offerwall-frame") as HTMLIFrameElement;
                    if (iframe) iframe.src = activeWallUrl;
                  }}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg active:scale-95"
                  title="Reload"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openTgLink(activeWallUrl)}
                  className="p-1.5 text-slate-400 hover:text-[#38bdf8] rounded-lg active:scale-95"
                  title="Open in Browser"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 relative bg-white">
              {iframeLoading && (
                <div className="absolute inset-0 bg-[#030712] z-10 flex flex-col items-center justify-center gap-3">
                  <PayvoraSpinner size="lg" />
                  <p className="text-xs font-semibold text-slate-300">
                    Connecting to {activeWallName}...
                  </p>
                </div>
              )}
              <iframe
                id="offerwall-frame"
                src={activeWallUrl}
                title={activeWallName}
                onLoad={() => setIframeLoading(false)}
                className="w-full h-full border-0"
                allow="fullscreen"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TelegramModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      />
    </div>
  );
}
