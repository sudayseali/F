import { ArrowUpRight, ArrowDownLeft, ShieldCheck, Wallet as WalletIcon, History } from "lucide-react";

export function Wallet() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Wallet</h1>
        <p className="text-gray-500 text-sm">Manage your earnings and withdrawals.</p>
      </header>

      {/* Main Balance */}
      <div className="bg-gray-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500 rounded-full blur-3xl opacity-20"></div>
        <div className="relative z-10">
          <p className="text-gray-400 text-sm font-medium mb-1">Total Balance</p>
          <div className="flex items-end space-x-2 mb-6">
            <h2 className="text-5xl font-bold tracking-tight">$45.50</h2>
            <span className="text-gray-400 font-medium pb-1.5">USD</span>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <button className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center transition-colors">
              <ArrowDownLeft className="w-4 h-4 mr-1.5" />
              Withdraw
            </button>
            <button className="bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center transition-colors">
              <ArrowUpRight className="w-4 h-4 mr-1.5" />
              Deposit
            </button>
          </div>
        </div>
      </div>

      {/* Withdrawal Methods */}
      <div>
         <h3 className="text-lg font-semibold text-gray-900 mb-4">Withdrawal Methods</h3>
         <div className="grid gap-3">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-blue-500 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-500 font-bold text-xl leading-none">TRX</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Tron (TRX)</h4>
                  <p className="text-xs text-gray-500">Min. withdrawal $2.00</p>
                </div>
              </div>
              <ShieldCheck className="w-5 h-5 text-gray-300" />
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-blue-500 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-xl leading-none">$</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">EVC Plus</h4>
                  <p className="text-xs text-gray-500">Min. withdrawal $0.50</p>
                </div>
              </div>
              <ShieldCheck className="w-5 h-5 text-gray-300" />
            </div>
         </div>
      </div>

      {/* Transaction History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <History className="w-5 h-5 mr-2 text-gray-400" />
            Transactions
          </h3>
          <button className="text-blue-600 text-sm font-medium flex items-center">
            All <ChevronRight className="w-4 h-4 ml-0.5" />
          </button>
        </div>
        
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-2">
            {[
              { type: 'reward', title: "Task Reward", desc: "Subscribe to Crypto Channel", amount: "+$0.50", date: "Today, 14:30", isPositive: true },
              { type: 'withdraw', title: "Withdrawal", desc: "TRX Transfer", amount: "-$10.00", date: "Yesterday, 09:15", isPositive: false },
              { type: 'reward', title: "Referral Bonus", desc: "From user @alice", amount: "+$0.15", date: "Yesterday, 08:00", isPositive: true },
            ].map((tx, i) => (
              <div key={i} className="p-3 flex items-center justify-between border-b last:border-0 border-gray-50">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.isPositive ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {tx.isPositive ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm">{tx.title}</h4>
                    <p className="text-xs text-gray-500 line-clamp-1">{tx.desc}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold text-sm ${tx.isPositive ? 'text-green-600' : 'text-gray-900'}`}>{tx.amount}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{tx.date}</p>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// Ensure ChevronRight is imported locally if defined above, or import from lucide-react.
import { ChevronRight } from "lucide-react";
