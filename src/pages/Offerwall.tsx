import {
  Layers, Zap, Shield, Play, Gift,
  ChevronRight, ArrowLeft, ExternalLink, RotateCw, Sparkles, BarChart3
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTelegram } from "../contexts/TelegramContext";
import { invokeEdgeFunction } from "../lib/supabase";
import { tgHaptics, tgBackButton, openTgLink } from "../lib/telegram";
import { TelegramModal } from "../components/TelegramModal";
import { PayvoraSpinner } from "../components";
import { ASSETS_3D } from "../lib/assets";
import { APP_CONFIG } from "../config/appConfig";
import type { Provider } from "../types";

const PROVIDERS: Provider[] = [
  {
    id: "cpx",
    name: "CPX Research",
    category: "Surveys",
    rewardType: "Instant Credit",
    icon3D: ASSETS_3D.surveyPencil,
    icon: BarChart3,
    iconBg: "bg-sky-500/15",
    iconColor: "text-[#38bdf8]",
    badge: "Most Popular",
    badgeType: "blue",
    description: "Paid market research surveys",
    payoutRange: "$0.40 - $4.50 · Instant Credit"
  },
  {
    id: "ayet",
    name: "ayeT - Studios",
    category: "Games",
    rewardType: "High Payouts",
    icon3D: ASSETS_3D.gameController,
    icon: Play,
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    badge: "Top Rewards",
    badgeType: "green",
    description: "Level progression & gaming",
    payoutRange: "$1.00 - $35.00 · High Payouts"
  },
  {
    id: "torox",
    name: "Torox",
    category: "Games",
    rewardType: "Tiered Offers",
    icon3D: ASSETS_3D.trophy,
    icon: Zap,
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-400",
    badge: "Fast Track",
    badgeType: "hot",
    description: "Multi-stage game achievements",
    payoutRange: "$0.80 - $22.00 · Tiered Offers"
  },
  {
    id: "lootably",
    name: "Lootably",
    category: "Apps",
    rewardType: "Interactive",
    icon3D: ASSETS_3D.shieldVerified,
    icon: Shield,
    iconBg: "bg-cyan-500/15",
    iconColor: "text-cyan-400",
    badge: "Verified",
    badgeType: "green",
    description: "Engage with mobile apps & quizzes",
    payoutRange: "$0.25 - $8.00 · Interactive"
  },
  {
    id: "adgate",
    name: "AdGate Media",
    category: "Apps",
    rewardType: "Discovery",
    icon3D: ASSETS_3D.mobileApps,
    icon: Layers,
    iconBg: "bg-purple-500/15",
    iconColor: "text-[#c084fc]",
    badge: "Global",
    badgeType: "blue",
    description: "Wide variety of offers",
    payoutRange: "$0.30 - $12.00 · Discovery"
  },
  {
    id: "cpa",
    name: "CPA Rapid Offers",
    category: "Quick",
    rewardType: "Micro-Tasks",
    icon3D: ASSETS_3D.giftBox,
    icon: Gift,
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-400",
    badge: "Instant",
    badgeType: "hot",
    description: "Fast email submissions",
    payoutRange: "$0.15 - $2.50 · Micro-Tasks"
  }
];

const CATEGORY_TABS = ["All", "Surveys", "Games", "Apps", "Quick"];

export function Offerwall() {
  const { user } = useTelegram();
  const [activeTab, setActiveTab] = useState("All");
  const [activeOfferwallUrl, setActiveOfferwallUrl] = useState<string | null>(null);
  const [activeProviderName, setActiveProviderName] = useState<string>("");
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [iframeLoading, setIframeLoading] = useState(true);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "info" | "error" | "success";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });

  useEffect(() => {
    if (activeOfferwallUrl) {
      const handleBack = () => {
        closeOfferwall();
      };
      tgBackButton.show(handleBack);
      return () => {
        tgBackButton.hide(handleBack);
      };
    } else {
      tgBackButton.hide();
    }
  }, [activeOfferwallUrl]);

  const closeOfferwall = () => {
    tgHaptics.impact("light");
    setActiveOfferwallUrl(null);
    setActiveProviderName("");
    setIframeLoading(true);
  };

  const handleProviderClick = async (provider: Provider) => {
    tgHaptics.impact("medium");

    if (!user?.uuid) {
      setModalState({
        isOpen: true,
        title: "Authentication Required",
        message: `Please open Payvora via @${APP_CONFIG.telegram.botUsername} so your rewards are credited to your verified account.`,
        type: "error"
      });
      return;
    }

    const verifiedUserUuid = encodeURIComponent(user.uuid);

    if (provider.id === "cpx" || provider.id === "cpa") {
      setLoadingProvider(provider.id);
      try {
        const res = await invokeEdgeFunction<{ url?: string }>("get_cpx_url", {});
        let urlToUse = res?.url;
        if (!urlToUse) {
          throw new Error("Could not generate a signed offerwall session URL.");
        }
        if (provider.id === "cpa") {
          urlToUse += `&subid_1=${encodeURIComponent(provider.id)}`;
        }
        setActiveProviderName(provider.name);
        setActiveOfferwallUrl(urlToUse);
        setIframeLoading(true);
      } catch (err: any) {
        setModalState({
          isOpen: true,
          title: provider.name,
          message: err?.message || "Unable to load offers. Please try again in a moment.",
          type: "error"
        });
      } finally {
        setLoadingProvider(null);
      }
      return;
    }

    if (provider.id === "ayet") {
      const ayetUrl = `${APP_CONFIG.offerwalls.ayet.baseUrl}?external_identifier=${verifiedUserUuid}`;
      setActiveProviderName("ayeT-Studios");
      setActiveOfferwallUrl(ayetUrl);
      setIframeLoading(true);
    } else if (provider.id === "torox") {
      const toroxUrl = `${APP_CONFIG.offerwalls.torox.baseUrl}?pub_id=${APP_CONFIG.offerwalls.torox.pubId}&user_id=${verifiedUserUuid}`;
      setActiveProviderName("Torox Offers");
      setActiveOfferwallUrl(toroxUrl);
      setIframeLoading(true);
    } else if (provider.id === "adgate") {
      const adgateUrl = `https://wall.adgaterewards.com/naPR/${verifiedUserUuid}`;
      setActiveProviderName("AdGate Media");
      setActiveOfferwallUrl(adgateUrl);
      setIframeLoading(true);
    } else if (provider.id === "lootably") {
      const lootablyUrl = `https://wall.lootably.com/?placementID=24128&sid=${verifiedUserUuid}`;
      setActiveProviderName("Lootably");
      setActiveOfferwallUrl(lootablyUrl);
      setIframeLoading(true);
    }
  };

  const filteredProviders = PROVIDERS.filter(p => {
    if (activeTab === "All") return true;
    return p.category.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <div className="space-y-4 pb-6">
      {/* Hero Banner */}
      <div className="hero-balance-card p-4.5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between mb-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-sky-200 border border-white/10">
            <Sparkles className="w-3 h-3 text-sky-300" />
            <span>Verified Postbacks</span>
          </div>
          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
            Active 24/7
          </span>
        </div>

        <h2 className="text-xl font-black text-white tracking-tight">
          Partner Offerwalls
        </h2>
        <p className="text-xs text-sky-100/80 mt-1 max-w-sm">
          Complete high-paying surveys, try new mobile games, and earn direct token credits.
        </p>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORY_TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => {
                tgHaptics.selection();
                setActiveTab(tab);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 active:scale-95 ${
                isActive
                  ? "bg-[#0284c7] text-white shadow-md shadow-sky-500/30"
                  : "bg-[#0c162e] text-slate-400 hover:text-white border border-white/5"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Providers List */}
      <div className="space-y-2.5">
        {filteredProviders.map((provider) => {
          const Icon = provider.icon;
          const isLoading = loadingProvider === provider.id;

          return (
            <motion.div
              key={provider.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleProviderClick(provider)}
              className="card-glass-dark p-3.5 flex items-center gap-3.5 cursor-pointer hover:border-sky-500/40 transition-all duration-200 group active:bg-[#0f1d3d]"
            >
              <div className={`w-11 h-11 rounded-xl ${provider.iconBg} flex items-center justify-center shrink-0 border border-white/10 shadow-sm overflow-hidden`}>
                {isLoading ? (
                  <PayvoraSpinner size="sm" />
                ) : provider.icon3D ? (
                  <img
                    src={provider.icon3D}
                    alt={provider.name}
                    className="w-8 h-8 object-contain drop-shadow-sm"
                  />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-[#38bdf8] transition-colors">
                    {provider.name}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    provider.badgeType === "hot" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                    provider.badgeType === "green" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                    "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                  }`}>
                    {provider.badge}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 truncate">
                  {provider.description}
                </p>

                <div className="mt-1 text-xs font-semibold text-emerald-400 tabular-nums">
                  {provider.payoutRange}
                </div>
              </div>

              <div className="shrink-0">
                <div className="w-8 h-8 rounded-xl bg-white/5 group-hover:bg-[#0284c7]/20 group-hover:text-[#38bdf8] text-slate-400 flex items-center justify-center transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* In-App Offerwall Viewer Modal */}
      <AnimatePresence>
        {activeOfferwallUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-[#030712] flex flex-col"
          >
            <div className="h-12 bg-[#0c162e] border-b border-white/10 px-3 flex items-center justify-between shrink-0">
              <button
                onClick={closeOfferwall}
                className="flex items-center gap-1.5 text-xs font-bold text-[#38bdf8] active:opacity-70 py-1.5 px-2 rounded-lg"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <div className="text-xs font-bold text-white truncate max-w-[150px]">
                {activeProviderName}
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    tgHaptics.impact("light");
                    setIframeLoading(true);
                    const iframe = document.getElementById("offerwall-frame") as HTMLIFrameElement;
                    if (iframe) iframe.src = activeOfferwallUrl;
                  }}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg active:scale-95"
                  title="Reload"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openTgLink(activeOfferwallUrl)}
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
                  <p className="text-xs font-semibold text-slate-300">Connecting to {activeProviderName}...</p>
                </div>
              )}
              <iframe
                id="offerwall-frame"
                src={activeOfferwallUrl}
                title={activeProviderName}
                onLoad={() => setIframeLoading(false)}
                className="w-full h-full border-0"
                allow="camera; microphone; geolocation; fullscreen"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TelegramModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      />
    </div>
  );
}
