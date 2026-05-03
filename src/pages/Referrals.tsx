import { Copy, Users, Gift, Share2, CheckCircle2, TrendingUp, Link as LinkIcon, Network } from "lucide-react";
import { useState, useEffect } from "react";
import { useTelegram } from "../contexts/TelegramContext";
import { supabase } from "../lib/supabase";
import { motion, AnimatePresence } from "motion/react";

export function Referrals() {
  const { user } = useTelegram();
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading, setLoading] = useState(true);

  const refCode = user?.id ? `ref_${user.id}` : "ref_12345";
  const refLink = `https://t.me/PayvoraBot?start=${refCode}`;

  useEffect(() => {
    async function fetchReferrals() {
      if (!user?.uuid) return;
      try {
        const { data, error } = await supabase
          .from('referrals')
          .select('*, referred:referred_user_id(first_name, username)')
          .eq('referrer_id', user.uuid)
          .order('created_at', { ascending: false });

        if (data) {
          setReferrals(data);
          const earned = data.reduce((acc, curr) => acc + Number(curr.total_commission_earned || 0), 0);
          setTotalEarned(earned);
        }
      } catch (err) {
        console.error("Error fetching referrals:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchReferrals();
  }, [user?.uuid]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(refLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareToTelegram = () => {
    const text = "Join me on Payvora and earn money completing simple offers!";
    const url = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`;
    if ((window as any).Telegram?.WebApp?.openTelegramLink) {
      (window as any).Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12 pb-24"
    >
      <header className="text-center lg:text-left relative pt-4">
        <span className="inline-block px-4 py-1.5 rounded-full bg-[#111827] text-brand text-[10px] font-bold uppercase tracking-[0.3em] mb-6 border border-brand/20 shadow-inner">
          Affiliate Architecture
        </span>
        <h1 className="text-5xl lg:text-6xl font-serif font-bold text-white tracking-tight mb-6 flex flex-col md:flex-row md:items-baseline gap-2">
          Network <span className="font-light italic text-white/50">Expansion</span>
        </h1>
        <p className="text-white/50 max-w-2xl text-lg font-serif">
          Construct your autonomous revenue stream by onboarding new nodes to the Payvora ecosystem.
        </p>
      </header>

      {/* Hero Card */}
      <div className="relative group perspective">
        <div className="absolute -inset-1 bg-gradient-to-r from-brand/40 to-brand-light/40 rounded-[3rem] blur-2xl opacity-30 group-hover:opacity-50 transition duration-1000"></div>
        <div className="relative premium-card overflow-hidden !p-12 !rounded-[2.5rem] border-white/10 bg-gradient-to-br from-[#111827] to-[#0A0E1A]">
          <div className="absolute top-0 right-0 p-12 opacity-5 mix-blend-overlay pointer-events-none group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-1000 origin-center">
            <Network className="w-96 h-96 text-brand" />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center max-w-3xl mx-auto">
            <div className="w-24 h-24 bg-brand/5 rounded-[2rem] flex items-center justify-center mb-10 border border-brand/20 shadow-inner group-hover:scale-110 transition-transform duration-700">
              <TrendingUp className="w-12 h-12 text-brand drop-shadow-[0_0_15px_rgba(255,78,0,0.5)]" />
            </div>
            <h2 className="text-4xl lg:text-5xl font-display font-black text-white mb-6 tracking-tight">10% Perpetual Override</h2>
            <p className="text-white/40 text-xl mb-12 leading-relaxed font-serif italic max-w-2xl">
              Unlock a lifetime 10% royalty on all platform distributions generated across your entire direct referral matrix.
            </p>
            
            <div className="w-full space-y-6 max-w-xl mx-auto">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 bg-[#0A0E1A]/80 border border-white/10 rounded-[1.5rem] p-5 flex items-center shadow-inner group-hover:border-brand/30 transition-colors">
                  <LinkIcon className="w-5 h-5 text-white/30 mr-4 shrink-0" />
                  <p className="text-sm font-mono text-white/60 truncate flex-1 text-left select-all">
                    {refLink}
                  </p>
                </div>
                <button 
                  onClick={copyToClipboard}
                  className="btn-primary !py-5 min-w-[160px] !rounded-[1.5rem]"
                >
                  {copied ? <CheckCircle2 className="w-5 h-5 mr-3" /> : <Copy className="w-5 h-5 mr-3" />}
                  {copied ? "Secured" : "Copy Target"}
                </button>
              </div>
              <button 
                onClick={shareToTelegram}
                className="w-full flex items-center justify-center space-x-3 bg-white/[0.02] hover:bg-white/5 text-white rounded-[1.5rem] py-6 transition-all duration-500 border border-white/10 font-bold hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] active:scale-95"
              >
                <Share2 className="w-6 h-6 text-brand drop-shadow-[0_0_8px_rgba(255,78,0,0.5)]" />
                <span className="font-display tracking-widest text-sm uppercase">Broadcast to Telegram Nodes</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="premium-card flex flex-col justify-between group hover-lift !p-10 !rounded-[2.5rem]">
          <div className="flex items-center justify-between mb-8">
            <div className="w-16 h-16 rounded-[1.2rem] bg-brand/5 flex items-center justify-center text-brand border border-brand/10 group-hover:scale-110 transition-transform duration-700">
              <Users className="w-8 h-8" />
            </div>
            <span className="text-white/20 text-4xl font-serif italic font-light">Nodes</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] mb-2">Active Protocol Partners</p>
            <h4 className="text-5xl font-display font-black text-white group-hover:text-brand transition-colors">{referrals.length}</h4>
          </div>
        </div>
        
        <div className="premium-card flex flex-col justify-between group hover-lift !p-10 !rounded-[2.5rem]">
          <div className="flex items-center justify-between mb-8">
            <div className="w-16 h-16 rounded-[1.2rem] bg-emerald-500/5 flex items-center justify-center text-emerald-500 border border-emerald-500/10 group-hover:scale-110 transition-transform duration-700">
              <Gift className="w-8 h-8" />
            </div>
            <span className="text-white/20 text-4xl font-serif italic font-light">Yield</span>
          </div>
          <div>
            <p className="text-[11px] font-bold text-white/40 uppercase tracking-[0.2em] mb-2">Aggregate Ecosystem Yield</p>
            <h4 className="text-5xl font-display font-black text-emerald-400 group-hover:text-emerald-300 transition-colors drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">${totalEarned.toFixed(2)}</h4>
          </div>
        </div>
      </div>

      {/* Referrals Ledger */}
      <div className="space-y-8">
        <h3 className="text-3xl font-serif font-light text-white flex items-center">
          Network <span className="font-bold ml-2">Ledger</span>
          <span className="ml-6 h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
        </h3>
        
        <div className="premium-card !p-0 border-white/5 overflow-hidden !rounded-[2rem] bg-[#111827]/80 backdrop-blur-3xl">
          {loading ? (
             <div className="p-16 text-center text-white/30 font-bold uppercase tracking-[0.3em] font-mono animate-pulse">Scanning Telemetry...</div>
          ) : referrals.length === 0 ? (
             <div className="p-24 text-center flex flex-col items-center justify-center">
               <div className="w-24 h-24 rounded-[2rem] bg-white/[0.02] border border-white/5 flex items-center justify-center mb-8 shadow-inner">
                 <Network className="w-12 h-12 text-white/20" />
               </div>
               <p className="text-white font-display font-bold text-3xl mb-4 tracking-tight">No Active Links</p>
               <p className="text-white/40 text-lg max-w-md mx-auto text-balance font-serif italic">
                 Your affiliate node matrix is currently suspended. Initialize the broadcast protocol above to onboard your first partner node.
               </p>
             </div>
          ) : (
            <div className="divide-y divide-white/5">
              {referrals.map((ref, i) => {
                const name = ref.referred?.first_name || ref.referred?.username || 'Partner';
                return (
                  <motion.div 
                    key={ref.id} 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="p-8 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-white/[0.02] transition-colors duration-500 group gap-6"
                  >
                    <div className="flex items-center space-x-6">
                      <div className="w-16 h-16 rounded-[1.2rem] bg-brand/5 border border-brand/10 text-brand flex items-center justify-center font-display font-black text-2xl group-hover:bg-brand/20 transition-all duration-500 shadow-inner">
                        {name[0].toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-xl group-hover:text-brand transition-colors tracking-tight">{name}</h4>
                        <div className="flex items-center space-x-2 mt-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500/70" />
                          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest font-mono">Synced {new Date(ref.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                    <div className="sm:text-right bg-white/[0.02] sm:bg-transparent p-4 sm:p-0 rounded-[1.5rem] sm:rounded-none border sm:border-0 border-white/5">
                      <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em] mb-2 sm:mb-1">Matrix Yield</p>
                      <p className="font-display font-black text-emerald-400 text-3xl drop-shadow-[0_0_10px_rgba(16,185,129,0.2)]">${Number(ref.total_commission_earned).toFixed(2)}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
