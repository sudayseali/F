import React from "react";
import { useTelegram } from "../contexts/TelegramContext";
import { Users, History, Settings, LogOut, ChevronRight, Gift, Shield, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";

export function Profile() {
  const { user, isAdmin } = useTelegram();
  const navigate = useNavigate();
  const displayName = user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12 pb-24"
    >
      <header className="flex flex-col items-center justify-center text-center pt-8">
        <div className="relative group perspective">
          <div className="absolute -inset-2 bg-gradient-to-br from-brand/40 via-brand text-transparent to-[#ff7638]/40 rounded-[3rem] blur-2xl opacity-40 group-hover:opacity-70 transition duration-1000"></div>
          <div className="relative w-40 h-40 rounded-[2.5rem] bg-gradient-to-b from-[#1a0f0a] to-[#0a0502] text-brand flex items-center justify-center font-display font-black text-6xl border border-white/10 shadow-inner mb-8 transform group-hover:-translate-y-2 transition-transform duration-700">
            {initial}
            <div className="absolute inset-0 rounded-[2.5rem] border border-white/5 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
          </div>
          {isAdmin && (
            <div className="absolute -bottom-4 -right-4 bg-[#1a0f0a] border border-white/10 p-1.5 rounded-2xl shadow-2xl">
              <div className="bg-brand text-white p-3 rounded-xl shadow-inner flex items-center space-x-2">
                <Shield className="w-5 h-5" />
              </div>
            </div>
          )}
        </div>
        
        <h1 className="text-5xl lg:text-6xl font-serif font-bold text-white tracking-tight mb-2 drop-shadow-md">
          {displayName}
        </h1>
        
        <div className="flex items-center space-x-4 mt-4 bg-white/[0.02] py-2 px-6 rounded-full border border-white/5 backdrop-blur-md">
          <CheckCircle className="w-4 h-4 text-emerald-500" />
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em]">
            Identity Verified
          </span>
          <div className="w-1 h-1 rounded-full bg-white/20" />
          <span className="text-sm font-mono text-brand font-medium tracking-widest">
            ID: {user?.id?.toString().slice(-6) || "000000"}
          </span>
        </div>
      </header>

      {!isAdmin && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative premium-card bg-gradient-to-br from-[#1a0f0a] to-[#0a0502] border-brand/20 !p-10 !rounded-[2.5rem] overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-brand/5 to-transparent pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-start gap-8 relative z-10">
            <div className="w-16 h-16 rounded-[1.2rem] bg-brand/5 flex items-center justify-center text-brand shrink-0 border border-brand/10 shadow-inner">
              <Shield className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-2xl font-display font-bold text-white mb-3">Administrative Node</h3>
              <p className="text-white/40 text-base leading-relaxed font-serif italic mb-6 max-w-2xl">
                To access the ecosystem management console and elevate your privileges, initialize your identity in the database environment parameters.
              </p>
              <div className="bg-[#0a0502]/80 rounded-[1.5rem] p-6 border border-white/5 overflow-hidden shadow-inner flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] text-brand/60 font-bold uppercase tracking-[0.2em] mb-2">Access Variable Requirement</p>
                  <code className="text-sm text-white/60 font-mono break-all select-all">
                    VITE_ADMIN_TELEGRAM_ID={user?.id}
                  </code>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="space-y-4">
        <h3 className="text-3xl font-serif font-light text-white flex items-center mb-6 pl-2">
          Ecosystem <span className="font-bold ml-2">Protocols</span>
          <span className="ml-6 h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
        </h3>

        {[
          {
            label: "Affiliate Network",
            desc: "Access your 10% perpetual commission stream",
            icon: Gift,
            color: "text-[#ff7638]",
            bg: "bg-[#ff7638]/5",
            border: "border-[#ff7638]/20",
            path: "/referrals"
          },
          {
            label: "Security Settings",
            desc: "Manage authentication and encrypted sessions",
            icon: Settings,
            color: "text-white/30",
            bg: "bg-white/[0.02]",
            border: "border-white/5",
            disabled: true
          }
        ].map((item, i) => (
          <motion.div 
            key={item.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => !item.disabled && navigate(item.path || "/")}
            className={`premium-card !p-8 !rounded-[2rem] flex flex-col sm:flex-row sm:items-center justify-between cursor-pointer transition-all duration-500 group ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-brand/40 bg-[#1a0f0a]/30'}`}
          >
            <div className="flex items-center space-x-6 mb-4 sm:mb-0">
              <div className={`w-16 h-16 rounded-[1.2rem] ${item.bg} ${item.color} flex items-center justify-center border ${item.border} group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500 shadow-inner`}>
                <item.icon className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-display font-bold text-white group-hover:text-brand transition-colors tracking-tight">{item.label}</h3>
                <p className="text-sm text-white/40 font-serif italic">{item.desc}</p>
              </div>
            </div>
            {!item.disabled && (
              <div className="w-12 h-12 rounded-[1rem] bg-[#0a0502] border border-white/5 flex items-center justify-center text-white/30 group-hover:text-brand transition-colors group-hover:translate-x-2 duration-500 shadow-inner">
                <ChevronRight className="w-6 h-6" />
              </div>
            )}
          </motion.div>
        ))}
      </div>
      
      <div className="pt-16 pb-8 flex justify-center">
        <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.5em] font-mono">
          Payvora v3.0.0 • Enterprise Edition
        </p>
      </div>
    </motion.div>
  );
}
