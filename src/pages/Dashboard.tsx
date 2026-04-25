import { ArrowUpRight, TrendingUp, CheckCircle, Clock } from "lucide-react";
import { useTelegram } from "../contexts/TelegramContext";

export function Dashboard() {
  const { user } = useTelegram();
  const displayName = user?.first_name || user?.username || 'User';

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm">Welcome back {displayName}, here's your overview.</p>
      </header>

      {/* Balance Card */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <TrendingUp className="w-32 h-32" />
        </div>
        <div className="relative z-10">
          <p className="text-blue-100 text-sm font-medium mb-1">Available Balance</p>
          <h2 className="text-4xl font-bold mb-4">$45.50</h2>
          
          <div className="flex space-x-4">
            <button className="bg-white text-blue-600 px-6 py-2 rounded-lg font-semibold text-sm flex items-center shadow-sm hover:bg-gray-50 transition-colors">
              Withdraw
              <ArrowUpRight className="w-4 h-4 ml-1" />
            </button>
            <button className="bg-blue-500/30 hover:bg-blue-500/40 text-white px-6 py-2 rounded-lg font-semibold text-sm transition-colors border border-blue-400/30">
              History
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 mb-3">
            <CheckCircle className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-gray-900">128</p>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">Completed</p>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-gray-900">14</p>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">Pending Review</p>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Tasks</h3>
          <button className="text-blue-600 text-sm font-medium hover:underline">View All</button>
        </div>
        
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {[
              { title: "Subscribe to Crypto Channel", reward: "+$0.50", status: "Approved", color: "text-green-600", bg: "bg-green-50" },
              { title: "Like & Comment on TikTok", reward: "+$0.20", status: "Pending", color: "text-orange-600", bg: "bg-orange-50" },
              { title: "Sign up for Newsletter", reward: "+$1.00", status: "Approved", color: "text-green-600", bg: "bg-green-50" },
            ].map((task, i) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 text-sm">{task.title}</h4>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${task.bg} ${task.color}`}>
                    {task.status}
                  </span>
                </div>
                <span className="font-bold text-gray-900">{task.reward}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
