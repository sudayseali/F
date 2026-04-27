import React from "react";
import { useTelegram } from "../contexts/TelegramContext";
import { Users, History, Settings, LogOut, ChevronRight, Gift } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export function Profile() {
  const { user } = useTelegram();
  const navigate = useNavigate();
  const displayName = user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "User";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <header className="flex flex-col items-center justify-center pt-4 pb-6 border-b border-gray-200 dark:border-gray-800">
        <div className="w-24 h-24 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-3xl mb-4 shadow-sm border-4 border-[#111218]">
          {initial}
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{displayName}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">ID: {user?.id}</p>
        {user?.username && (
          <p className="text-sm font-medium text-amber-500 mt-1">@{user.username}</p>
        )}
      </header>

      <div className="space-y-3">
        <div 
          onClick={() => navigate("/tasks/history")}
          className="bg-white dark:bg-[#111218] p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
        >
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center border border-amber-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Task History</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">View tasks you've completed</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </div>

        <div 
          onClick={() => navigate("/referrals")}
          className="bg-white dark:bg-[#111218] p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
        >
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center border border-emerald-500/20">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Refer & Earn</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Invite friends for 10% commission</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </div>

        <div 
          className="bg-white dark:bg-[#111218] p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm flex items-center justify-between opacity-50 cursor-not-allowed"
        >
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gray-800 text-gray-500 dark:text-gray-400 rounded-full flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">Settings</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Coming soon...</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </div>
      </div>
    </motion.div>
  );
}
