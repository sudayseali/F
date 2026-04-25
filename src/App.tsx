/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Tasks } from "./pages/Tasks";
import { TaskDetails } from "./pages/TaskDetails";
import { Wallet } from "./pages/Wallet";
import { Referrals } from "./pages/Referrals";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="tasks/:id" element={<TaskDetails />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="referrals" element={<Referrals />} />
        </Route>
      </Routes>
    </Router>
  );
}
