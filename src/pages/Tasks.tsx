import { Search, Filter, Youtube, MessageCircle, Globe, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

const tasks = [
  { id: 1, title: "Join Telegram Crypto Group", category: "Telegram", reward: 0.15, slots: "450/500", icon: MessageCircle, color: "text-blue-500", bg: "bg-blue-100" },
  { id: 2, title: "Watch 3min YouTube Video & Like", category: "YouTube", reward: 0.30, slots: "12/50", icon: Youtube, color: "text-red-500", bg: "bg-red-100" },
  { id: 3, title: "Create Account on Binance", category: "Sign Up", reward: 2.50, slots: "89/100", icon: Globe, color: "text-indigo-500", bg: "bg-indigo-100" },
  { id: 4, title: "Follow Twitter Account", category: "Twitter", reward: 0.10, slots: "800/1000", icon: MessageCircle, color: "text-sky-500", bg: "bg-sky-100" },
  { id: 5, title: "Download App & Rate 5 Stars", category: "App Install", reward: 1.20, slots: "5/20", icon: Globe, color: "text-emerald-500", bg: "bg-emerald-100" },
];

export function Tasks() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Available Tasks</h1>
          <p className="text-gray-500 text-sm">Earn money by completing simple tasks.</p>
        </div>
      </header>

      {/* Search and Filter */}
      <div className="flex space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search tasks..." 
            className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
          />
        </div>
        <button className="p-3 bg-white border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      {/* Categories */}
      <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
        {["All", "Telegram", "YouTube", "Sign Up", "Apps"].map((cat, i) => (
          <button 
            key={i}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              i === 0 ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {tasks.map((task) => {
          const Icon = task.icon;
          return (
            <div 
              key={task.id} 
              onClick={() => navigate(`/tasks/${task.id}`)}
              className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${task.bg} ${task.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm md:text-base group-hover:text-blue-600 transition-colors">
                    {task.title}
                  </h3>
                  <div className="flex items-center space-x-3 mt-1">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-500">
                      {task.category}
                    </span>
                    <span className="text-gray-300 text-xs">•</span>
                    <span className="text-[10px] text-gray-500 font-medium">
                      Slots: {task.slots}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="font-bold text-gray-900 text-lg">${task.reward.toFixed(2)}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
