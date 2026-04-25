import { Copy, Users, Gift, Share2 } from "lucide-react";

export function Referrals() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Referrals</h1>
        <p className="text-gray-500 text-sm">Invite friends and earn together.</p>
      </header>

      {/* Hero Card */}
      <div className="bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg text-center relative overflow-hidden">
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
            <Gift className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Earn 10% for Life!</h2>
          <p className="text-indigo-100 text-sm max-w-xs mx-auto mb-6">
            Get 10% of all earnings from users who sign up using your referral link.
          </p>
          
          <div className="w-full bg-black/20 p-1.5 rounded-xl flex items-center backdrop-blur-sm">
            <div className="flex-1 overflow-x-auto scrollbar-hide px-3 py-2">
              <p className="text-sm font-mono text-white/90 whitespace-nowrap">
                https://t.me/TaskMasterBot?start=ref12345
              </p>
            </div>
            <button className="bg-white text-indigo-600 px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center hover:bg-indigo-50 transition-colors shadow-sm ml-2 shrink-0">
              <Copy className="w-4 h-4 mr-1.5" />
              Copy
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center space-x-2 text-gray-500 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Total Invited</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">24</p>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center space-x-2 text-gray-500 mb-2">
            <Gift className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wider">Total Earned</span>
          </div>
          <p className="text-2xl font-bold text-green-600">$12.40</p>
        </div>
      </div>

      {/* My Referrals List */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Signups</h3>
        
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Empty State vs List */}
          <div className="divide-y divide-gray-100">
            {[
              { name: "Alice", added: "2 days ago", earned: "$1.20" },
              { name: "Bob99", added: "5 days ago", earned: "$0.45" },
              { name: "CryptoKing", added: "1 week ago", earned: "$3.10" },
            ].map((ref, i) => (
              <div key={i} className="p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                    {ref.name[0]}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm">{ref.name}</h4>
                    <p className="text-xs text-gray-500">Joined {ref.added}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 mb-0.5">You earned</p>
                  <p className="font-bold text-green-600 text-sm">{ref.earned}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
