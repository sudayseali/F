import { ArrowUpRight, TrendingUp, CheckCircle, Clock, Wallet } from "lucide-react";
import { useTelegram } from "../contexts/TelegramContext";
import { motion } from "motion/react";
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
    if (user?.uuid !== undefined) {
      fetchStats();
    } else if (user) {
      // If we have a user but no UUID yet (waiting for data), we still want to show something eventually
      // but fetchStats will return early. We might want a smaller timeout if it hangs.
      const timer = setTimeout(() => setLoading(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setLoading(false);
    }
  }, [user?.uuid, user]);

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

      {/* Offerwall CTA */}
      <motion.div variants={itemVariants} className="premium-card bg-brand/5 border-brand/20 !p-10 group overflow-hidden relative">
        <div className="absolute top-0 right-0 p-12 opacity-5 mix-blend-overlay pointer-events-none group-hover:scale-110 transition-transform duration-1000">
          <TrendingUp className="w-48 h-48 -rotate-12 text-white" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="max-w-xl text-center md:text-left">
            <h3 className="text-3xl font-display font-bold text-white mb-4">Scale Your Rewards</h3>
            <p className="text-slate-400 text-base leading-relaxed">
              Integrate your account with our global partner networks. Access high-priority tasks and exclusive bounty operations in the Global Offerwall.
            </p>
          </div>
          <Link to="/offerwall" className="btn-primary !px-12 !py-5 whitespace-nowrap shadow-2xl">
            Open Global Offerwall
          </Link>
        </div>
      </motion.div>

    </motion.div>
  );
}
