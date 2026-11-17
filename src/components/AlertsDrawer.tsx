import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  X,
  Users,
  CheckSquare,
  Gift,
  Send,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import {
  useAlerts,
  type AlertPreferences,
} from "../contexts/AlertsContext";
import { tgHaptics, openTgLink } from "../lib/telegram";
import { APP_CONFIG } from "../config/appConfig";

export function AlertsDrawer() {
  const {
    prefs,
    savingPrefs,
    isDrawerOpen,
    closeAlertsDrawer,
    updatePrefs,
  } = useAlerts();
  const prefersReducedMotion = useReducedMotion();

  const prefRows: {
    key: keyof AlertPreferences;
    title: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }[] = [
    {
      key: "telegram_push",
      title: "Telegram Bot Chat Alerts",
      desc: "Receive all notifications directly inside @PayvoraBot chat",
      icon: Send,
      accent: "bg-sky-500/15 text-sky-300 border-sky-500/25",
    },
    {
      key: "referral",
      title: "Referral Alerts",
      desc: "Bot chat alert when friends join or earn 10% commission",
      icon: Users,
      accent: "bg-purple-500/15 text-purple-300 border-purple-500/25",
    },
    {
      key: "task",
      title: "Task Alerts",
      desc: "Bot chat alerts for new tasks, submissions & approvals",
      icon: CheckSquare,
      accent: "bg-amber-500/15 text-amber-300 border-amber-500/25",
    },
    {
      key: "offer",
      title: "Offers & Survey Alerts",
      desc: "Bot chat alerts when offerwall & survey rewards credit",
      icon: Gift,
      accent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    },
  ];

  return (
    <AnimatePresence>
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeAlertsDrawer}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Sheet Container */}
          <motion.div
            initial={prefersReducedMotion ? false : { y: "100%", opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { y: "100%", opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Bot Chat Notifications Settings"
            className="relative z-10 w-full max-w-md max-h-[84dvh] bg-[#060c1a] border-t sm:border border-white/[0.1] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-white/[0.07] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/25 flex items-center justify-center text-[#38bdf8]">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h2
                    className="text-base font-extrabold text-white tracking-tight"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Bot Chat Notifications
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Delivered directly inside @{APP_CONFIG.telegram.botUsername}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeAlertsDrawer}
                aria-label="Close bot notification settings"
                className="min-h-[36px] min-w-[36px] rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-slate-300 cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Settings Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-[#38bdf8] shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  All Payvora notifications (tasks, offers, referrals, daily check-in, and withdrawals) are delivered directly in your <span className="font-semibold text-white">@{APP_CONFIG.telegram.botUsername}</span> Telegram chat.
                </p>
              </div>

              {prefRows.map((row) => {
                const Icon = row.icon;
                const enabled = prefs[row.key];
                return (
                  <div
                    key={row.key}
                    className="card-glass-dark p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${row.accent}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{row.title}</p>
                        <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                          {row.desc}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      aria-label={row.title}
                      disabled={savingPrefs}
                      onClick={() => updatePrefs({ [row.key]: !enabled })}
                      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors cursor-pointer ${
                        enabled
                          ? "bg-[#0284c7] border-sky-400/50"
                          : "bg-slate-800 border-white/10"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                          enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  tgHaptics.impact("light");
                  closeAlertsDrawer();
                  openTgLink(APP_CONFIG.telegram.botUrl);
                }}
                className="w-full py-3 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-xs font-extrabold text-[#38bdf8] flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Open @{APP_CONFIG.telegram.botUsername} Chat</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
