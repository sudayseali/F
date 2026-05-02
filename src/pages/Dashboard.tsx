import { ArrowUpRight, TrendingUp, CheckCircle, Clock, Wallet, Shield } from "lucide-react";
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
      const timer = setTimeout(() => setLoading(false), 2000);
      return () => clearTimeout(timer);
    } else {
      setLoading(false);
    }
  }, [user?.uuid, user]);

  return (
    <motion.div 
      className="space-y-12 pb-10"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.header variants={itemVariants} className="flex flex-col md:flex-row md:items-center justify-between gap-8 pt-4">
        <div>
          <div className="flex items-center space-x-3 mb-4">
            <span className="w-2 h-2 rounded-full bg-brand animate-ping"></span>
            <span className="text-brand font-bold text-[10px] uppercase tracking-[0.3em]">Network Synchronized</span>
          </div>
          <h1 className="text-5xl lg:text-6xl font-serif font-bold gradient-text tracking-tight mb-2">
            Welcome, {displayName}.
          </h1>
          <p className="text-white/40 text-sm font-medium tracking-wide">Secure connection established on encrypted channel.</p>
        </div>
        
        <div className="flex items-center p-2 rounded-[2rem] bg-white/[0.02] border border-white/[0.05] backdrop-blur-md">
          <div className="flex -space-x-3 px-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-10 h-10 rounded-full border-2 border-[#0a0502] bg-[#1a0f0a] flex items-center justify-center">
                <Shield className="w-4 h-4 text-brand/50" />
              </div>
            ))}
            <div className="w-10 h-10 rounded-full border-2 border-[#0a0502] bg-[#1a0f0a] flex items-center justify-center text-[10px] font-bold text-white/50">
              +99
            </div>
          </div>
          <div className="ml-4 pr-6 pl-4 border-l border-white/[0.05] flex flex-col justify-center">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] mb-0.5">Top Tier</span>
            <span className="text-sm font-bold text-brand">Alpha Status</span>
          </div>
        </div>
      </motion.header>

      {/* Balance Card - Ultra Premium */}
      <motion.div variants={itemVariants} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-brand/20 to-white/5 rounded-[3rem] blur-xl opacity-50 group-hover:opacity-70 transition duration-1000"></div>
        <div className="relative premium-card !rounded-[2.5rem] !p-12 border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-12 bg-gradient-to-br from-[#1a0f0a]/90 to-[#0a0502]/90 backdrop-blur-3xl">
          
          <div className="absolute top-0 right-0 p-12 opacity-5 mix-blend-overlay pointer-events-none group-hover:scale-110 transition-transform duration-1000">
            <TrendingUp className="w-96 h-96 -rotate-12 text-white" />
          </div>

          <div className="relative z-10 space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-[1.2rem] bg-brand/10 border border-brand/20 flex items-center justify-center text-brand shadow-inner">
                <Wallet className="w-6 h-6" />
              </div>
              <p className="text-white/50 text-[11px] font-bold uppercase tracking-[0.25em]">Liquid Treasury</p>
            </div>
            <div className="flex items-baseline space-x-4">
              <span className="text-7xl lg:text-8xl font-display font-black text-white tracking-tighter drop-shadow-2xl">
                {(balance * 1000).toLocaleString()}
              </span>
              <span className="text-3xl font-bold font-serif text-white/30 uppercase tracking-widest">Paycoin</span>
            </div>
            <div className="flex items-center space-x-3 bg-[#1a0f0a] w-fit px-4 py-2 rounded-xl border border-white/5 shadow-inner">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-emerald-500 text-[11px] font-bold uppercase tracking-[0.15em]">Market Outperforming +12.5%</span>
            </div>
          </div>
          
          <div className="relative z-10 flex flex-col sm:flex-row gap-4">
            <Link to="/wallet" className="btn-primary group !px-12 !py-6 !rounded-[1.5rem] shadow-[0_0_30px_rgba(255,78,0,0.2)] hover:shadow-[0_0_50px_rgba(255,78,0,0.4)]">
              <span className="relative z-10 flex items-center text-lg font-display tracking-wide uppercase">
                Access Funds
                <ArrowUpRight className="w-6 h-6 ml-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </span>
            </Link>
          </div>
        </div>
      </motion.div>

      {/* Stats Bento Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="premium-card flex flex-col justify-between group hover-lift !p-10 !rounded-[2.5rem]">
          <div className="flex items-center justify-between mb-8">
            <div className="w-16 h-16 rounded-[1.2rem] bg-brand/5 flex items-center justify-center text-brand border border-brand/10 group-hover:scale-110 transition-transform duration-700">
              <CheckCircle className="w-8 h-8" />
            </div>
            <span className="text-white/20 text-4xl font-serif italic font-light">01</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] mb-2">Verified Operations</p>
            <h4 className="text-5xl font-display font-black text-white group-hover:text-brand transition-colors">{loading ? "-" : stats.completed}</h4>
          </div>
        </div>
        
        <div className="premium-card flex flex-col justify-between group hover-lift !p-10 !rounded-[2.5rem]">
          <div className="flex items-center justify-between mb-8">
            <div className="w-16 h-16 rounded-[1.2rem] bg-[#ff7638]/5 flex items-center justify-center text-[#ff7638] border border-[#ff7638]/10 group-hover:scale-110 transition-transform duration-700">
              <Clock className="w-8 h-8" />
            </div>
            <span className="text-white/20 text-4xl font-serif italic font-light">02</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] mb-2">Pending Audits</p>
            <h4 className="text-5xl font-display font-black text-white group-hover:text-[#ff7638] transition-colors">{loading ? "-" : stats.pending}</h4>
          </div>
        </div>
      </motion.div>

      {/* Offerwall CTA */}
      <motion.div variants={itemVariants} className="premium-card bg-[#1a0f0a]/50 border-brand/20 !p-12 !rounded-[2.5rem] group overflow-hidden relative">
        <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-brand/10 to-transparent pointer-events-none"></div>
        <div className="absolute top-0 right-10 p-12 opacity-10 mix-blend-overlay pointer-events-none group-hover:scale-110 group-hover:rotate-12 transition-transform duration-1000">
          <TrendingUp className="w-64 h-64 text-brand" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
          <div className="max-w-2xl text-center md:text-left">
            <h3 className="text-4xl font-display font-bold text-white mb-4 tracking-tight">Expand Operational Scope</h3>
            <p className="text-white/50 text-lg leading-relaxed font-serif italic">
              Integrate with tier-1 partner networks to unlock bespoke, high-yield bounty operations. Only accessible via the Global Offerwall structure.
            </p>
          </div>
          <Link to="/offerwall" className="btn-primary !px-12 !py-6 whitespace-nowrap !rounded-[1.5rem] bg-white text-[#0a0502] hover:bg-white/90 shadow-[0_0_40px_rgba(255,255,255,0.2)] hover:shadow-[0_0_60px_rgba(255,255,255,0.4)]">
            <span className="relative z-10 flex items-center font-display tracking-widest text-sm uppercase">
              Initialize Portal
            </span>
          </Link>
        </div>
      </motion.div>

    </motion.div>
  );
}
