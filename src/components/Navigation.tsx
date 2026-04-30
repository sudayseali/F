import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, Layers, Wallet, User as UserIcon, Shield, Sun, Moon } from "lucide-react";
import { cn } from "../lib/utils";
import { useTelegram } from "../contexts/TelegramContext";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Logo } from "./Logo";

const baseNavItems = [
  { label: "Home", icon: LayoutDashboard, path: "/" },
  { label: "Offers", icon: CheckSquare, path: "/tasks" },
  { label: "Offerwall", icon: Layers, path: "/offerwall" },
  { label: "Wallet", icon: Wallet, path: "/wallet" },
  { label: "Profile", icon: UserIcon, path: "/profile" },
];

export function Navigation() {
  const location = useLocation();
  const { user, isAdmin } = useTelegram();
  const displayName = user?.first_name ? `${user?.first_name} ${user?.last_name || ''}`.trim() : 'User';
  const initial = displayName.charAt(0).toUpperCase();

  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.theme === 'dark' || (!('theme' in localStorage) && true); // default to dark
    }
    return true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.theme = 'dark';
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.theme = 'light';
    }
  }, [isDark]);

  const navItems = [...baseNavItems];
  if (isAdmin) {
    navItems.push({ label: "Admin", icon: Shield, path: "/admin" });
  }

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-20 glass-panel z-40 border-b border-white/5 flex items-center justify-between px-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-brand/10 rounded-xl">
            <Logo className="w-7 h-7" />
          </div>
          <span className="text-2xl font-display font-bold text-white tracking-tight">Payvora</span>
        </div>
        <button 
          onClick={() => setIsDark(!isDark)}
          className="w-10 h-10 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-all active:scale-90"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Main content needs padding due to fixed mobile top bar */}
      <style>{`
        @media (max-width: 768px) {
          main { padding-top: 6rem; }
        }
      `}</style>

      {/* Mobile Bottom Navigation - Centered Floating Dock */}
      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm rounded-[2rem] glass-panel pb-safe z-50 flex items-center px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-white/10">
        <div className="flex justify-between items-center w-full">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex flex-col items-center justify-center w-14 h-14 transition-all duration-300",
                  isActive ? "text-white" : "text-slate-500 hover:text-slate-300"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabMobile"
                    className="absolute inset-0 bg-brand/80 rounded-2xl shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                    transition={{ type: "spring", bounce: 0.3, duration: 0.5 }}
                  />
                )}
                <Icon className={cn("w-6 h-6 z-10 transition-all duration-300", isActive ? "scale-110" : "scale-100")} />
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar - Enterprise Class */}
      <aside className="hidden md:flex flex-col w-80 h-screen fixed left-0 top-0 bg-[#020617] border-r border-white/5">
        <div className="p-10 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-2.5 bg-brand/10 rounded-2xl">
              <Logo className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tighter">
              Payvora
            </h1>
          </div>
        </div>
        
        <nav className="flex-1 px-8 space-y-3 mt-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex items-center space-x-4 px-5 py-4 rounded-2xl transition-all duration-300 font-bold group",
                  isActive 
                    ? "text-white" 
                    : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                )}
              >
                 {isActive && (
                  <motion.div
                    layoutId="activeTabDesktop"
                    className="absolute inset-0 bg-brand rounded-2xl shadow-[0_0_30px_rgba(59,130,246,0.2)]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={cn("w-5 h-5 z-10 transition-all duration-500 group-hover:scale-110", isActive ? "text-white" : "text-slate-500")} />
                <span className="z-10 text-sm tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-8">
          <div className="p-1 bg-white/5 rounded-[2rem] border border-white/10 hover-lift cursor-pointer overflow-hidden group">
            <div className="flex items-center space-x-4 p-4">
              <div className="w-12 h-12 rounded-2xl bg-brand/20 flex items-center justify-center text-brand font-display font-black text-xl border border-brand/20">
                {initial}
              </div>
              <div className="overflow-hidden flex-1">
                <p className="text-sm font-bold text-white truncate">{displayName}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-1 uppercase tracking-widest truncate">
                  {user?.username ? `@${user.username}` : `ID: ${user?.id?.slice(0, 8)}`}
                </p>
              </div>
            </div>
            <div className="h-1 bg-brand transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
          </div>
        </div>
      </aside>
    </>
  );
}
