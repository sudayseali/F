import { Outlet } from "react-router-dom";
import { Navigation } from "./Navigation";

export function Layout() {
  return (
    <div className="min-h-screen bg-[#020617] font-sans text-slate-200">
      <Navigation />
      
      <main className="md:ml-80 pb-20 md:pb-0 min-h-screen">
        <div className="max-w-5xl mx-auto p-6 md:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
