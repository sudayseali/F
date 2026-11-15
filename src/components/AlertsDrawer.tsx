import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Bell,
  X,
  Users,
  CheckSquare,
  Gift,
  SlidersHorizontal,
  CheckCheck,
  Send,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import {
  useAlerts,
  type AlertCategory,
  type AlertPreferences,
  type UserNotification,
} from "../contexts/AlertsContext";
import { tgHaptics } from "../lib/telegram";
import { PayvoraSpinner } from "./PayvoraSpinner";

type FilterTab = "all" | "referral" | "task" | "offer";

function formatRelativeTime(isoDate: string): string {
  const ts = new Date(isoDate).getTime();
  if (!Number.isFinite(ts)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function getCategoryStyle(category: AlertCategory) {
  switch (category) {
    case "referral":
      return {
        icon: Users,
        bg: "bg-purple-500/15 border-purple-500/30 text-purple-300",
        label: "Referral",
      };
    case "task":
      return {
        icon: CheckSquare,
        bg: "bg-sky-500/15 border-sky-500/30 text-sky-300",
        label: "Task",
      };
    case "offer":
      return {
        icon: Gift,
        bg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
        label: "Offer",
      };
    default:
      return {
        icon: Bell,
        bg: "bg-slate-500/15 border-slate-500/30 text-slate-300",
        label: "System",
      };
  }
}

export function AlertsDrawer() {
  const {
    notifications,
    unreadCount,
    prefs,
    loading,
    savingPrefs,
    isDrawerOpen,
    drawerTab,
    setDrawerTab,
    closeAlertsDrawer,
    markAsRead,
    updatePrefs,
  } = useAlerts();
  const [filter, setFilter] = useState<FilterTab>("all");
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const filtered =
    filter === "all"
      ? notifications
      : notifications.filter((n) => n.category === filter);

  const handleNotificationTap = async (item: UserNotification) => {
    tgHaptics.impact("light");
    if (!item.is_read) {
      await markAsRead(item.id);
    }
    if (item.action_url) {
      closeAlertsDrawer();
      navigate(item.action_url);
    }
  };

  const prefRows: {
    key: keyof AlertPreferences;
    title: string;
    desc: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
  }[] = [
    {
      key: "referral",
      title: "Referral Alerts",
      desc: "Instant notice when friends join or earn 10% commission",
      icon: Users,
      accent: "bg-purple-500/15 text-purple-300 border-purple-500/25",
    },
    {
      key: "task",
      title: "Task Alerts",
      desc: "New high-paying task drops & submission approvals",
      icon: CheckSquare,
      accent: "bg-sky-500/15 text-sky-300 border-sky-500/25",
    },
    {
      key: "offer",
      title: "Offers Alerts",
      desc: "Real-time notifications when offerwall rewards credit",
      icon: Gift,
      accent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
    },
    {
      key: "telegram_push",
      title: "Telegram Bot DM Push",
      desc: "Deliver alerts directly inside @PayvoraBot chat",
      icon: Send,
      accent: "bg-amber-500/15 text-amber-300 border-amber-500/25",
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
            aria-label="Payvora Alerts Center"
            className="relative z-10 w-full max-w-md h-[84dvh] sm:h-[620px] bg-[#060c1a] border-t sm:border border-white/[0.1] rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 pt-4 pb-3 border-b border-white/[0.07] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-400/25 flex items-center justify-center text-[#38bdf8]">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <h2
                    className="text-base font-extrabold text-white tracking-tight"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    Alerts Center
                  </h2>
                  <p className="text-[11px] text-slate-400 tabular-nums">
                    {unreadCount > 0 ? `${unreadCount} unread updates` : "All caught up"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {drawerTab === "inbox" && unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      tgHaptics.impact("light");
                      markAsRead();
                    }}
                    className="min-h-[36px] px-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-[11px] font-semibold text-sky-300 flex items-center gap-1 cursor-pointer transition"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Read all</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    tgHaptics.selection();
                    setDrawerTab(drawerTab === "inbox" ? "prefs" : "inbox");
                  }}
                  aria-label="Toggle alert preferences"
                  className={`min-h-[36px] min-w-[36px] px-2.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition ${
                    drawerTab === "prefs"
                      ? "bg-[#0284c7] border-sky-400 text-white"
                      : "bg-white/[0.06] border-white/[0.08] text-slate-300 hover:bg-white/[0.1]"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Prefs</span>
                </button>

                <button
                  type="button"
                  onClick={closeAlertsDrawer}
                  aria-label="Close alerts center"
                  className="min-h-[36px] min-w-[36px] rounded-lg bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-slate-300 cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category Filter Bar (Inbox mode) */}
            {drawerTab === "inbox" && (
              <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-1.5 overflow-x-auto">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "referral", label: "Referrals" },
                    { id: "task", label: "Tasks" },
                    { id: "offer", label: "Offers" },
                  ] as { id: FilterTab; label: string }[]
                ).map((tab) => {
                  const active = filter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        tgHaptics.selection();
                        setFilter(tab.id);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                        active
                          ? "bg-[#0284c7] text-white shadow-md shadow-sky-500/20"
                          : "bg-white/[0.05] text-slate-400 hover:text-white border border-white/[0.06]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              {drawerTab === "prefs" ? (
                <div className="space-y-3 pt-1">
                  <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#38bdf8] shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Choose which instant alerts you receive inside Payvora and via <span className="font-semibold text-white">@PayvoraBot</span> Telegram messages.
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
                </div>
              ) : loading && notifications.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <PayvoraSpinner size="md" />
                  <span>Loading alerts...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-12 text-center space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto text-slate-500">
                    <Bell className="w-5 h-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-200">No alerts yet</p>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                    When friends join your link, new tasks launch, or offers credit your wallet, instant alerts appear here and in Telegram.
                  </p>
                </div>
              ) : (
                filtered.map((item) => {
                  const style = getCategoryStyle(item.category);
                  const Icon = style.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNotificationTap(item)}
                      className={`w-full text-left p-3.5 rounded-2xl border transition flex items-start gap-3 cursor-pointer active:scale-[0.99] ${
                        item.is_read
                          ? "bg-[#0c162e]/65 border-white/[0.06] hover:border-white/[0.12]"
                          : "bg-sky-500/[0.09] border-sky-400/30 hover:border-sky-400/50"
                      }`}
                    >
                      <div
                        className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${style.bg}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {!item.is_read && (
                              <span
                                aria-label="Unread"
                                className="w-2 h-2 rounded-full bg-[#38bdf8] shrink-0"
                              />
                            )}
                            <span className="text-xs font-bold text-white truncate">
                              {item.title}
                            </span>
                          </div>
                          {typeof item.amount === "number" && item.amount > 0 && (
                            <span className="text-[11px] font-extrabold text-[#34d399] tabular-nums shrink-0">
                              +${item.amount.toFixed(2)}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {item.message}
                        </p>

                        <div className="flex items-center justify-between pt-0.5 text-[10px] text-slate-500">
                          <span>
                            {style.label} · {formatRelativeTime(item.created_at)}
                          </span>
                          {item.action_url && (
                            <span className="text-sky-400 font-semibold inline-flex items-center gap-0.5">
                              <span>Open</span>
                              <ChevronRight className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
