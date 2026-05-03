import { Outlet } from "react-router-dom";
import { Navigation } from "./Navigation";

export function Layout() {
  return (
    <div className="min-h-screen font-sans text-slate-200 relative overflow-hidden">
      {/* Immersive background elements */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[40%] rounded-full bg-brand-light/5 blur-[100px]" />
      </div>

      <Navigation />
      
      <main className="md:ml-80 pb-28 md:pb-10 min-h-screen relative z-10">
        <div className="max-w-5xl mx-auto p-6 md:p-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
