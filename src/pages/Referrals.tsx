import { Copy, Users, Gift, Share2, CheckCircle2, ChevronLeft, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useTelegram } from "../contexts/TelegramContext";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { tgHaptics, openTgLink, tgBackButton } from "../lib/telegram";

export function Referrals() {
  const navigate = useNavigate();
  const { user } = useTelegram();
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading, setLoading] = useState(true);

  const refCode = user?.id ? `ref_${user.id}` : "ref_user";
  const refLink = `https://t.me/PayvoraBot?start=${refCode}`;

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
      {/* Top back nav */}
      <button
        onClick={() => {
          tgHaptics.impact("light");
          navigate(-1);
        }}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#2481cc] active:opacity-70"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      {/* Hero Invite Card */}
      <div className="relative rounded-2xl bg-gradient-to-b from-[#1c2733] to-[#141d27] border border-white/10 p-5 text-center shadow-xl overflow-hidden">
        <div className="w-14 h-14 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center mx-auto mb-3 border border-purple-500/20 shadow-md">
          <Gift className="w-7 h-7" />
        </div>

        <h2 className="text-lg font-bold text-white mb-1">Invite Friends & Earn</h2>
        <p className="text-xs text-[#7e8c9b] max-w-xs mx-auto mb-4">
          Receive a <span className="text-white font-semibold">10% bonus</span> on every offer and task your invited friends complete.
        </p>

        {/* Share buttons */}
        <div className="flex gap-2">
          <button
            onClick={shareToTelegram}
            className="flex-1 py-3 px-4 rounded-xl bg-[#2481cc] hover:bg-[#1a6cb3] text-white font-bold text-xs shadow-md shadow-[#2481cc]/25 transition active:scale-98 flex items-center justify-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            <span>Invite Friends</span>
          </button>

          <button
            onClick={copyToClipboard}
            className="py-3 px-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-semibold text-xs border border-white/10 transition active:scale-98 flex items-center justify-center gap-1.5"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#7e8c9b]" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Referral Stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className="tg-card p-3">
          <div className="text-[10px] text-[#7e8c9b] font-medium mb-0.5">Friends Invited</div>
          <div className="text-lg font-bold text-white tabular-nums">{referrals.length}</div>
        </div>

        <div className="tg-card p-3">
          <div className="text-[10px] text-[#7e8c9b] font-medium mb-0.5">Commission Earned</div>
          <div className="text-lg font-bold text-emerald-400 tabular-nums">
            ${totalEarned.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Friends List */}
      <div className="tg-card p-4 space-y-3">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider text-[#7e8c9b]">
          My Referrals ({referrals.length})
        </h3>

        {loading ? (
          <div className="py-6 text-center text-xs text-[#7e8c9b]">Loading referrals...</div>
        ) : referrals.length === 0 ? (
          <div className="py-6 text-center text-xs text-[#7e8c9b]">
            No referrals yet. Share your invite link to start earning!
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map((ref) => (
              <div
                key={ref.id}
                className="p-2.5 rounded-xl bg-[#0e1621] border border-white/5 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#2481cc]/20 text-[#2481cc] flex items-center justify-center font-bold text-xs">
                    {(ref.referred?.first_name || "U")[0]}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {ref.referred?.first_name || "Telegram User"}
                    </div>
                    <div className="text-[10px] text-[#7e8c9b]">
                      Joined {new Date(ref.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-xs font-semibold text-emerald-400">
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
