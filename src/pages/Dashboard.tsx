import { ArrowUpRight, TrendingUp, CheckCircle, Clock } from "lucide-react";
import { useTelegram } from "../contexts/TelegramContext";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
};

export function Dashboard() {
  const { user } = useTelegram();
  const displayName = user?.first_name || user?.username || 'User';

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.header variants={itemVariants}>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm">Welcome back {displayName}, here's your overview.</p>
      </motion.header>

      {/* Balance Card */}
      <motion.div variants={itemVariants} className="bg-gradient-to-br from-amber-600 to-amber-800 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-amber-500/20">
        <div className="absolute top-0 right-0 p-4 opacity-10 mix-blend-overlay">
          <TrendingUp className="w-32 h-32" />
        </div>
        <div className="relative z-10">
          <p className="text-amber-100/80 text-sm font-semibold mb-1 uppercase tracking-wider">Available Balance</p>
          <h2 className="text-4xl font-bold mb-4 tracking-tight">$45.50</h2>
          
          <div className="flex space-x-4">
            <button className="bg-white text-amber-900 px-6 py-2.5 rounded-xl font-bold text-sm flex items-center shadow-lg hover:shadow-xl hover:bg-gray-50 transition-all active:scale-95">
              Withdraw
              <ArrowUpRight className="w-4 h-4 ml-1.5" />
            </button>
            <button className="bg-amber-950/40 hover:bg-amber-950/60 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all border border-amber-400/30 active:scale-95">
              History
            </button>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
        <div className="bg-[#111218] p-5 rounded-2xl border border-gray-800 shadow-sm flex flex-col items-center text-center hover:border-gray-700 transition-colors">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-3 border border-emerald-500/20">
            <CheckCircle className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-white">128</p>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Completed</p>
        </div>
        
        <div className="bg-[#111218] p-5 rounded-2xl border border-gray-800 shadow-sm flex flex-col items-center text-center hover:border-gray-700 transition-colors">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-3 border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-2xl font-bold text-white">14</p>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mt-1">Pending</p>
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Recent Tasks</h3>
          <button className="text-amber-500 text-sm font-semibold hover:text-amber-400 transition-colors">View All</button>
        </div>
        
        <div className="bg-[#111218] rounded-2xl border border-gray-800 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-800/60">
            {[
              { title: "Subscribe to Crypto Channel", reward: "+$0.50", status: "Approved", color: "text-[#4ade80]", bg: "bg-[#052e16]", border: "border-[#14532d]" },
              { title: "Like & Comment on TikTok", reward: "+$0.20", status: "Pending", color: "text-[#fbbf24]", bg: "bg-[#422006]", border: "border-[#78350f]" },
              { title: "Sign up for Newsletter", reward: "+$1.00", status: "Rejected", color: "text-[#f87171]", bg: "bg-[#450a0a]", border: "border-[#7f1d1d]" },
            ].map((task, i) => (
              <motion.div 
                key={i} 
                className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div>
                  <h4 className="font-semibold text-gray-200 text-sm">{task.title}</h4>
                  <div className="flex items-center space-x-2 mt-1.5">
                    <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${task.bg} ${task.color} ${task.border}`}>
                      {task.status}
                    </span>
                    {task.status === "Rejected" && (
                      <button className="text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider flex items-center space-x-1" onClick={() => alert("Dispute filed for admin review!")}>
                        <span>Appeal</span>
                      </button>
                    )}
                  </div>
                </div>
                <span className="font-bold text-white">{task.reward}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
