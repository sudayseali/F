import { Copy, Users, Gift, Share2, CheckCircle2, ChevronLeft, ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { useTelegram } from "../contexts/TelegramContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { tgHaptics, openTgLink, tgBackButton } from "../lib/telegram";
import { ASSETS_3D } from "../lib/assets";
import { APP_CONFIG } from "../config/appConfig";

export function Referrals() {
  const navigate = useNavigate();
  const { user } = useTelegram();
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading, setLoading] = useState(true);

  const refCode = user?.id ? `ref_${user.id}` : "ref_user";
  const refLink = `${APP_CONFIG.telegram.botUrl}?start=${refCode}`;

  useEffect(() => {
    tgBackButton.show(() => navigate(-1));
    return () => tgBackButton.hide();
  }, [navigate]);

  useEffect(() => {
    async function fetchReferrals() {
      if (!user?.uuid) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await supabase
          .from("referrals")
          .select("*, referred:referred_user_id(first_name, username)")
          .eq("referrer_id", user.uuid)
          .order("created_at", { ascending: false });

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
    tgHaptics.impact("medium");
    navigator.clipboard.writeText(refLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareToTelegram = () => {
    tgHaptics.impact("medium");
    const text = "Join me on Payvora and earn money completing simple offers and surveys!";
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`;
    openTgLink(shareUrl);
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Top Back Nav */}
      <button
        onClick={() => {
          tgHaptics.impact("light");
          navigate(-1);
        }}
        className="flex items-center gap-1.5 text-xs font-bold text-[#38bdf8] active:opacity-70"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      {/* Hero Invite Card matching Screen 6 */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#4c1d95] via-[#3b0764] to-[#1e1b4b] border border-purple-500/40 p-5 text-center shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

        <div className="mx-auto mb-2 flex justify-center">
          <div className="w-16 h-16 rounded-full bg-purple-500/30 border border-purple-400/40 flex items-center justify-center shadow-inner">
            <img
              src={ASSETS_3D.giftBox}
              alt="3D Purple Gift Box"
              className="w-12 h-12 object-contain drop-shadow-[0_8px_16px_rgba(168,85,247,0.55)]"
            />
          </div>
        </div>

        <h2 className="text-xl font-black text-white tracking-tight mb-1">
          Invite Friends & Earn
        </h2>
        <p className="text-xs text-purple-200/90 max-w-xs mx-auto mb-4 leading-relaxed">
          Receive a <span className="text-white font-extrabold">10% bonus</span> on every offer and task your invited friends complete.
        </p>

        {/* Share buttons */}
        <div className="flex gap-2">
          <button
            onClick={shareToTelegram}
            className="flex-1 py-3 px-4 rounded-xl btn-cyan-glow text-white font-extrabold text-xs shadow-lg transition active:scale-98 flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            <span>Invite Friends</span>
          </button>

          <button
            onClick={copyToClipboard}
            className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition active:scale-98 flex items-center justify-center gap-1.5"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-purple-200" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Referral Stats matching Screen 6 */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="card-glass-dark p-3.5 rounded-2xl">
          <div className="text-[11px] text-slate-400 font-medium mb-0.5">Friends Invited</div>
          <div className="text-2xl font-black text-white tabular-nums">{referrals.length}</div>
        </div>

        <div className="card-glass-dark p-3.5 rounded-2xl">
          <div className="text-[11px] text-slate-400 font-medium mb-0.5">Commission Earned</div>
          <div className="text-2xl font-black text-emerald-400 tabular-nums">
            ${totalEarned.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Friends List matching Screen 6 */}
      <div className="card-glass-dark p-4 space-y-3 rounded-2xl">
        <h3 className="text-xs font-bold text-white tracking-tight">
          My Referrals ({referrals.length})
        </h3>

        {loading ? (
          <div className="py-6 text-center text-xs text-slate-400">Loading referrals...</div>
        ) : referrals.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <img
              src={ASSETS_3D.communityUsers}
              alt="Community"
              className="w-16 h-16 object-contain mx-auto drop-shadow-md"
            />
            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              No referrals yet. Share your invite link to start earning together!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((ref) => (
              <div
                key={ref.id}
                className="p-3 rounded-xl bg-[#0c162e] border border-white/5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 text-[#c084fc] flex items-center justify-center font-bold text-xs">
                    {(ref.referred?.first_name || "U")[0]}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">
                      {ref.referred?.first_name || "Telegram User"}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Joined {new Date(ref.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="badge-green-pill text-xs font-bold px-2 py-0.5 rounded-full">
                  +${Number(ref.total_commission_earned || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
