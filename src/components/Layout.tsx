import { Outlet } from "react-router-dom";
import { Navigation } from "./Navigation";

export function Layout() {
  return (
    <div className="min-h-screen bg-[#0e1621] text-[#f5f5f5] flex flex-col items-center">
      <div className="w-full max-w-md min-h-screen flex flex-col bg-[#0e1621] relative shadow-2xl">
        <Navigation />
        
        {/* Main Content Area */}
        <main className="flex-1 px-4 pt-3 pb-24 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
