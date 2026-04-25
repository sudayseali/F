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
      <header className="flex flex-col items-center justify-center pt-4 pb-6 border-b border-gray-200">
        <div className="w-24 h-24 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-3xl mb-4 shadow-sm border-4 border-white">
          {initial}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
        <p className="text-sm text-gray-500 mt-1">ID: {user?.id}</p>
        {user?.username && (
          <p className="text-sm font-medium text-blue-600 mt-1">@{user.username}</p>
        )}
      </header>

      <div className="space-y-3">
        <div 
          onClick={() => navigate("/tasks/history")}
          className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-gray-300 transition-colors"
        >
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Task History</h3>
              <p className="text-xs text-gray-500">View tasks you've completed</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>

        <div 
          onClick={() => navigate("/referrals")}
          className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-gray-300 transition-colors"
        >
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Refer & Earn</h3>
              <p className="text-xs text-gray-500">Invite friends for 10% commission</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>

        <div 
          className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between opacity-50 cursor-not-allowed"
        >
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Settings</h3>
              <p className="text-xs text-gray-500">Coming soon...</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </motion.div>
  );
}
