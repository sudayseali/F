import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, Layers, Wallet, User as UserIcon, Coins, Sparkles } from "lucide-react";
import { useTelegram } from "../contexts/TelegramContext";
import { tgHaptics } from "../lib/telegram";

const navItems = [
  { label: "Home", icon: LayoutDashboard, path: "/" },
  { label: "Offers", icon: Layers, path: "/offerwall" },
  { label: "Tasks", icon: CheckSquare, path: "/tasks" },
  { label: "Wallet", icon: Wallet, path: "/wallet" },
  { label: "Profile", icon: UserIcon, path: "/profile" },
];

export function Navigation() {
  const location = useLocation();
  const { user } = useTelegram();
  const displayName = user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Payvora User";
  const initial = displayName.charAt(0).toUpperCase();
  const balance = user?.balance ?? 0;

  const handleTabClick = () => {
    tgHaptics.selection();
  };

  return (
    <>
      {/* Telegram Native Top App Bar */}
      <header className="sticky top-0 left-0 right-0 z-40 bg-[#0e1621]/95 backdrop-blur-md border-b border-white/[0.08] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Telegram User Avatar */}
          <Link to="/profile" onClick={handleTabClick} className="relative group">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#2481cc] to-[#1a6cb3] flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white/10 group-active:scale-95 transition-transform">
              {initial}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0e1621]" />
          </Link>

          {/* User Details */}
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white max-w-[120px] sm:max-w-[180px] truncate">
                {displayName}
              </span>
              <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#2481cc] text-[9px] text-white">
                ✓
              </span>
            </div>
            <span className="text-[11px] text-[#7e8c9b]">
              {user?.username ? `@${user.username}` : "Telegram Member"}
            </span>
          </div>
        </div>

        {/* Telegram Coin / Balance Pill */}
        <Link
          to="/wallet"
          onClick={handleTabClick}
          className="flex items-center gap-2 bg-[#17212b] border border-white/10 px-3 py-1.5 rounded-full shadow-sm hover:border-[#2481cc]/40 transition active:scale-95"
        >
          <div className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-400 flex items-center justify-center">
            <Coins className="w-3.5 h-3.5" />
          </div>
          <div className="text-right">
            <div className="text-xs font-bold text-white tabular-nums">
              ${balance.toFixed(2)}
            </div>
          </div>
        </Link>
      </header>

      {/* Telegram Native Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#17212b]/95 backdrop-blur-xl border-t border-white/[0.08] pb-safe pt-1.5 px-2">
        <div className="max-w-md mx-auto grid grid-cols-5 items-center">
          {navItems.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={handleTabClick}
                className={`relative flex flex-col items-center justify-center py-1 transition-all duration-200 active:scale-90 ${
                  isActive ? "text-[#2481cc]" : "text-[#7e8c9b] hover:text-white/80"
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-6 h-6 transition-transform duration-200 ${
                      isActive ? "scale-110 drop-shadow-[0_2px_8px_rgba(36,129,204,0.6)]" : ""
                    }`}
                  />
                  {isActive && (
                    <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#2481cc]" />
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1 font-medium tracking-tight ${
                    isActive ? "font-semibold text-white" : "text-[#7e8c9b]"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
