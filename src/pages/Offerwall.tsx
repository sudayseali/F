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
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    desc: "Access a massive archive of mobile applications and web-based tasks."
  },
  {
    id: "adgate",
    name: "AdGate Media",
    type: "Surveys & Rewards",
    reward: "Variable",
    icon: Globe,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    desc: "Market research protocols and interactive engagement modules."
  },
  {
    id: "lootably",
    name: "Lootably",
    type: "Video & Gaming",
    reward: "Stable",
    icon: Play,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
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
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    desc: "Globalized task distribution spanning multiple jurisdictions."
  },
  {
    id: "adscend",
    name: "Adscend Media",
    type: "Incentive Hub",
    reward: "Premium",
    icon: Shield,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
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
      <header className="text-center lg:text-left relative">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-brand/5 rounded-full blur-3xl -z-10" />
        <span className="inline-block px-3 py-1 rounded-full bg-brand/10 text-brand text-[10px] font-bold uppercase tracking-[0.2em] mb-4 border border-brand/20">
          Ecosystem Portal
        </span>
        <h1 className="text-4xl lg:text-5xl font-display font-bold text-white tracking-tight mb-4">
          Global Offerwall
        </h1>
        <p className="text-slate-400 max-w-xl text-balance">
          Connect to our network of global partners to access specialized reward streams and high-yield operations.
        </p>
      </header>

      {/* Featured Banner */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="relative group cursor-pointer"
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-brand to-emerald-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-30 transition duration-1000" />
        <div className="relative premium-card overflow-hidden !p-10 border-white/10 h-64 flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-1000">
            <Layers className="w-48 h-48 -rotate-12 text-white" />
          </div>
          <div className="relative z-10 max-w-md">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-brand animate-ping" />
              <span className="text-[10px] font-bold text-brand uppercase tracking-widest">Active Multiplier: 2.5x</span>
            </div>
            <h2 className="text-3xl font-display font-bold text-white mb-2">Prime Integration</h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-6">
              Our highest paying network of the month is currently active. Yields are currently boosted for all synchronized accounts.
            </p>
            <div className="flex items-center text-brand font-bold text-sm tracking-widest uppercase">
              Initialize Connection <ArrowUpRight className="w-4 h-4 ml-2" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Provider Grid */}
      <div className="space-y-6">
        <h3 className="text-2xl font-display font-bold text-white px-2 flex items-center">
          Available Networks
          <span className="ml-4 h-px flex-1 bg-white/5" />
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PROVIDERS.map((provider, i) => (
            <motion.div
              key={provider.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileHover={{ y: -5 }}
              className="premium-card p-6 border-white/5 flex items-center space-x-6 group cursor-pointer hover:border-brand/30 transition-all duration-300"
            >
              <div className={`w-16 h-16 rounded-2xl ${provider.bg} ${provider.color} flex items-center justify-center border ${provider.border} group-hover:scale-110 transition-transform duration-500 shrink-0 shadow-lg`}>
                <provider.icon className="w-8 h-8" />
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-lg font-bold text-white group-hover:text-brand transition-colors truncate">
                    {provider.name}
                  </h4>
                  <span className="text-[9px] font-black bg-brand/10 text-brand px-2 py-0.5 rounded-lg border border-brand/20 uppercase tracking-tighter">
                    {provider.reward}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-2">{provider.type}</p>
                <p className="text-slate-400 text-xs line-clamp-1">{provider.desc}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-500 group-hover:text-brand group-hover:translate-x-1 transition-all">
                <ChevronRight className="w-4 h-4" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="pt-12 text-center text-[10px] font-bold text-slate-600 uppercase tracking-[0.5em]">
        Payvora Unified Proxy Protocol v2.4.0
      </div>
    </motion.div>
  );
}
