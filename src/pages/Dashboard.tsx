import { ArrowUpRight, TrendingUp, CheckCircle, Clock } from "lucide-react";
import { useTelegram } from "../contexts/TelegramContext";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";

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

interface DashboardStats {
  completed: number;
  pending: number;
  recentSubmissions: any[];
}

export function Dashboard() {
  const { user } = useTelegram();
  const displayName = user?.first_name ? `${user?.first_name} ${user?.last_name || ''}`.trim() : 'User';
  const balance = user?.balance || 0;
  
  const [stats, setStats] = useState<DashboardStats>({
    completed: 0,
    pending: 0,
    recentSubmissions: []
  });
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user?.uuid) return;
      
      try {
        const { data: subs, error } = await supabase
          .from('submissions')
          .select('*, tasks(title, reward)')
          .eq('worker_id', user.uuid)
          .order('created_at', { ascending: false });
          
        if (subs) {
          setStats({
            completed: subs.filter(s => s.status === 'approved').length,
            pending: subs.filter(s => s.status === 'pending').length,
            recentSubmissions: subs.slice(0, 5),
          });
        }
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [user?.uuid]);

  return (
    <motion.div 
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.header variants={itemVariants} className="flex justify-between items-end">
        <div>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1 tracking-wide uppercase">Overview</p>
          <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-white tracking-tight">
            Hi, {displayName} <span className="inline-block animate-wave">👋</span>
          </h1>
        </div>
      </motion.header>

      {/* Balance Card - Modern Glass Design */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand to-brand-light p-[1px] shadow-2xl">
        <div className="absolute inset-0 bg-white/20 dark:bg-black/20" />
        <div className="relative h-full w-full rounded-[2rem] bg-gradient-to-br from-white/90 to-white/40 dark:from-zinc-900/90 dark:to-zinc-900/40 backdrop-blur-xl p-8 border border-white/20 dark:border-white/10">
          
          <div className="absolute top-0 right-0 p-8 opacity-10 mix-blend-overlay pointer-events-none">
            <TrendingUp className="w-48 h-48 -rotate-12" />
          </div>

          <div className="relative z-10 flex flex-col h-full justify-between">
            <div>
              <p className="text-brand-dark dark:text-brand-light text-sm font-bold uppercase tracking-widest mb-2">Total Balance</p>
              <div className="flex items-baseline space-x-2">
                <span className="text-5xl font-display font-black text-gray-900 dark:text-white tracking-tighter">
                  ${balance.toFixed(2)}
                </span>
                <span className="text-xl font-medium text-gray-500">USD</span>
              </div>
            </div>
            
            <div className="flex space-x-4 mt-8">
              <Link to="/wallet" className="group relative w-full sm:w-auto bg-brand hover:bg-brand-light text-white px-8 py-3.5 rounded-2xl font-bold text-sm shadow-[0_0_40px_-10px_rgba(124,58,237,0.5)] transition-all flex items-center justify-center overflow-hidden">
                <span className="relative z-10 flex items-center">
                  Withdraw Funds
                  <ArrowUpRight className="w-4 h-4 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </span>
              </Link>
              <Link to="/wallet" className="w-full sm:w-auto bg-white/50 hover:bg-white/80 dark:bg-white/5 dark:hover:bg-white/10 text-gray-900 dark:text-white px-8 py-3.5 rounded-2xl font-bold text-sm transition-all border border-gray-200/50 dark:border-white/10 flex items-center justify-center backdrop-blur-sm">
                History
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid - Glass Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
        <div className="glass-panel p-6 rounded-[2rem] flex flex-col items-center justify-center text-center group hover:-translate-y-1 transition-transform duration-300">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 mb-4 border border-emerald-500/20 group-hover:scale-110 transition-transform">
            <CheckCircle className="w-7 h-7" />
          </div>
          <p className="text-3xl font-display font-black text-gray-900 dark:text-white mb-1">{loading ? "-" : stats.completed}</p>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Completed</p>
        </div>
        
        <div className="glass-panel p-6 rounded-[2rem] flex flex-col items-center justify-center text-center group hover:-translate-y-1 transition-transform duration-300">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4 border border-amber-500/20 group-hover:scale-110 transition-transform">
            <Clock className="w-7 h-7" />
          </div>
          <p className="text-3xl font-display font-black text-gray-900 dark:text-white mb-1">{loading ? "-" : stats.pending}</p>
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Pending</p>
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-display font-bold text-gray-900 dark:text-white">Recent Activity</h3>
          <Link to="/tasks/history" className="text-brand text-sm font-bold hover:text-brand-light transition-colors flex items-center">
            View All Offers <ArrowUpRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
        
        <div className="glass-panel rounded-[2rem] overflow-hidden">
          <div className="divide-y divide-gray-200/50 dark:divide-white/5 flex flex-col items-stretch">
            {loading ? (
              <div className="p-8 text-center text-gray-500 animate-pulse">Loading activity...</div>
            ) : stats.recentSubmissions.length === 0 ? (
               <div className="p-12 text-center flex flex-col items-center justify-center">
                 <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
                   <Clock className="w-8 h-8 text-gray-400" />
                 </div>
                 <p className="text-gray-900 dark:text-white font-bold mb-1">No activity yet</p>
                 <p className="text-gray-500 text-sm max-w-[200px] mx-auto">Complete offers to see your earnings history here.</p>
               </div>
            ) : (
              stats.recentSubmissions.map((sub, i) => {
                const isApproved = sub.status === 'approved';
                const isPending = sub.status === 'pending';
                const isRejected = sub.status === 'rejected';

                return (
                  <motion.div 
                    key={sub.id} 
                    className="p-5 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isApproved ? 'bg-emerald-500/10 text-emerald-500' :
                        isPending ? 'bg-amber-500/10 text-amber-500' :
                        'bg-red-500/10 text-red-500'
                      }`}>
                         {isApproved && <CheckCircle className="w-5 h-5" />}
                         {isPending && <Clock className="w-5 h-5" />}
                         {isRejected && <div className="w-5 h-5 font-bold flex items-center justify-center">✕</div>}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm truncate max-w-[180px] sm:max-w-xs">{sub.tasks?.title || "Unknown Offer"}</h4>
                        <p className="text-xs text-gray-500 mt-0.5 capitalize">{sub.status}</p>
                      </div>
                    </div>
                    <span className={`font-display font-bold text-lg ${
                      isApproved ? 'text-emerald-500' : 'text-gray-900 dark:text-white'
                    }`}>
                      {isApproved ? '+' : ''}${Number(sub.tasks?.reward || 0).toFixed(2)}
                    </span>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
