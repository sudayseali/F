import { 
  ArrowUpRight, CheckCircle, Clock, Wallet, Shield, 
  Coins, Sparkles, Layers, Users, ChevronRight, Gift, Flame, Play, Star
} from "lucide-react";
import { useTelegram } from "../contexts/TelegramContext";
import { motion } from "motion/react";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import { tgHaptics } from "../lib/telegram";

export function Dashboard() {
  const { user } = useTelegram();
  const displayName = user?.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Payvora User";
  const balance = user?.balance || 0;
  
  const [stats, setStats] = useState({
    completed: 0,
    pending: 0,
    referrals: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const [dailyClaimed, setDailyClaimed] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      if (!user?.uuid) {
        setLoading(false);
        return;
      }
      
      try {
        const { data: subs } = await supabase
          .from('submissions')
          .select('status')
          .eq('worker_id', user.uuid);
          
        if (subs) {
          setStats(prev => ({
            ...prev,
            completed: subs.filter(s => s.status === 'approved').length,
            pending: subs.filter(s => s.status === 'pending').length,
          }));
        }
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [user?.uuid]);

  const handleClaimDaily = () => {
    tgHaptics.impact("medium");
    setDailyClaimed(true);
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Telegram User Balance Hero Card */}
      <div className="relative rounded-2xl bg-gradient-to-b from-[#1c2733] to-[#141d27] border border-white/10 p-5 text-center shadow-xl overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#2481cc]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-center gap-1.5 text-xs text-[#7e8c9b] mb-1">
          <Coins className="w-3.5 h-3.5 text-amber-400" />
          <span>Available Balance</span>
        </div>

        {/* Big Balance Number */}
        <div className="text-3xl font-extrabold text-white tracking-tight my-1 tabular-nums">
          ${balance.toFixed(2)}
        </div>
        <div className="text-xs text-[#7e8c9b] font-medium mb-4">
          ≈ {(balance * 1000).toLocaleString()} Points
        </div>

        {/* 4 Telegram Quick Action Buttons */}
        <div className="grid grid-cols-4 gap-2 pt-1 border-t border-white/5">
          <Link
            to="/offerwall"
            onClick={() => tgHaptics.selection()}
            className="flex flex-col items-center gap-1 py-2 rounded-xl bg-white/5 hover:bg-[#2481cc]/15 transition active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-[#2481cc]/20 text-[#2481cc] flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-semibold text-white">Offers</span>
          </Link>

          <Link
            to="/tasks"
            onClick={() => tgHaptics.selection()}
            className="flex flex-col items-center gap-1 py-2 rounded-xl bg-white/5 hover:bg-emerald-500/15 transition active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-semibold text-white">Tasks</span>
          </Link>

          <Link
            to="/wallet"
            onClick={() => tgHaptics.selection()}
            className="flex flex-col items-center gap-1 py-2 rounded-xl bg-white/5 hover:bg-amber-500/15 transition active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-semibold text-white">Withdraw</span>
          </Link>

          <Link
            to="/referrals"
            onClick={() => tgHaptics.selection()}
            className="flex flex-col items-center gap-1 py-2 rounded-xl bg-white/5 hover:bg-purple-500/15 transition active:scale-95"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-semibold text-white">Friends</span>
          </Link>
        </div>
      </div>

      {/* Daily Reward / Streak Card */}
      <div className="tg-card p-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center border border-amber-500/20">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white">Daily Check-In</span>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 font-semibold px-1.5 py-0.2 rounded">
                +50 PTS
              </span>
            </div>
            <p className="text-[11px] text-[#7e8c9b]">Claim daily rewards every 24 hours</p>
          </div>
        </div>

        <button
          onClick={handleClaimDaily}
          disabled={dailyClaimed}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition active:scale-95 ${
            dailyClaimed
              ? "bg-white/10 text-white/40 cursor-not-allowed"
              : "bg-[#2481cc] hover:bg-[#1a6cb3] text-white shadow-sm"
          }`}
        >
          {dailyClaimed ? "Claimed" : "Claim"}
        </button>
      </div>

      {/* Featured Offerwalls / Surveys */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-white">Featured Offerwalls</span>
          <Link
            to="/offerwall"
            onClick={() => tgHaptics.selection()}
            className="text-[11px] font-semibold text-[#2481cc] flex items-center gap-0.5"
          >
            <span>See All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* CPX Research */}
          <Link
            to="/offerwall"
            onClick={() => tgHaptics.selection()}
            className="tg-card p-3 flex flex-col justify-between hover:border-[#2481cc]/40 transition active:scale-98"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <Star className="w-4 h-4" />
              </div>
              <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                Hot
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-white">CPX Surveys</div>
              <p className="text-[10px] text-emerald-400 font-medium">Up to $4.50</p>
            </div>
          </Link>

          {/* ayeT Studios */}
          <Link
            to="/offerwall"
            onClick={() => tgHaptics.selection()}
            className="tg-card p-3 flex flex-col justify-between hover:border-emerald-500/40 transition active:scale-98"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <Play className="w-4 h-4" />
              </div>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                Games
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-white">ayeT-Studios</div>
              <p className="text-[10px] text-emerald-400 font-medium">Up to $35.00</p>
            </div>
          </Link>
        </div>
      </div>

      {/* User Stats 2-column cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="tg-card p-3">
          <div className="text-[10px] text-[#7e8c9b] font-medium mb-1">Approved Tasks</div>
          <div className="text-xl font-bold text-white tabular-nums">
            {loading ? "-" : stats.completed}
          </div>
        </div>

        <div className="tg-card p-3">
          <div className="text-[10px] text-[#7e8c9b] font-medium mb-1">Pending Review</div>
          <div className="text-xl font-bold text-amber-400 tabular-nums">
            {loading ? "-" : stats.pending}
          </div>
        </div>
      </div>
    </div>
  );
}
