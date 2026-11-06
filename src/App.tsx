/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useState } from "react";
import { Layout, SplashScreen } from "./components";
import { 
  Dashboard, Tasks, TaskDetails, Wallet, 
  Referrals, Profile, Offerwall 
} from "./pages";
import { TelegramProvider } from "./contexts/TelegramContext";
import { AnimatePresence } from "motion/react";

export default function App() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>
      <div className={showSplash ? "hidden" : ""}>
        <TelegramProvider>
          <Router>
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="offerwall" element={<Offerwall />} />
                <Route path="tasks/:id" element={<TaskDetails />} />
                <Route path="wallet" element={<Wallet />} />
                <Route path="profile" element={<Profile />} />
                <Route path="referrals" element={<Referrals />} />
              </Route>
            </Routes>
          </Router>
        </TelegramProvider>
      </div>
    </>
  );
}

