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
      className="space-y-10 pb-10"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.header variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <span className="text-brand font-bold text-[10px] uppercase tracking-[0.3em] mb-2 block">Enterprise Console</span>
          <h1 className="text-4xl lg:text-5xl font-display font-bold text-white tracking-tighter">
            Hi, {displayName} <span className="inline-block animate-wave">👋</span>
          </h1>
        </div>
        <div className="flex -space-x-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-10 h-10 rounded-full border-2 border-[#020617] bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
              {i === 4 ? "+12" : ""}
            </div>
          ))}
          <div className="ml-4 pl-4 border-l border-white/5 flex flex-col justify-center">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Global Rank</span>
            <span className="text-sm font-bold text-emerald-500">Top 5%</span>
          </div>
        </div>
      </motion.header>

      {/* Balance Card - Ultra Premium */}
      <motion.div variants={itemVariants} className="relative group perspective">
        <div className="absolute -inset-1 bg-gradient-to-r from-brand/50 to-emerald-500/50 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative premium-card border-white/10 !p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
          
          <div className="absolute top-0 right-0 p-10 opacity-5 mix-blend-overlay pointer-events-none group-hover:scale-110 transition-transform duration-1000">
            <TrendingUp className="w-64 h-64 -rotate-12 text-white" />
          </div>

          <div className="relative z-10 space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
                <Wallet className="w-5 h-5" />
              </div>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">Portfolio Liquidity</p>
            </div>
            <div className="flex items-baseline space-x-3">
              <span className="text-6xl lg:text-7xl font-display font-bold text-white tracking-tighter">
                ${balance.toFixed(2)}
              </span>
              <span className="text-2xl font-bold font-display text-slate-500 uppercase">USD</span>
            </div>
            <div className="flex items-center space-x-2 text-emerald-500 bg-emerald-500/10 w-fit px-3 py-1 rounded-lg border border-emerald-500/20">
              <TrendingUp className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-widest">+12.5% This Month</span>
            </div>
          </div>
          
          <div className="relative z-10 flex flex-col sm:flex-row gap-4">
            <Link to="/wallet" className="btn-primary group !px-10 !py-5">
              <span className="relative z-10 flex items-center text-base">
                Withdrawal Console
                <ArrowUpRight className="w-5 h-5 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </span>
            </Link>
            <Link to="/wallet" className="flex items-center justify-center px-10 py-5 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold transition-all border border-white/5 active:scale-95">
              View Audit Log
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Stats Bento Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="premium-card flex flex-row items-center justify-between group hover-lift border-white/5">
          <div className="flex items-center space-x-6">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20 group-hover:rotate-12 transition-transform duration-500">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Contract Fulfilled</p>
              <h4 className="text-4xl font-display font-bold text-white">{loading ? "-" : stats.completed}</h4>
            </div>
          </div>
          <div className="w-12 h-1 bg-emerald-500/20 rounded-full" />
        </div>
        
        <div className="premium-card flex flex-row items-center justify-between group hover-lift border-white/5">
          <div className="flex items-center space-x-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/20 group-hover:-rotate-12 transition-transform duration-500">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Pending Audit</p>
              <h4 className="text-4xl font-display font-bold text-white">{loading ? "-" : stats.pending}</h4>
            </div>
          </div>
          <div className="w-12 h-1 bg-amber-500/20 rounded-full" />
        </div>
      </motion.div>

      {/* Activity Feed */}
      <motion.div variants={itemVariants} className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-2xl font-display font-bold text-white">Resource Stream</h3>
          <Link to="/tasks" className="text-brand text-xs font-bold uppercase tracking-widest hover:text-brand-light transition-all flex items-center group">
            Global Marketplace <ArrowUpRight className="w-4 h-4 ml-2 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
          </Link>
        </div>
        
        <div className="premium-card !p-0 border-white/5 overflow-hidden">
          <div className="divide-y divide-white/5 flex flex-col items-stretch">
            {loading ? (
              <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-[0.2em] animate-pulse">Syncing Network...</div>
            ) : stats.recentSubmissions.length === 0 ? (
               <div className="p-20 text-center flex flex-col items-center justify-center">
                 <div className="w-20 h-20 rounded-[2rem] bg-slate-900 border border-white/5 flex items-center justify-center mb-6">
                   <TrendingUp className="w-10 h-10 text-slate-700" />
                 </div>
                 <p className="text-white font-bold text-xl mb-2">No Operations Found</p>
                 <p className="text-slate-500 text-sm max-w-sm mx-auto line-height-relaxed">
                   Initiate contract submissions in the marketplace to populate your operations ledger.
                 </p>
               </div>
            ) : (
              stats.recentSubmissions.map((sub, i) => {
                const isApproved = sub.status === 'approved';
                const isPending = sub.status === 'pending';
                const isRejected = sub.status === 'rejected';

                return (
                  <motion.div 
                    key={sub.id} 
                    className="p-8 flex items-center justify-between hover:bg-white/[0.03] transition-all group"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                  >
                    <div className="flex items-center space-x-6 overflow-hidden">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-500 ${
                        isApproved ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 group-hover:bg-emerald-500/20' :
                        isPending ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 group-hover:bg-amber-500/20' :
                        'bg-red-500/10 text-red-500 border-red-500/20 group-hover:bg-red-500/20'
                      }`}>
                         {isApproved && <CheckCircle className="w-6 h-6" />}
                         {isPending && <Clock className="w-6 h-6" />}
                         {isRejected && <div className="w-6 h-6 font-black flex items-center justify-center">✕</div>}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className="font-bold text-white text-base truncate mb-1 group-hover:text-brand transition-colors">{sub.tasks?.title || "Contract Operation"}</h4>
                        <div className="flex items-center space-x-3">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{new Date(sub.created_at).toLocaleDateString()}</span>
                          <span className={`w-1.5 h-1.5 rounded-full ${isApproved ? 'bg-emerald-500' : isPending ? 'bg-amber-500' : 'bg-red-500'}`} />
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${isApproved ? 'text-emerald-500' : isPending ? 'text-amber-500' : 'text-red-500'}`}>
                            {sub.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-display font-bold text-2xl ${
                        isApproved ? 'text-emerald-400' : 'text-slate-400'
                      }`}>
                        {isApproved ? '+' : ''}${Number(sub.tasks?.reward || 0).toFixed(2)}
                      </span>
                    </div>
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
