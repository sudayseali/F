import { Outlet, useNavigate } from "react-router-dom";
import { Navigation } from "./Navigation";
import { AlertsDrawer } from "./AlertsDrawer";
import { useTelegram } from "../contexts/TelegramContext";
import { useAlerts } from "../contexts/AlertsContext";
import { AlertTriangle, Bell, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export function Layout() {
  const { authError } = useTelegram();
  const { liveToast, dismissToast, openAlertsDrawer, markAsRead } = useAlerts();
  const navigate = useNavigate();

  const handleToastClick = () => {
    if (!liveToast) return;
    const url = liveToast.action_url;
    const id = liveToast.id;
    dismissToast();
    markAsRead(id);
    if (url) {
      navigate(url);
    } else {
      openAlertsDrawer("inbox");
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-[#f8fafc] flex flex-col items-center relative overflow-x-hidden">
      {/* Background radial glows */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[350px] h-[350px] bg-sky-600/15 rounded-full blur-[100px]" />
        <div className="absolute top-[40%] right-0 w-[300px] h-[300px] bg-purple-600/15 rounded-full blur-[110px]" />
        <div className="absolute bottom-10 left-0 w-[280px] h-[280px] bg-blue-600/10 rounded-full blur-[90px]" />
      </div>

      <div className="w-full max-w-md min-h-screen flex flex-col bg-[#030712] relative shadow-2xl">
        <Navigation />

        {/* Live Foreground Realtime Alert Toast */}
        <AnimatePresence>
          {liveToast && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="mx-4 mt-2 p-3 rounded-2xl bg-[#0c162e]/95 border border-sky-400/35 shadow-xl flex items-start gap-2.5 backdrop-blur-md"
            >
              <button
                type="button"
                onClick={handleToastClick}
                className="flex-1 flex items-start gap-2.5 text-left min-w-0 cursor-pointer"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-[#38bdf8] shrink-0">
                  <Bell className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white truncate">
                      {liveToast.title}
                    </span>
                    {typeof liveToast.amount === "number" && liveToast.amount > 0 && (
                      <span className="text-[11px] font-extrabold text-[#34d399] tabular-nums shrink-0">
                        +${liveToast.amount.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5">
                    {liveToast.message}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={dismissToast}
                aria-label="Dismiss alert"
                className="p-1 text-slate-400 hover:text-white cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {authError && (
          <div className="mx-4 mt-2 p-3 bg-red-500/15 border border-red-500/30 rounded-xl text-red-200 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <div className="flex-1">
              <span className="font-semibold block">Authentication Required</span>
              <span>{authError}. Please restart from @PayvoraBot.</span>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 px-4 pt-3 pb-24 overflow-y-auto">
          <Outlet />
        </main>

        <AlertsDrawer />
      </div>
    </div>
  );
}
