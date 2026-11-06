import React from "react";
import { useTelegram } from "../contexts/TelegramContext";
import { Users, History, Settings, ExternalLink, ChevronRight, Gift, Shield, CheckCircle, Send } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { tgHaptics, openTgLink } from "../lib/telegram";

export function Profile() {
  const { user } = useTelegram();
  const navigate = useNavigate();
  const displayName = user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Payvora Member";
  const initial = displayName.charAt(0).toUpperCase();

  const menuItems = [
    {
      label: "Invite Friends & Earn",
      subtitle: "Get 10% commission on referrals",
      icon: Users,
      iconColor: "text-purple-400 bg-purple-500/15",
      action: () => navigate("/referrals")
    },
    {
      label: "Withdrawal History",
      subtitle: "View transactions and receipts",
      icon: History,
      iconColor: "text-amber-400 bg-amber-500/15",
      action: () => navigate("/wallet")
    },
    {
      label: "Join Telegram Community",
      subtitle: "Official announcements and bonuses",
      icon: Send,
      iconColor: "text-[#2481cc] bg-[#2481cc]/15",
      action: () => openTgLink("https://t.me/PayvoraCommunity")
    }
  ];

  return (
    <div className="space-y-4 pb-6">
      {/* Profile Card */}
      <div className="tg-card p-5 text-center relative overflow-hidden">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#2481cc] to-[#1a6cb3] flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3 shadow-lg ring-4 ring-white/5">
          {initial}
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-1">
          <h2 className="text-base font-bold text-white">{displayName}</h2>
          <span className="w-3.5 h-3.5 rounded-full bg-[#2481cc] text-[9px] text-white flex items-center justify-center">
            ✓
          </span>
        </div>

        <p className="text-xs text-[#7e8c9b] mb-3">
          {user?.username ? `@${user.username}` : `Telegram ID: ${user?.id}`}
        </p>

        <div className="inline-flex items-center gap-2 bg-[#0e1621] border border-white/5 px-3 py-1.5 rounded-full text-[11px] text-[#7e8c9b]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Telegram Verified Account</span>
        </div>
      </div>

      {/* Account Info Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="tg-card p-3">
          <div className="text-[10px] text-[#7e8c9b] font-medium mb-0.5">Account ID</div>
          <div className="text-xs font-mono font-bold text-white truncate">
            {user?.id || "N/A"}
          </div>
        </div>

        <div className="tg-card p-3">
          <div className="text-[10px] text-[#7e8c9b] font-medium mb-0.5">Wallet Status</div>
          <div className="text-xs font-bold text-emerald-400">
            Active · Verified
          </div>
        </div>
      </div>

      {/* Menu Items List */}
      <div className="tg-card divide-y divide-white/5 overflow-hidden">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              onClick={() => {
                tgHaptics.impact("light");
                item.action();
              }}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition active:bg-white/10"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{item.label}</div>
                  <div className="text-[10px] text-[#7e8c9b]">{item.subtitle}</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#7e8c9b]" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
