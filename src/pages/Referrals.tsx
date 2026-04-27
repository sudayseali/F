import { Copy, Users, Gift, Share2, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useTelegram } from "../contexts/TelegramContext";
import { supabase } from "../lib/supabase";

export function Referrals() {
  const { user } = useTelegram();
  const [copied, setCopied] = useState(false);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [totalEarned, setTotalEarned] = useState(0);
  const [loading, setLoading] = useState(true);

  // Generate real referral link based on user's Telegram ID
  const refCode = user?.id ? `ref_${user.id}` : "ref_12345";
  const refLink = `https://t.me/TaskMasterBot?start=${refCode}`;

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
          const earned = data.reduce((acc, curr) => acc + Number(curr.earned || 0), 0);
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
    const text = "Join me on TaskMaster and earn money completing simple tasks!";
    const url = `https://t.me/share/url?url=${encodeURIComponent(refLink)}&text=${encodeURIComponent(text)}`;
    
    // Use Telegram WebApp API if available, otherwise fallback to web link
    if ((window as any).Telegram?.WebApp?.openTelegramLink) {
      (window as any).Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Referrals</h1>
        <p className="text-gray-500 text-sm">Invite friends and earn together.</p>
      </header>

      {/* Hero Card */}
      <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl p-6 text-gray-900 dark:text-white shadow-lg text-center relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
            <Gift className="w-8 h-8 text-gray-900 dark:text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Earn 10% for Life!</h2>
          <p className="text-indigo-100 text-sm max-w-xs mx-auto mb-6">
            Get 10% of all earnings from users who sign up using your referral link.
          </p>
          
          <div className="w-full space-y-3">
            <div className="w-full bg-black/20 p-1.5 rounded-xl flex items-center backdrop-blur-sm border border-white/10">
              <div className="flex-1 overflow-x-auto scrollbar-hide px-3 py-2 text-left">
                <p className="text-sm font-mono text-white/90 whitespace-nowrap">
                  {refLink}
                </p>
              </div>
              <button 
                onClick={copyToClipboard}
                className="bg-white text-indigo-600 px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center hover:bg-indigo-50 transition-all shadow-sm ml-2 shrink-0 active:scale-95"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 mr-1.5 text-green-500" /> : <Copy className="w-4 h-4 mr-1.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <button 
              onClick={shareToTelegram}
              className="w-full bg-blue-500 hover:bg-blue-400 text-white rounded-xl py-3 font-bold text-sm flex items-center justify-center transition-colors shadow-sm"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share on Telegram
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-[#111218] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center space-x-2 text-gray-500 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Total Invited</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{referrals.length}</p>
        </div>
        
        <div className="bg-white dark:bg-[#111218] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
          <div className="flex items-center space-x-2 text-gray-500 mb-2">
            <Gift className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Total Earned</span>
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">${totalEarned.toFixed(2)}</p>
        </div>
      </div>

      {/* My Referrals List */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Signups</h3>
        
        <div className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          {loading ? (
             <div className="p-6 text-center text-gray-500 text-sm">Loading referrals...</div>
          ) : referrals.length === 0 ? (
             <div className="p-6 text-center text-gray-500 text-sm">You haven't invited anyone yet.</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {referrals.map((ref) => {
                const name = ref.referred?.first_name || ref.referred?.username || 'User';
                return (
                  <div key={ref.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold uppercase">
                        {name[0]}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm">{name}</h4>
                        <p className="text-xs text-gray-500">Joined {new Date(ref.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 mb-0.5">You earned</p>
                      <p className="font-bold text-green-600 dark:text-green-400 text-sm">${Number(ref.earned).toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
