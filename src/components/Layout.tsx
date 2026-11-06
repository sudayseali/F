import { Outlet } from "react-router-dom";
import { Navigation } from "./Navigation";

export function Layout() {
  return (
    <div className="min-h-screen bg-[#030712] text-[#f8fafc] flex flex-col items-center relative overflow-x-hidden">
      {/* Background radial glows matching screenshot */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[350px] h-[350px] bg-sky-600/15 rounded-full blur-[100px]" />
        <div className="absolute top-[40%] right-0 w-[300px] h-[300px] bg-purple-600/15 rounded-full blur-[110px]" />
        <div className="absolute bottom-10 left-0 w-[280px] h-[280px] bg-blue-600/10 rounded-full blur-[90px]" />
      </div>

      <div className="w-full max-w-md min-h-screen flex flex-col bg-[#030712] relative shadow-2xl">
        <Navigation />
        
        {/* Main Content Area */}
        <main className="flex-1 px-4 pt-3 pb-24 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
