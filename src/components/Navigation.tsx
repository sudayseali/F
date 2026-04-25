import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CheckSquare, Wallet, Users, Settings } from "lucide-react";
import { cn } from "../lib/utils";

const navItems = [
  { label: "Home", icon: LayoutDashboard, path: "/" },
  { label: "Tasks", icon: CheckSquare, path: "/tasks" },
  { label: "Wallet", icon: Wallet, path: "/wallet" },
  { label: "Referrals", icon: Users, path: "/referrals" },
];

export function Navigation() {
  const location = useLocation();

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 w-full bg-white border-t border-gray-200 pb-safe z-50">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                  isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-900"
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
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-white border-r border-gray-200">
        <div className="p-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            TaskMaster
          </h1>
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
                  "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all",
                  isActive 
                    ? "bg-blue-50 text-blue-700 font-semibold" 
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3 p-4 rounded-xl bg-gray-50">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
              JD
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">John Doe</p>
              <p className="text-xs text-gray-500">@johndoe</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
