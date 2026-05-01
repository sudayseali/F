import { Layers, Zap, Globe, Shield, Star, Play, Gift, ChevronRight, ArrowUpRight } from "lucide-react";
import React from "react";
import { motion } from "motion/react";

const PROVIDERS = [
  {
    id: "offertoro",
    name: "OfferToro",
    type: "Premium Multi-Offer",
    reward: "High",
    icon: Zap,
    color: "text-brand",
    bg: "bg-brand/10",
    border: "border-brand/20",
    desc: "Access a massive archive of mobile applications and web-based tasks."
  },
  {
    id: "adgate",
    name: "AdGate Media",
    type: "Surveys & Rewards",
    reward: "Variable",
    icon: Globe,
    color: "text-[#ff7638]",
    bg: "bg-[#ff7638]/10",
    border: "border-[#ff7638]/20",
    desc: "Market research protocols and interactive engagement modules."
  },
  {
    id: "lootably",
    name: "Lootably",
    type: "Video & Gaming",
    reward: "Stable",
    icon: Play,
    color: "text-brand",
    bg: "bg-brand/10",
    border: "border-brand/20",
    desc: "Sync your gaming activity and visual media consumption to the ledger."
  },
  {
    id: "cpalead",
    name: "CPALead",
    type: "Quick Actions",
    reward: "Instant",
    icon: Gift,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    desc: "Rapid response tasks and micro-conversion operations."
  },
  {
    id: "wannads",
    name: "Wannads",
    type: "International",
    reward: "Medium",
    icon: Star,
    color: "text-[#ff7638]",
    bg: "bg-[#ff7638]/10",
    border: "border-[#ff7638]/20",
    desc: "Globalized task distribution spanning multiple jurisdictions."
  },
  {
    id: "adscend",
    name: "Adscend Media",
    type: "Incentive Hub",
    reward: "Premium",
    icon: Shield,
    color: "text-brand",
    bg: "bg-brand/10",
    border: "border-brand/20",
    desc: "Authorized incentives for high-intent corporate operations."
  }
];

export function Offerwall() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12 pb-24"
    >
      <header className="text-center lg:text-left relative pt-4">
        <span className="inline-block px-4 py-1.5 rounded-full bg-[#1a0f0a] text-brand text-[10px] font-bold uppercase tracking-[0.3em] mb-6 border border-brand/20 shadow-inner">
          Ecosystem Portal
        </span>
        <h1 className="text-5xl lg:text-6xl font-serif font-bold text-white tracking-tight mb-6">
          Global <span className="font-light italic text-white/50">Offerwall</span>
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
        <div className="absolute -inset-1 bg-gradient-to-r from-brand/30 to-[#ff7638]/30 rounded-[3rem] blur-2xl opacity-40 group-hover:opacity-60 transition duration-1000" />
        <div className="relative premium-card overflow-hidden !p-12 !rounded-[2.5rem] border-white/10 flex flex-col justify-center bg-gradient-to-br from-[#1a0f0a] to-[#0a0502]">
          <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-brand/5 to-transparent pointer-events-none" />
          <div className="absolute top-0 right-10 p-12 opacity-5 group-hover:scale-110 transition-transform duration-1000">
            <Layers className="w-64 h-64 -rotate-12 text-brand" />
          </div>
          <div className="relative z-10 max-w-xl">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-2 h-2 rounded-full bg-brand animate-ping" />
              <span className="text-[11px] font-bold text-brand uppercase tracking-[0.2em]">Active Multiplier: 2.5x</span>
            </div>
            <h2 className="text-4xl font-display font-black text-white mb-4">Prime Integration</h2>
            <p className="text-white/40 text-lg leading-relaxed mb-8 font-serif italic">
              Our highest paying network of the month is currently active. Yields are heavily boosted for all synchronized accounts.
            </p>
            <div className="flex items-center text-brand font-display font-bold text-sm tracking-[0.1em] uppercase group-hover:text-white transition-colors">
              Initialize Connection <ArrowUpRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Provider Grid */}
      <div className="space-y-8">
        <h3 className="text-3xl font-serif font-light text-white flex items-center">
          Available <span className="font-bold ml-2">Networks</span>
          <span className="ml-6 h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PROVIDERS.map((provider, i) => (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileHover={{ scale: 1.02 }}
              className="premium-card !p-8 !rounded-[2rem] border-white/5 flex items-center space-x-6 group cursor-pointer hover:border-brand/30 transition-all duration-500 bg-[#1a0f0a]/30"
            >
              <div className={`w-16 h-16 rounded-[1.2rem] ${provider.bg} ${provider.color} flex items-center justify-center border ${provider.border} group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 shrink-0 shadow-inner`}>
                <provider.icon className="w-8 h-8" />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xl font-display font-bold text-white group-hover:text-brand transition-colors truncate">
                    {provider.name}
                  </h4>
                  <span className="text-[10px] font-black bg-[#0a0502] text-white/50 px-3 py-1 rounded-xl border border-white/10 uppercase tracking-widest shadow-inner group-hover:border-brand/30 group-hover:text-brand transition-colors">
                    {provider.reward}
                  </span>
                </div>
                <p className="text-[10px] text-brand/70 font-bold uppercase tracking-[0.2em] mb-2">{provider.type}</p>
                <p className="text-white/40 text-sm line-clamp-2 font-serif italic leading-relaxed">{provider.desc}</p>
              </div>
              <div className="w-12 h-12 rounded-[1rem] bg-[#0a0502] border border-white/5 flex items-center justify-center text-white/30 group-hover:text-brand group-hover:border-brand/30 transition-colors shadow-inner">
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="pt-16 pb-8 text-center text-[10px] font-bold text-white/20 uppercase tracking-[0.5em] font-mono">
        Payvora Unified Proxy Protocol v3.0.0
      </div>
    </motion.div>
  );
}
