import { 
  Layers, Zap, Globe, Shield, Star, Play, Gift, 
  ChevronRight, ArrowLeft, Loader2, ExternalLink, RotateCw, Sparkles 
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
  badgeColor: string;
  description: string;
  payoutRange: string;
}

const PROVIDERS: Provider[] = [
  {
    id: "cpx",
    name: "CPX Research",
    category: "Surveys",
    rewardType: "Instant Crediting",
    icon: Star,
    iconBg: "bg-blue-500/15",
    iconColor: "text-blue-400",
    badge: "Most Popular",
    badgeColor: "bg-blue-500/20 text-blue-300",
    description: "Paid market research surveys with instant token payouts upon completion.",
    payoutRange: "$0.40 - $4.50"
  },
  {
    id: "ayet",
    name: "ayeT-Studios",
    category: "Games",
    rewardType: "High Payouts",
    icon: Play,
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
    badge: "Top Rewards",
    badgeColor: "bg-emerald-500/20 text-emerald-300",
    description: "Level progression and gaming milestone rewards across iOS and Android.",
    payoutRange: "$1.00 - $35.00"
  },
  {
    id: "torox",
    name: "Torox",
    category: "Games",
    rewardType: "Tiered Offers",
    icon: Zap,
    iconBg: "bg-amber-500/15",
    iconColor: "text-amber-400",
    badge: "Fast Track",
    badgeColor: "bg-amber-500/20 text-amber-300",
    description: "Multi-stage game achievements and premium brand trials.",
    payoutRange: "$0.80 - $22.00"
  },
  {
    id: "lootably",
    name: "Lootably",
    category: "Apps",
    rewardType: "Interactive",
    icon: Shield,
    iconBg: "bg-cyan-500/15",
    iconColor: "text-cyan-400",
    badge: "Verified",
    badgeColor: "bg-cyan-500/20 text-cyan-300",
    description: "Engage with mobile apps, quiz tests, and interactive campaigns.",
    payoutRange: "$0.25 - $8.00"
  },
  {
    id: "adgate",
    name: "AdGate Media",
    category: "Apps",
    rewardType: "Discovery",
    icon: Layers,
    iconBg: "bg-purple-500/15",
    iconColor: "text-purple-400",
    badge: "Global",
    badgeColor: "bg-purple-500/20 text-purple-300",
    description: "Wide variety of global app installs, videos, and subscription offers.",
    payoutRange: "$0.30 - $12.00"
  },
  {
    id: "cpa",
    name: "CPA Rapid Offers",
    category: "Quick",
    rewardType: "Micro-Tasks",
    icon: Gift,
    iconBg: "bg-rose-500/15",
    iconColor: "text-rose-400",
    badge: "Instant",
    badgeColor: "bg-rose-500/20 text-rose-300",
    description: "Fast email submissions, single-field signups, and rapid rewards.",
    payoutRange: "$0.15 - $2.50"
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
        // First try the Edge function
        let urlToUse: string | null = null;
        try {
          const { data, error } = await supabase.functions.invoke("get_cpx_url", {});
          if (!error && data?.url) {
            urlToUse = data.url;
          }
        } catch {
          // Edge function failed or not deployed yet, proceed to robust fallback
        }

        // If Edge function didn't provide a URL, construct direct CPX link
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
      // General provider launching
      setModalState({
        isOpen: true,
        title: `${provider.name}`,
        message: `${provider.name} offerwall integration is active. Postback rewards will be credited automatically to your Payvora balance.`,
        type: "info",
        actionText: "Launch Offerwall",
        onAction: () => {
          setModalState(prev => ({ ...prev, isOpen: false }));
          const demoUrl = `https://offers.cpx-research.com/index.php?app_id=24128&ext_user_id=${userId}`;
          setActiveProviderName(provider.name);
          setActiveOfferwallUrl(demoUrl);
          setIframeLoading(true);
        }
      });
    }
  };

  const filteredProviders = PROVIDERS.filter(p => {
    if (activeTab === "All") return true;
    return p.category.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <div className="space-y-4 pb-6">
      {/* Telegram Banner Header */}
      <div className="relative rounded-2xl bg-gradient-to-br from-[#1c2a38] to-[#131d27] border border-white/10 p-4 overflow-hidden shadow-lg">
        <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-[#2481cc]/15 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2481cc]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Verified Postbacks</span>
          </div>
          <span className="text-[10px] bg-emerald-500/15 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20">
            Active 24/7
          </span>
        </div>

        <h2 className="text-lg font-bold text-white mb-1">
          Partner Offerwalls
        </h2>
        <p className="text-xs text-[#7e8c9b] leading-relaxed">
          Complete high-paying surveys, try new mobile games, and earn direct token credits.
        </p>
      </div>

      {/* Category Pills / Segmented Selector */}
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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 ${
                isActive
                  ? "bg-[#2481cc] text-white shadow-md shadow-[#2481cc]/30"
                  : "bg-[#17212b] text-[#7e8c9b] hover:text-white border border-white/5"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Providers Grouped List */}
      <div className="space-y-2.5">
        {filteredProviders.map((provider) => {
          const Icon = provider.icon;
          const isLoading = loadingProvider === provider.id;

          return (
            <motion.div
              key={provider.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleProviderClick(provider)}
              className="tg-card p-3.5 flex items-center gap-3.5 cursor-pointer hover:border-[#2481cc]/30 transition-all duration-200 group active:bg-[#1c2733]"
            >
              {/* Provider Logo / Badge */}
              <div className={`w-11 h-11 rounded-xl ${provider.iconBg} ${provider.iconColor} flex items-center justify-center shrink-0 border border-white/5 shadow-inner`}>
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-[#2481cc]" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>

              {/* Provider Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-bold text-white truncate group-hover:text-[#2481cc] transition-colors">
                    {provider.name}
                  </h3>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${provider.badgeColor}`}>
                    {provider.badge}
                  </span>
                </div>
                
                <p className="text-[11px] text-[#7e8c9b] truncate">
                  {provider.description}
                </p>

                <div className="flex items-center gap-2 mt-1 text-[10px] text-white/50">
                  <span className="text-emerald-400 font-semibold">{provider.payoutRange}</span>
                  <span>·</span>
                  <span>{provider.rewardType}</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="shrink-0">
                <div className="w-8 h-8 rounded-lg bg-white/5 group-hover:bg-[#2481cc]/20 group-hover:text-[#2481cc] text-[#7e8c9b] flex items-center justify-center transition-colors">
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
            className="fixed inset-0 z-50 bg-[#0e1621] flex flex-col"
          >
            {/* Telegram In-App Top Bar */}
            <div className="h-12 bg-[#17212b] border-b border-white/10 px-3 flex items-center justify-between shrink-0">
              <button
                onClick={closeOfferwall}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#2481cc] active:opacity-70 py-1.5 px-2 rounded-lg"
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
                  className="p-1.5 text-[#7e8c9b] hover:text-white rounded-lg active:scale-95"
                  title="Reload"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => openTgLink(activeOfferwallUrl)}
                  className="p-1.5 text-[#7e8c9b] hover:text-[#2481cc] rounded-lg active:scale-95"
                  title="Open in Browser"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Iframe Container */}
            <div className="flex-1 relative bg-white">
              {iframeLoading && (
                <div className="absolute inset-0 bg-[#0e1621] z-10 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-[#2481cc]" />
                  <p className="text-xs text-[#7e8c9b]">Connecting to {activeProviderName}...</p>
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

      {/* In-app Telegram Modal for feedback */}
      <TelegramModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        actionText={modalState.actionText || "OK"}
        onAction={modalState.onAction}
      />
    </div>
  );
}
