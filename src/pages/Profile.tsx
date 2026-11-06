import React from "react";
import { useTelegram } from "../contexts/TelegramContext";
import { Users, History, Settings, ExternalLink, ChevronRight, Gift, Shield, Check, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { tgHaptics, openTgLink } from "../lib/telegram";

import { ASSETS_3D } from "../lib/assets";

export function Profile() {
  const { user } = useTelegram();
  const navigate = useNavigate();
  const displayName = user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Cabdl";
  const initial = displayName.charAt(0).toUpperCase();

  const menuItems = [
    {
      label: "Invite Friends & Earn",
      subtitle: "Get a 10% lifetime bonus on referrals",
      icon3D: ASSETS_3D.giftPurple,
      iconColor: "bg-purple-500/15",
      action: () => navigate("/referrals")
    },
    {
      label: "Withdrawal History",
      subtitle: "View payout receipts and requests",
      icon3D: ASSETS_3D.walletCyan,
      iconColor: "bg-sky-500/15",
      action: () => navigate("/wallet")
    },
    {
      label: "Join Telegram Community",
      subtitle: "Official announcements, promos & bonuses",
      icon3D: ASSETS_3D.rocket,
      iconColor: "bg-sky-500/15",
      action: () => openTgLink("https://t.me/PayvoraCommunity")
    }
  ];

  return (
    <div className="space-y-4 pb-6">
      {/* Profile Card matching Screenshot */}
      <div className="card-glass-dark p-6 text-center relative overflow-hidden">
        <div className="absolute top-0 right-1/2 translate-x-1/2 w-40 h-40 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative inline-block mx-auto mb-3">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#0284c7] via-[#0088cc] to-[#38bdf8] flex items-center justify-center text-white text-2xl font-black shadow-xl ring-4 ring-white/10">
            {initial}
          </div>
          <div className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-[#10b981] border-2 border-[#030712] shadow-sm" />
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-1">
          <h2 className="text-lg font-bold text-white tracking-tight">{displayName}</h2>
          <div className="w-4 h-4 rounded-full bg-[#0088cc] flex items-center justify-center text-white shadow-sm">
            <Check className="w-2.5 h-2.5 stroke-[3.5]" />
          </div>
        </div>

        <p className="text-xs text-slate-400 mb-3">
          {user?.username ? `@${user.username}` : "Telegram Member"}
        </p>

        <div className="inline-flex items-center gap-2 bg-[#0c162e] border border-white/10 px-3.5 py-1.5 rounded-full text-xs text-slate-300 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
          <span>Telegram Verified Account</span>
        </div>
      </div>

      {/* Account Info Stats */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="card-glass-dark p-3.5 rounded-2xl">
          <div className="text-[11px] text-slate-400 font-medium mb-0.5">Account ID</div>
          <div className="text-xs font-mono font-bold text-white truncate">
            {user?.id || "789456123"}
          </div>
        </div>

        <div className="card-glass-dark p-3.5 rounded-2xl">
          <div className="text-[11px] text-slate-400 font-medium mb-0.5">Account Status</div>
          <div className="text-xs font-bold text-emerald-400">
            Active · Verified
          </div>
        </div>
      </div>

      {/* Menu Items List */}
      <div className="card-glass-dark divide-y divide-white/5 overflow-hidden rounded-2xl">
        {menuItems.map((item) => {
          return (
            <div
              key={item.label}
              onClick={() => {
                tgHaptics.impact("light");
                item.action();
              }}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition active:bg-white/10"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.iconColor} border border-white/5 overflow-hidden`}>
                  <img
                    src={item.icon3D}
                    alt={item.label}
                    className="w-7 h-7 object-contain drop-shadow-sm"
                  />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{item.label}</div>
                  <div className="text-[11px] text-slate-400">{item.subtitle}</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
