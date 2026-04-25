/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { Tasks } from "./pages/Tasks";
import { TaskDetails } from "./pages/TaskDetails";
import { CreateTask } from "./pages/CreateTask";
import { Wallet } from "./pages/Wallet";
import { Referrals } from "./pages/Referrals";
import { Admin } from "./pages/Admin";
import { MyCampaigns } from "./pages/MyCampaigns";
import { ReviewSubmissions } from "./pages/ReviewSubmissions";
import { MyTasks } from "./pages/MyTasks";
import { TelegramProvider } from "./contexts/TelegramContext";

export default function App() {
  return (
    <TelegramProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="tasks/history" element={<MyTasks />} />
            <Route path="tasks/create" element={<CreateTask />} />
            <Route path="tasks/:id" element={<TaskDetails />} />
            <Route path="campaigns" element={<MyCampaigns />} />
            <Route path="campaigns/:id/review" element={<ReviewSubmissions />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="referrals" element={<Referrals />} />
            <Route path="admin" element={<Admin />} />
          </Route>
        </Routes>
      </Router>
    </TelegramProvider>
  );
}

