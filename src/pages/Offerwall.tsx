import { 
  Layers, Zap, Globe, Shield, Star, Play, Gift, 
  ChevronRight, ArrowLeft, Loader2, ExternalLink, RotateCw, Sparkles, BarChart3 
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTelegram } from "../contexts/TelegramContext";
import { supabase } from "../lib/supabase";
import { tgHaptics, tgBackButton, openTgLink } from "../lib/telegram";
import { TelegramModal } from "../components/TelegramModal";

interface Provider {
  id: string;
  name: string;
  category: string;
  rewardType: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  badge: string;
  badgeType: "hot" | "games" | "blue" | "green";
  description: string;
  payoutRange: string;
}

const PROVIDERS: Provider[] = [
  {
    id: "cpx",
    name: "CPX Research",
    category: "Surveys",
    rewardType: "Instant Crediting",
    icon: BarChart3,
    iconBg: "bg-sky-500/20",
    iconColor: "text-[#38bdf8]",
    badge: "🔥 Hot",
    badgeType: "hot",
    description: "Paid market research surveys with instant token payouts.",
    payoutRange: "Up to $4.50"
  },
  {
    id: "ayet",
    name: "ayeT - Studios",
    category: "Games",
    rewardType: "High Payouts",
    icon: Play,
    iconBg: "bg-purple-500/20",
    iconColor: "text-[#c084fc]",
    badge: "🎮 Games",
    badgeType: "games",
    description: "Level progression and gaming milestone rewards across iOS & Android.",
    payoutRange: "Up to $35.00"
  },
  {
    id: "torox",
    name: "Torox Offers",
    category: "Games",
    rewardType: "Tiered Offers",
    icon: Zap,
    iconBg: "bg-amber-500/20",
    iconColor: "text-[#fbbf24]",
    badge: "⚡ Fast Track",
    badgeType: "blue",
    description: "Multi-stage game achievements and premium brand trials.",
    payoutRange: "Up to $22.00"
  },
  {
    id: "lootably",
    name: "Lootably",
    category: "Apps",
    rewardType: "Interactive",
    icon: Shield,
    iconBg: "bg-cyan-500/20",
    iconColor: "text-[#22d3ee]",
    badge: "✓ Verified",
    badgeType: "green",
    description: "Engage with mobile apps, quiz tests, and interactive campaigns.",
    payoutRange: "Up to $8.00"
  },
  {
    id: "adgate",
    name: "AdGate Media",
    category: "Apps",
    rewardType: "Discovery",
    icon: Layers,
    iconBg: "bg-indigo-500/20",
    iconColor: "text-[#818cf8]",
    badge: "Global",
    badgeType: "blue",
    description: "Wide variety of global app installs, videos, and subscription offers.",
    payoutRange: "Up to $12.00"
  },
  {
    id: "cpa",
    name: "CPA Rapid Offers",
    category: "Quick",
    rewardType: "Micro-Tasks",
    icon: Gift,
    iconBg: "bg-rose-500/20",
    iconColor: "text-[#fb7185]",
    badge: "⚡ Instant",
    badgeType: "hot",
    description: "Fast email submissions, single-field signups, and rapid rewards.",
    payoutRange: "Up to $2.50"
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

  // Modal feedback state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "info" | "error" | "success";
    actionText?: string;
    onAction?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });

  // Handle Telegram Back Button when Offerwall is open
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
    const userId = user?.id || 123456789;

    if (provider.id === "cpx") {
      setLoadingProvider("cpx");
      try {
        let urlToUse: string | null = null;
        try {
          const { data, error } = await supabase.functions.invoke("get_cpx_url", {});
          if (!error && data?.url) {
            urlToUse = data.url;
          }
        } catch {
          // Fallback to direct link
        }

        if (!urlToUse) {
          const appId = import.meta.env.VITE_CPX_APP_ID || "24128";
          urlToUse = `https://offers.cpx-research.com/index.php?app_id=${appId}&ext_user_id=${userId}`;
        }

        setActiveProviderName("CPX Research");
        setActiveOfferwallUrl(urlToUse);
        setIframeLoading(true);
      } catch (err: any) {
        setModalState({
          isOpen: true,
          title: "CPX Research",
          message: "Unable to load surveys. Please check your network connection.",
          type: "error",
          actionText: "Understood"
        });
      } finally {
        setLoadingProvider(null);
      }
    } else if (provider.id === "ayet") {
      setLoadingProvider("ayet");
      const ayetUrl = `https://www.ayetstudios.com/offers/offerwall_api/26815?external_identifier=${userId}`;
      setActiveProviderName("ayeT-Studios");
      setActiveOfferwallUrl(ayetUrl);
      setIframeLoading(true);
      setLoadingProvider(null);
    } else if (provider.id === "torox") {
      setLoadingProvider("torox");
      const toroxUrl = `https://torox.io/offerwall?pub_id=1234&user_id=${userId}`;
      setActiveProviderName("Torox Offers");
      setActiveOfferwallUrl(toroxUrl);
      setIframeLoading(true);
      setLoadingProvider(null);
    } else {
      // General provider launcher
      const demoUrl = `https://offers.cpx-research.com/index.php?app_id=24128&ext_user_id=${userId}`;
      setActiveProviderName(provider.name);
      setActiveOfferwallUrl(demoUrl);
      setIframeLoading(true);
    }
  };

  const filteredProviders = PROVIDERS.filter(p => {
    if (activeTab === "All") return true;
    return p.category.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <div className="space-y-4 pb-6">
      {/* Telegram Hero Banner matching Screenshot */}
      <div className="hero-balance-card p-4.5 relative overflow-hidden flex items-center justify-between">
        <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none" />
        
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-sky-200 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Verified Offerwalls</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight">
            Partner Networks
          </h2>
          <p className="text-xs text-sky-100/80 mt-0.5 max-w-[240px]">
            High-yield surveys, gaming rewards, and instant token payouts.
          </p>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0 shadow-lg">
          <Layers className="w-6 h-6 text-sky-200" />
        </div>
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

      {/* Providers Grid / List */}
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
              {/* Provider Logo / Badge */}
              <div className={`w-11 h-11 rounded-xl ${provider.iconBg} ${provider.iconColor} flex items-center justify-center shrink-0 border border-white/10 shadow-sm`}>
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#38bdf8]" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>

              {/* Provider Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-[#38bdf8] transition-colors">
                    {provider.name}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    provider.badgeType === "hot" ? "badge-hot-pill" :
                    provider.badgeType === "games" ? "badge-games-pill" :
                    "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                  }`}>
                    {provider.badge}
                  </span>
                </div>
                
                <p className="text-[11px] text-slate-400 truncate">
                  {provider.description}
                </p>

                <div className="mt-1">
                  <span className="badge-green-pill text-[11px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                    <span>{provider.payoutRange}</span>
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="shrink-0">
                <div className="w-8 h-8 rounded-xl bg-white/5 group-hover:bg-[#0284c7]/20 group-hover:text-[#38bdf8] text-slate-400 flex items-center justify-center transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Telegram Mini App In-App Offerwall Viewer Modal */}
      <AnimatePresence>
        {activeOfferwallUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-[#030712] flex flex-col"
          >
            {/* Telegram In-App Top Bar */}
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

            {/* Iframe Container */}
            <div className="flex-1 relative bg-white">
              {iframeLoading && (
                <div className="absolute inset-0 bg-[#030712] z-10 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-[#38bdf8]" />
                  <p className="text-xs text-slate-400">Connecting to {activeProviderName}...</p>
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
