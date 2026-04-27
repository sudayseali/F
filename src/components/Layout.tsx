import { Outlet } from "react-router-dom";
import { Navigation } from "./Navigation";

export function Layout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0b0c10] font-sans text-gray-700 dark:text-gray-300">
      <Navigation />
      
      <main className="md:ml-64 pb-20 md:pb-0 min-h-screen">
        <div className="max-w-4xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
