import { Link, useLocation } from "react-router-dom";
import { CheckSquare, Layers, Wallet, User as UserIcon, Check, Home } from "lucide-react";
import { useTelegram } from "../contexts/TelegramContext";
import { tgHaptics } from "../lib/telegram";
import { ASSETS_3D } from "../lib/assets";

const navItems = [
  { label: "Home", icon: Home, path: "/" },
  { label: "Offers", icon: Layers, path: "/offerwall" },
  { label: "Tasks", icon: CheckSquare, path: "/tasks" },
  { label: "Wallet", icon: Wallet, path: "/wallet" },
  { label: "Profile", icon: UserIcon, path: "/profile" },
];

export function Navigation() {
  const location = useLocation();
  const { user } = useTelegram();
  const displayName = user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Cabdl";
  const initial = displayName.charAt(0).toUpperCase();
  const balance = user?.balance ?? 0;

  const handleTabClick = () => {
    tgHaptics.selection();
  };

  return (
    <>
      {/* Telegram Native Top App Bar matching Screenshot with 3D Coin Badge */}
      <header className="sticky top-0 left-0 right-0 z-40 bg-[#030712]/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-white/[0.06]">
        {/* Left: User Avatar & Name */}
        <div className="flex items-center gap-3">
          <Link to="/profile" onClick={handleTabClick} className="relative group">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#0284c7] via-[#0088cc] to-[#38bdf8] flex items-center justify-center text-white font-black text-base shadow-lg shadow-sky-500/30 group-active:scale-95 transition-transform">
              {initial}
            </div>
            {/* Green Online Dot at bottom-right */}
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#10b981] border-2 border-[#030712] shadow-sm" />
          </Link>

          {/* Name & Subtitle */}
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold text-white tracking-tight">
                {displayName}
              </span>
              {/* Telegram Verified Badge */}
              <div className="w-4 h-4 rounded-full bg-[#0088cc] flex items-center justify-center text-white shadow-sm">
                <Check className="w-2.5 h-2.5 stroke-[3.5]" />
              </div>
            </div>
            <span className="text-xs text-[#94a3b8] font-medium">
              Telegram Member
            </span>
          </div>
        </div>

        {/* Right: Golden 3D Coin Pill ($0.00) */}
        <Link
          to="/wallet"
          onClick={handleTabClick}
          className="flex items-center gap-1.5 bg-[#0c162e] border border-amber-500/40 pl-1.5 pr-3 py-1 rounded-full shadow-lg hover:border-amber-400 transition active:scale-95"
        >
          <img
            src={ASSETS_3D.starCoin}
            alt="3D Star Coin"
            className="w-5 h-5 object-contain drop-shadow-sm"
          />
          <span className="text-sm font-extrabold text-white tracking-tight tabular-nums">
            ${balance.toFixed(2)}
          </span>
        </Link>
      </header>

      {/* Telegram Native Bottom Navigation Bar matching Screenshot */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#050b18]/95 backdrop-blur-2xl border-t border-white/[0.08] pb-safe pt-2 px-2 shadow-2xl">
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
                  isActive ? "text-[#38bdf8]" : "text-[#64748b] hover:text-[#94a3b8]"
                }`}
              >
                <div className="relative flex flex-col items-center">
                  <Icon
                    className={`w-6 h-6 transition-transform duration-200 ${
                      isActive ? "scale-110 drop-shadow-[0_2px_10px_rgba(56,189,248,0.7)]" : ""
                    }`}
                  />
                  <span
                    className={`text-[11px] mt-1 tracking-tight ${
                      isActive ? "font-bold text-[#38bdf8]" : "font-medium text-[#64748b]"
                    }`}
                  >
                    {item.label}
                  </span>

                  {/* Active Glowing Neon Pill underneath icon */}
                  {isActive && (
                    <div className="h-0.5 w-6 rounded-full bg-gradient-to-r from-sky-400 to-blue-500 shadow-[0_0_8px_#38bdf8] mt-1" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
