import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, Wallet, User as UserIcon, Shield, Megaphone, Sun, Moon } from "lucide-react";
import { cn } from "../lib/utils";
import { useTelegram } from "../contexts/TelegramContext";
import { useState, useEffect } from "react";

const baseNavItems = [
  { label: "Home", icon: LayoutDashboard, path: "/" },
  { label: "Earn", icon: CheckSquare, path: "/tasks" },
  { label: "Promote", icon: Megaphone, path: "/campaigns" },
  { label: "Wallet", icon: Wallet, path: "/wallet" },
  { label: "Profile", icon: UserIcon, path: "/profile" },
];

export function Navigation() {
  const location = useLocation();
  const { user } = useTelegram();
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
  if (user?.id === 5806129562) {
    navItems.push({ label: "Admin", icon: Shield, path: "/admin" });
  }

  return (
    <>
      {/* Mobile Dark Mode Floating Toggle */}
      <button 
        onClick={() => setIsDark(!isDark)}
        className="md:hidden fixed top-4 right-4 z-50 p-2.5 rounded-full bg-white dark:bg-[#111218] border border-gray-200 dark:border-gray-800 text-amber-500 shadow-sm"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white dark:bg-[#111218] border-t border-gray-200 dark:border-gray-800 pb-safe z-50">
        <div className="flex justify-around items-center h-16 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                  isActive ? "text-amber-500" : "text-gray-500 dark:text-gray-500 hover:text-gray-300 dark:hover:text-gray-300"
                )}
              >
                <Icon className="w-6 h-6" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-gray-50 dark:bg-[#0b0c10] border-r border-gray-200 dark:border-gray-800">
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">
            TaskMaster
          </h1>
          <button 
            onClick={() => setIsDark(!isDark)}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-white/[0.03] text-amber-500 transition-colors"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-semibold",
                  isActive 
                    ? "bg-amber-500/10 text-amber-500" 
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.03] hover:text-gray-900 dark:hover:text-gray-200"
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-3 p-4 rounded-xl bg-gray-100 dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 font-bold uppercase">
              {initial}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{displayName}</p>
              <p className="text-xs text-gray-500 truncate">
                {user?.username ? `@${user.username}` : `ID: ${user?.id}`}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
