import React from "react";
import { useTelegram } from "../contexts/TelegramContext";
import { Users, History, Settings, LogOut, ChevronRight, Gift, Shield } from "lucide-react";
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
      className="space-y-10 pb-10"
    >
      <header className="flex flex-col items-center justify-center text-center">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-brand to-emerald-500 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative w-32 h-32 rounded-3xl bg-slate-900 text-brand flex items-center justify-center font-display font-black text-5xl border-2 border-white/5 shadow-2xl mb-6">
            {initial}
          </div>
          {isAdmin && (
            <div className="absolute -bottom-2 -right-2 bg-brand text-white p-2 rounded-xl shadow-lg border border-white/10">
              <Shield className="w-5 h-5" />
            </div>
          )}
        </div>
        
        <h1 className="text-4xl font-display font-bold text-white tracking-tighter mb-2">
          {displayName}
        </h1>
        
        <div className="flex items-center space-x-3">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">
            Identity Protocol
          </span>
          <span className="text-sm font-mono text-brand font-bold">
            #{user?.id?.toString().slice(-6) || "000000"}
          </span>
        </div>
      </header>

      {!isAdmin && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="premium-card bg-brand/5 border-brand/20 p-8"
        >
          <div className="flex items-start space-x-6">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center text-brand shrink-0 border border-brand/20">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-display font-bold text-white mb-2">Administrative Node</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-6">
                To access the ecosystem management console, initialize your identity in the database parameters.
              </p>
              <div className="bg-slate-950/50 rounded-2xl p-4 border border-white/5 mb-4 group overflow-hidden">
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Access Variable</p>
                <code className="text-xs text-brand font-mono break-all block">
                  VITE_ADMIN_TELEGRAM_ID={user?.id}
                </code>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {[
          {
            label: "Affiliate Network",
            desc: "Access your 10% commission stream",
            icon: Gift,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            border: "border-emerald-500/20",
            path: "/referrals"
          },
          {
            label: "Security Settings",
            desc: "Manage authentication and sessions",
            icon: Settings,
            color: "text-slate-400",
            bg: "bg-slate-800/50",
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
            className={`premium-card p-6 flex items-center justify-between cursor-pointer transition-all duration-300 group ${item.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-brand/40'}`}
          >
            <div className="flex items-center space-x-6">
              <div className={`w-14 h-14 rounded-2xl ${item.bg} ${item.color} flex items-center justify-center border ${item.border} group-hover:scale-110 transition-transform duration-500`}>
                <item.icon className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-brand transition-colors">{item.label}</h3>
                <p className="text-sm text-slate-500">{item.desc}</p>
              </div>
            </div>
            {!item.disabled && (
              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-500 group-hover:text-brand transition-colors group-hover:translate-x-1 duration-300">
                <ChevronRight className="w-5 h-5" />
              </div>
            )}
          </motion.div>
        ))}
      </div>
      
      <div className="pt-10 flex justify-center">
        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.5em]">
          Payvora v2.4.0 • Enterprise Edition
        </p>
      </div>
    </motion.div>
  );
}
