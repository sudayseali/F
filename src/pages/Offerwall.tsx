import { Layers, Zap, Globe, Shield, Star, Play, Gift, ChevronRight, ArrowUpRight, ArrowLeft, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { motion } from "motion/react";
import { useTelegram } from "../contexts/TelegramContext";

const CATEGORIES = [
  {
    title: "🎮 Games",
    subtitle: "High Yield Tasks",
    providers: [
      {
        id: "ayet",
        name: "ayeT-Studios",
        type: "Level-Based Progression",
        reward: "High",
        icon: Play,
        color: "text-brand",
        bg: "bg-brand/10",
        border: "border-brand/20",
        desc: "Play games and reach specific levels to unlock massive rewards."
      },
      {
        id: "torox",
        name: "Torox",
        type: "Premium Gaming",
        reward: "Premium",
        icon: Zap,
        color: "text-[#ff7638]",
        bg: "bg-[#ff7638]/10",
        border: "border-[#ff7638]/20",
        desc: "Complete game objectives and milestones for high payouts."
      }
    ]
  },
  {
    title: "📱 Apps",
    subtitle: "App Discovery",
    providers: [
      {
        id: "adgate",
        name: "AdGate Media",
        type: "Engage & Earn",
        reward: "Variable",
        icon: Layers,
        color: "text-emerald-500",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        desc: "Download and interact with the latest mobile applications."
      },
      {
        id: "lootably",
        name: "Lootably",
        type: "Exploration",
        reward: "Stable",
        icon: Shield,
        color: "text-brand",
        bg: "bg-brand/10",
        border: "border-brand/20",
        desc: "Interactive app campaigns and engagement modules."
      }
    ]
  },
  {
    title: "📝 Surveys",
    subtitle: "Market Research",
    providers: [
      {
        id: "cpx",
        name: "CPX Research",
        type: "Dynamic Surveys",
        reward: "Consistent",
        icon: Star,
        color: "text-blue-500",
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        desc: "Share your opinion on global brands and get paid instantly."
      }
    ]
  },
  {
    title: "🌐 Sign-ups",
    subtitle: "Quick Actions",
    providers: [
      {
        id: "cpa",
        name: "CPA Offers",
        type: "Micro-Conversions",
        reward: "Instant",
        icon: Gift,
        color: "text-[#ff7638]",
        bg: "bg-[#ff7638]/10",
        border: "border-[#ff7638]/20",
        desc: "Simple registrations, email submits, and rapid response tasks."
      }
    ]
  }
];

export function Offerwall() {
  const { user } = useTelegram();
  const [activeOfferwall, setActiveOfferwall] = useState<string | null>(null);
  const [ayetData, setAyetData] = useState<any>(null);
  const [loadingAyet, setLoadingAyet] = useState(false);
  const [ayetError, setAyetError] = useState<string | null>(null);

  const handleProviderClick = async (providerId: string) => {
    if (!user?.id) {
      alert("User identification not found. Please re-open the app.");
      return;
    }

    if (providerId === "ayet") {
      setActiveOfferwall("ayet_api");
      setLoadingAyet(true);
      setAyetError(null);
      
      try {
        const res = await fetch(`https://www.ayetstudios.com/offers/offerwall_api/26815?external_identifier=${user.id}`);
        if (!res.ok) throw new Error("Failed to connect to Ayet Studios");
        
        const data = await res.json();
        if (data.status === 'success') {
          setAyetData(data);
        } else {
          setAyetError(data.error || "Failed to load offers from Ayet Studios.");
        }
      } catch (err: any) {
        setAyetError(err.message || "Network error while loading offers. Make sure CORS is supported or try again later.");
      } finally {
        setLoadingAyet(false);
      }
    } else if (providerId === "cpx") {
      const appId = import.meta.env.VITE_CPX_APP_ID || "1"; // Fallback to 1 or prompt for it
      const url = `https://offers.cpx-research.com/index.php?app_id=${appId}&ext_user_id=${user.id}`;
      setActiveOfferwall(url);
    } else {
      alert(`Provider ${providerId} setup logic coming soon.`);
    }
  };

  if (activeOfferwall === "ayet_api") {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed inset-0 z-[100] bg-[#0a0502] flex flex-col"
      >
        <div className="flex items-center p-4 border-b border-white/10 bg-[#1a0f0a]">
          <button 
            onClick={() => { setActiveOfferwall(null); setAyetData(null); }}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="flex-1 text-center font-bold text-white pr-10 text-lg tracking-wide">
            {ayetData?.offerwall?.name || 'Offerwall'}
          </span>
        </div>
        
        <div className="flex-1 overflow-y-auto w-full p-4 md:p-6 bg-[#0A0E1A]">
          {loadingAyet ? (
            <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
              <Loader2 className="w-8 h-8 text-brand animate-spin" />
              <p className="text-white/60 font-medium tracking-wide">Loading Offers...</p>
            </div>
          ) : ayetError ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center">
              <div className="w-16 h-16 rounded-full border border-red-500/30 flex items-center justify-center mb-4 bg-red-500/10">
                <Globe className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-red-400 font-medium mb-2">Error connecting to Ayet Studios</p>
              <p className="text-white/40 text-sm max-w-sm mx-auto">{ayetError}</p>
            </div>
          ) : ayetData?.offers?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center">
              <div className="w-16 h-16 rounded-[1.5rem] border border-white/5 flex items-center justify-center mb-4 bg-white/5">
                <Star className="w-8 h-8 text-white/30" />
              </div>
              <p className="text-white font-medium mb-1 tracking-wide">No Offers Available</p>
              <p className="text-white/40 text-sm">Check back later for more earning opportunities.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-7xl mx-auto pb-20">
              {ayetData?.offers?.map((offer: any, i: number) => (
                <a 
                  key={offer.id || i}
                  href={offer.tracking_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="premium-card !p-5 !rounded-[1.5rem] border-white/5 hover:border-brand/30 transition-all duration-300 flex flex-col group bg-white/[0.02]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-[1rem] overflow-hidden bg-white/10 shrink-0 border border-white/10 group-hover:scale-105 transition-transform duration-500">
                      {offer.icon ? (
                         <img src={offer.icon} alt={offer.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-brand/20">
                          <Gift className="w-6 h-6 text-brand" />
                        </div>
                      )}
                    </div>
                    <div className="bg-brand/10 border border-brand/20 px-3 py-1.5 rounded-full flex items-center space-x-1.5">
                      <Zap className="w-3.5 h-3.5 text-brand" />
                      <span className="text-brand font-bold text-sm">
                        +{offer.payout_currency} {ayetData?.offerwall?.currency_name_plural || 'Coins'}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className="text-white font-bold mb-2 line-clamp-1">{offer.name}</h3>
                  <p className="text-white/50 text-sm mb-4 line-clamp-2 min-h-[2.5rem]">
                    {offer.description || offer.instructions}
                  </p>
                  
                  <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between text-sm">
                    <span className="text-white/40 font-medium">Earn Reward</span>
                    <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-brand transition-colors group-hover:translate-x-1" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  if (activeOfferwall) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed inset-0 z-[100] bg-[#0a0502] flex flex-col"
      >
        <div className="flex items-center p-4 border-b border-white/10 bg-[#1a0f0a]">
          <button 
            onClick={() => setActiveOfferwall(null)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="flex-1 text-center font-bold text-white pr-10 text-lg tracking-wide">Offerwall</span>
        </div>
        <div className="flex-1 w-full bg-white relative">
          <iframe 
            src={activeOfferwall}
            title="Offerwall API"
            className="absolute inset-0 w-full h-full border-none"
            allow="fullscreen"
          />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12 pb-24"
    >
      <header className="text-center lg:text-left relative pt-4">
        <span className="inline-block px-4 py-1.5 rounded-full bg-[#111827] text-brand text-[10px] font-bold uppercase tracking-[0.3em] mb-6 border border-brand/20 shadow-inner">
          Task Matrix
        </span>
        <h1 className="text-5xl lg:text-6xl font-serif font-bold text-white tracking-tight mb-6 hidden md:block">
          Offer <span className="font-light italic text-white/50">Ecosystem</span>
        </h1>
        <h1 className="text-4xl font-serif font-bold text-white tracking-tight mb-6 md:hidden">
          Offers
        </h1>
        <p className="text-white/50 max-w-2xl text-lg font-serif">
          Connect to our network of global partners to access specialized reward streams and high-yield operations.
        </p>
      </header>

      {/* Featured Banner */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
        className="relative group cursor-pointer perspective"
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-brand/30 to-brand-light/30 rounded-[3rem] blur-2xl opacity-40 group-hover:opacity-60 transition duration-1000" />
        <div className="relative premium-card overflow-hidden !p-12 !rounded-[2.5rem] border-white/10 flex flex-col justify-center bg-gradient-to-br from-[#111827] to-[#0A0E1A]">
          <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-brand/5 to-transparent pointer-events-none" />
          <div className="absolute top-0 right-10 p-12 opacity-5 group-hover:scale-110 transition-transform duration-1000">
            <Globe className="w-64 h-64 -rotate-12 text-brand" />
          </div>
          <div className="relative z-10 max-w-xl">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-2 h-2 rounded-full bg-brand animate-ping" />
              <span className="text-[11px] font-bold text-brand uppercase tracking-[0.2em]">Secure Postback Enabled</span>
            </div>
            <h2 className="text-4xl font-display font-black text-white mb-4">Enterprise Tiers</h2>
            <p className="text-white/40 text-lg leading-relaxed mb-8 font-serif italic">
              All integrated offer networks utilize hashed server-to-server API callbacks to guarantee flawless crediting of your rewards.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Categories Grid */}
      <div className="space-y-16">
        {CATEGORIES.map((category, catIndex) => (
          <div key={category.title} className="space-y-8">
            <div className="flex items-end justify-between border-b border-white/5 pb-4">
              <div>
                <span className="block text-[10px] text-brand font-bold uppercase tracking-[0.2em] mb-2">{category.subtitle}</span>
                <h3 className="text-3xl font-display font-bold text-white">{category.title}</h3>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {category.providers.map((provider, i) => (
                <motion.div
                  key={provider.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + (i * 0.05) + (catIndex * 0.1) }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => handleProviderClick(provider.id)}
                  className="premium-card !p-8 !rounded-[2rem] border-white/5 flex items-center space-x-6 group cursor-pointer hover:border-brand/30 transition-all duration-500 bg-[#111827]/30"
                >
                  <div className={`w-16 h-16 rounded-[1.2rem] ${provider.bg} ${provider.color} flex items-center justify-center border ${provider.border} group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 shrink-0 shadow-inner`}>
                    <provider.icon className="w-8 h-8" />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xl font-display font-bold text-white group-hover:text-brand transition-colors truncate">
                        {provider.name}
                      </h4>
                      <span className="text-[10px] font-black bg-[#0A0E1A] text-white/50 px-3 py-1 rounded-xl border border-white/10 uppercase tracking-widest shadow-inner group-hover:border-brand/30 group-hover:text-brand transition-colors">
                        {provider.reward}
                      </span>
                    </div>
                    <p className="text-[10px] text-brand/70 font-bold uppercase tracking-[0.2em] mb-2">{provider.type}</p>
                    <p className="text-white/40 text-sm line-clamp-2 font-serif italic leading-relaxed">{provider.desc}</p>
                  </div>
                  <div className="w-12 h-12 rounded-[1rem] bg-[#0A0E1A] border border-white/5 flex items-center justify-center text-white/30 group-hover:text-brand group-hover:border-brand/30 transition-colors shadow-inner">
                    <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="pt-16 pb-8 text-center text-[10px] font-bold text-white/20 uppercase tracking-[0.5em] font-mono">
        Payvora Unified Proxy Protocol v3.0.0
      </div>
    </motion.div>
  );
}
