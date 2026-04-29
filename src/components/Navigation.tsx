import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, Wallet, User as UserIcon, Shield, Megaphone, Sun, Moon } from "lucide-react";
import { cn } from "../lib/utils";
import { useTelegram } from "../contexts/TelegramContext";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const baseNavItems = [
  { label: "Home", icon: LayoutDashboard, path: "/" },
  { label: "Offers", icon: CheckSquare, path: "/tasks" },
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
      {/* Mobile Dark Mode Floating Toggle */}
      <button 
        onClick={() => setIsDark(!isDark)}
        className="md:hidden fixed top-4 right-4 z-50 p-2.5 rounded-full glass-panel text-brand hover-lift"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Mobile Bottom Navigation - Floating Glass Dock */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 rounded-2xl glass-panel pb-safe z-50 grid items-center px-2 py-2">
        <div className="flex justify-around items-center h-14">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                  isActive ? "text-brand" : "text-gray-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTabMobile"
                    className="absolute inset-0 bg-brand/10 dark:bg-brand/20 rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={cn("w-5 h-5 z-10", isActive && "drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]")} />
                <span className="text-[10px] font-medium z-10">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar - Glass Panel */}
      <aside className="hidden md:flex flex-col w-72 h-screen fixed left-0 top-0 glass-panel border-r-0 border-r-zinc-200/50 dark:border-r-white/5">
        <div className="p-8 flex items-center justify-between">
          <h1 className="text-3xl font-display font-bold gradient-text tracking-tight">
            Payvora
          </h1>
          <button 
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 hover:text-brand transition-colors"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
        
        <nav className="flex-1 px-6 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "relative flex items-center space-x-3 px-4 py-3.5 rounded-xl transition-all font-semibold group",
                  isActive 
                    ? "text-brand" 
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                 {isActive && (
                  <motion.div
                    layoutId="activeTabDesktop"
                    className="absolute inset-0 bg-brand/10 dark:bg-brand/20 rounded-xl"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={cn("w-5 h-5 z-10 transition-transform group-hover:scale-110", isActive && "drop-shadow-[0_0_8px_rgba(124,58,237,0.5)]")} />
                <span className="z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-6">
          <div className="flex items-center space-x-4 p-4 rounded-2xl bg-white/50 dark:bg-white/5 border border-white/20 dark:border-white/10 glass-panel hover-lift cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-brand to-pink-500 p-[2px]">
               <div className="w-full h-full rounded-full bg-white dark:bg-zinc-900 items-center justify-center flex font-display font-bold text-lg">
                 {initial}
               </div>
            </div>
            <div className="overflow-hidden flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{displayName}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5 truncate">
                {user?.username ? `@${user.username}` : `ID: ${user?.id}`}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
