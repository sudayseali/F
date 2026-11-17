import {
  Clock, Wallet, CheckCircle, TrendingUp, ArrowRight, ChevronRight
} from "lucide-react";
import { useTelegram } from "../contexts/TelegramContext";
import { useState, useEffect } from "react";
import { supabase, invokeEdgeFunction } from "../lib/supabase";
import { Link } from "react-router-dom";
import { tgHaptics } from "../lib/telegram";
import { ASSETS_3D } from "../lib/assets";
import { APP_CONFIG } from "../config/appConfig";
import { TelegramModal } from "../components/TelegramModal";
import { PayvoraSpinner } from "../components";

export function Dashboard() {
  const { user, refreshUser } = useTelegram();
  const balance = user?.balance || 0;

  const [stats, setStats] = useState({
    completed: 0,
    pending: 0,
  });

  const [loading, setLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [dailyClaimed, setDailyClaimed] = useState(false);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "info" | "error" | "success";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info"
  });

  useEffect(() => {
    async function fetchStatsAndDailyState() {
      if (!user?.uuid) {
        setLoading(false);
        return;
      }

      try {
        const [subsRes, userRes] = await Promise.all([
          supabase
            .from("submissions")
            .select("status")
            .eq("user_id", user.uuid),
          supabase
            .from("users")
            .select("last_daily_claim_at")
            .eq("id", user.uuid)
            .maybeSingle(),
        ]);

        if (subsRes.data) {
          setStats({
            completed: subsRes.data.filter(s => s.status === "approved").length,
            pending: subsRes.data.filter(s => s.status === "pending").length,
          });
        }

        if (userRes.data?.last_daily_claim_at) {
          const lastClaimMs = new Date(userRes.data.last_daily_claim_at).getTime();
          if (Number.isFinite(lastClaimMs) && Date.now() - lastClaimMs < 24 * 3600 * 1000) {
            setDailyClaimed(true);
          }
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStatsAndDailyState();
  }, [user?.uuid]);

  const handleClaimDaily = async () => {
    if (isClaiming || dailyClaimed) return;

    if (!user?.uuid) {
      setModalState({
        isOpen: true,
        title: "Authentication Required",
        message: `Please open Payvora via @${APP_CONFIG.telegram.botUsername} to authenticate your session before claiming rewards.`,
        type: "error"
      });
      return;
    }

    tgHaptics.impact("medium");
    setIsClaiming(true);

    try {
      await invokeEdgeFunction("daily_checkin", {});
      setDailyClaimed(true);
      await refreshUser();
      tgHaptics.notification("success");
      setModalState({
        isOpen: true,
        title: "Daily Reward Claimed!",
        message: "You have received +50 Points ($0.05) credited directly to your Payvora wallet balance.",
        type: "success"
      });
    } catch (err: any) {
      const rawMsg = err?.message || "";
      const code = err?.code || "";
      const isAlreadyClaimed =
        code === "ALREADY_CLAIMED" ||
        rawMsg.toLowerCase().includes("already claimed") ||
        rawMsg.toLowerCase().includes("hours");

      if (isAlreadyClaimed) {
        setDailyClaimed(true);
        setModalState({
          isOpen: true,
          title: "Daily Check-In",
          message: rawMsg || "Daily reward already claimed today.",
          type: "info"
        });
      } else {
        const isAuthIssue =
          code === "UNAUTHORIZED" ||
          rawMsg.includes("INVALID_SESSION") ||
          rawMsg.includes("JWS") ||
          rawMsg.includes("Unauthorized");
        setModalState({
          isOpen: true,
          title: isAuthIssue ? "Session Expired" : "Daily Check-In",
          message: isAuthIssue
            ? `Your Telegram session has expired or is invalid. Please restart the app from @${APP_CONFIG.telegram.botUsername}.`
            : (rawMsg || "Could not claim daily reward right now. Please try again later."),
          type: "error"
        });
      }
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Hero Balance Card */}
      <div className="hero-balance-card p-5 relative overflow-hidden flex items-center justify-between">
        <div className="absolute top-0 right-0 w-44 h-44 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="shrink-0 -ml-2 -my-2 relative">
          <img
            src={ASSETS_3D.telegramWallet}
            alt="3D Telegram Wallet"
            className="w-28 h-28 object-contain drop-shadow-[0_12px_28px_rgba(0,136,204,0.65)] transform -rotate-2 hover:rotate-0 transition-transform duration-300"
          />
        </div>

        <div className="flex-1 pl-3 text-right">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-white/90 mb-1 border border-white/10 shadow-sm">
            <Wallet className="w-3.5 h-3.5 text-sky-200" />
            <span>Available Balance</span>
          </div>

          <div className="text-4xl font-black text-white tracking-tight tabular-nums my-0.5">
            ${balance.toFixed(2)}
          </div>

          <div className="flex items-center justify-end gap-1 text-xs text-sky-200/90 font-medium">
            <span className="text-amber-300">⭐</span>
            <span>≈ {(balance * APP_CONFIG.pointsRatio).toLocaleString()} Points</span>
          </div>
        </div>

        <Link
          to="/wallet"
          onClick={() => tgHaptics.selection()}
          className="ml-3 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center text-white transition active:scale-90 shrink-0 border border-white/10 shadow-sm"
        >
          <ChevronRight className="w-5 h-5" />
        </Link>
      </div>

      {/* 4 Quick Action Buttons */}
      <div className="grid grid-cols-4 gap-2.5">
        <Link
          to="/offerwall"
          onClick={() => tgHaptics.selection()}
          className="card-glass-dark p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:border-sky-400/40 transition active:scale-95 group shadow-lg"
        >
          <div className="w-11 h-11 rounded-xl bg-purple-500/15 flex items-center justify-center group-hover:scale-105 transition-transform">
            <img
              src={ASSETS_3D.giftBox}
              alt="3D Offers Gift"
              className="w-8 h-8 object-contain drop-shadow-sm"
            />
          </div>
          <span className="text-xs font-bold text-white tracking-tight">Offers</span>
        </Link>

        <Link
          to="/tasks"
          onClick={() => tgHaptics.selection()}
          className="card-glass-dark p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:border-emerald-400/40 transition active:scale-95 group shadow-lg"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center group-hover:scale-105 transition-transform">
            <img
              src={ASSETS_3D.tasksClipboard}
              alt="3D Tasks"
              className="w-8 h-8 object-contain drop-shadow-sm"
            />
          </div>
          <span className="text-xs font-bold text-white tracking-tight">Tasks</span>
        </Link>

        <Link
          to="/wallet"
          onClick={() => tgHaptics.selection()}
          className="card-glass-dark p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:border-amber-400/40 transition active:scale-95 group shadow-lg"
        >
          <div className="w-11 h-11 rounded-xl bg-amber-500/15 flex items-center justify-center group-hover:scale-105 transition-transform">
            <img
              src={ASSETS_3D.walletCoins}
              alt="3D Wallet"
              className="w-8 h-8 object-contain drop-shadow-sm"
            />
          </div>
          <span className="text-xs font-bold text-white tracking-tight">Withdraw</span>
        </Link>

        <Link
          to="/referrals"
          onClick={() => tgHaptics.selection()}
          className="card-glass-dark p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:border-purple-400/40 transition active:scale-95 group shadow-lg"
        >
          <div className="w-11 h-11 rounded-xl bg-purple-500/15 flex items-center justify-center group-hover:scale-105 transition-transform">
            <img
              src={ASSETS_3D.communityUsers}
              alt="3D Friends"
              className="w-8 h-8 object-contain drop-shadow-sm"
            />
          </div>
          <span className="text-xs font-bold text-white tracking-tight">Friends</span>
        </Link>
      </div>

      {/* Daily Check-In Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0369a1] via-[#1d4ed8] to-[#2563eb] p-3.5 flex items-center justify-between border border-sky-400/30 shadow-lg">
        <div className="absolute right-16 top-2 text-sky-200/40 text-xs select-none">✦</div>
        <div className="absolute right-24 bottom-2 text-sky-200/40 text-[10px] select-none">✦</div>

        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#0284c7]/30 border border-sky-400/40 flex items-center justify-center shadow-inner shrink-0">
            <img
              src={ASSETS_3D.calendarCheck}
              alt="3D Calendar"
              className="w-9 h-9 object-contain drop-shadow-md"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Daily Check-In</h3>
              <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-extrabold px-1.5 py-0.2 rounded-md">
                +{APP_CONFIG.rewards.dailyCheckInPoints} PTS
              </span>
            </div>
            <p className="text-[11px] text-sky-100/80 mt-0.5">Claim daily rewards every 24 hours</p>
          </div>
        </div>

        <button
          onClick={handleClaimDaily}
          disabled={dailyClaimed || isClaiming}
          className={`btn-cyan-glow px-5 py-2 rounded-xl text-xs font-extrabold text-white shrink-0 shadow-lg flex items-center justify-center gap-1.5 ${
            dailyClaimed || isClaiming ? "opacity-60 cursor-not-allowed" : "hover:brightness-110 active:scale-95"
          }`}
        >
          {isClaiming ? (
            <>
              <PayvoraSpinner size="xs" />
              <span>Claiming...</span>
            </>
          ) : dailyClaimed ? "Claimed" : "Claim"}
        </button>
      </div>

      {/* Featured Offers Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[#38bdf8] text-base">⭐</span>
            <span className="text-base font-bold text-white tracking-tight">Offers Marketplace</span>
          </div>
          <Link
            to="/offerwall"
            onClick={() => tgHaptics.selection()}
            className="text-xs font-bold text-[#38bdf8] hover:text-sky-300 flex items-center gap-0.5"
          >
            <span>Explore All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <Link
            to="/offerwall"
            onClick={() => tgHaptics.selection()}
            className="card-glow-blue p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between cursor-pointer group hover:border-sky-400/50 transition-all active:scale-98"
          >
            <div className="absolute -right-2 -bottom-2 opacity-15 pointer-events-none">
              <img src={ASSETS_3D.surveyPencil} alt="" className="w-20 h-20 object-contain" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 flex items-center justify-center border border-sky-500/30 shadow-sm">
                  <img src={ASSETS_3D.surveyPencil} alt="Surveys" className="w-7 h-7 object-contain" />
                </div>
                <span className="text-[10px] font-extrabold text-sky-300 uppercase tracking-wider">
                  Surveys
                </span>
              </div>

              <h4 className="text-sm font-bold text-white group-hover:text-[#38bdf8] transition-colors">
                Paid Surveys
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Live research & instant credit
              </p>
            </div>

            <div className="text-xs font-extrabold text-emerald-400 tabular-nums flex items-center gap-1 mt-3">
              <span>Up to $4.50</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            to="/offerwall"
            onClick={() => tgHaptics.selection()}
            className="card-glow-purple p-4 rounded-2xl relative overflow-hidden flex flex-col justify-between cursor-pointer group hover:border-purple-400/50 transition-all active:scale-98"
          >
            <div className="absolute -right-2 -bottom-2 opacity-15 pointer-events-none">
              <img src={ASSETS_3D.gameController} alt="" className="w-20 h-20 object-contain" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/30 shadow-sm">
                  <img src={ASSETS_3D.gameController} alt="Games" className="w-7 h-7 object-contain" />
                </div>
                <span className="text-[10px] font-extrabold text-purple-300 uppercase tracking-wider">
                  Games & Apps
                </span>
              </div>

              <h4 className="text-sm font-bold text-white group-hover:text-[#c084fc] transition-colors">
                Partner Offers
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Play games, apps & earn
              </p>
            </div>

            <div className="text-xs font-extrabold text-emerald-400 tabular-nums flex items-center gap-1 mt-3">
              <span>Up to $35.00</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="card-glass-dark p-3.5 rounded-2xl flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-[#34d399] flex items-center justify-center border border-emerald-500/20 shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Approved Tasks</div>
              <div className="text-xl font-black text-white tabular-nums">
                {loading ? "-" : stats.completed}
              </div>
            </div>
          </div>
          <TrendingUp className="w-6 h-6 text-sky-500/30" />
        </div>

        <div className="card-glass-dark p-3.5 rounded-2xl flex items-center justify-between relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-[#fbbf24] flex items-center justify-center border border-amber-500/20 shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">Pending Review</div>
              <div className="text-xl font-black text-white tabular-nums">
                {loading ? "-" : stats.pending}
              </div>
            </div>
          </div>
          <Clock className="w-6 h-6 text-slate-600/30" />
        </div>
      </div>

      {/* Invite Friends & Earn Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4c1d95] via-[#3b0764] to-[#1e1b4b] border border-purple-500/30 p-4 flex items-center justify-between shadow-xl">
        <div className="absolute left-1/3 top-2 text-purple-300/40 text-xs">✦</div>

        <div className="flex items-center gap-3">
          <img
            src={ASSETS_3D.giftPurple}
            alt="3D Purple Gift Box"
            className="w-13 h-13 object-contain drop-shadow-[0_8px_16px_rgba(168,85,247,0.5)] shrink-0"
          />
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Invite Friends & Earn
            </h3>
            <p className="text-[11px] text-purple-200/80 mt-0.5">
              Receive a {APP_CONFIG.rewards.referralBonusPercent}% bonus on every offer!
            </p>
          </div>
        </div>

        <Link
          to="/referrals"
          onClick={() => tgHaptics.selection()}
          className="bg-white hover:bg-slate-100 text-slate-950 font-extrabold text-xs px-3.5 py-2 rounded-full shadow-lg flex items-center gap-1 shrink-0 active:scale-95 transition-transform"
        >
          <span>Invite Now</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <TelegramModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState(prev => ({ ...prev, isOpen: false }))}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      />
    </div>
  );
}
