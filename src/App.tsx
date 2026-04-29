/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState } from "react";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Tasks } from "./pages/Tasks";
import { TaskDetails } from "./pages/TaskDetails";
import { Wallet } from "./pages/Wallet";
import { Referrals } from "./pages/Referrals";
import { Admin } from "./pages/Admin";
import { MyTasks } from "./pages/MyTasks";
import { Profile } from "./pages/Profile";
import { TelegramProvider } from "./contexts/TelegramContext";
import { SplashScreen } from "./components/SplashScreen";
import { AnimatePresence } from "framer-motion";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <TelegramProvider>
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>
      {!showSplash && (
        <Router>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="tasks" element={<Tasks />} />
              <Route path="tasks/history" element={<MyTasks />} />
              <Route path="tasks/:id" element={<TaskDetails />} />
              <Route path="wallet" element={<Wallet />} />
              <Route path="profile" element={<Profile />} />
              <Route path="referrals" element={<Referrals />} />
              <Route path="admin" element={<Admin />} />
            </Route>
          </Routes>
        </Router>
      )}
    </TelegramProvider>
  );
}

