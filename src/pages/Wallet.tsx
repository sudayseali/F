import { ArrowUpRight, ArrowDownLeft, ShieldCheck, Wallet as WalletIcon, History, ArrowLeft, ChevronRight, Loader2, CheckCircle2, Filter } from "lucide-react";
import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ViewType = 'main' | 'withdraw' | 'deposit';
type PaymentMethod = 'payeer' | 'usdt' | 'trx' | null;

const MOCK_TRANSACTIONS = [
  { id: 1, type: 'reward', title: "Task Reward", desc: "Subscribe to Crypto Channel", amount: "+$0.50", displayDate: "Today, 14:30", dateISO: new Date().toISOString(), isPositive: true },
  { id: 2, type: 'withdrawal', title: "Withdrawal", desc: "TRX Transfer", amount: "-$10.00", displayDate: "Yesterday, 09:15", dateISO: new Date(Date.now() - 86400000).toISOString(), isPositive: false },
  { id: 3, type: 'referral_bonus', title: "Referral Bonus", desc: "From user @alice", amount: "+$0.15", displayDate: "Yesterday, 08:00", dateISO: new Date(Date.now() - 86400000).toISOString(), isPositive: true },
  { id: 4, type: 'deposit', title: "Deposit", desc: "USDT Top Up", amount: "+$20.00", displayDate: "Last Week", dateISO: new Date(Date.now() - 7 * 86400000).toISOString(), isPositive: true },
];

export function Wallet() {
  const [view, setView] = useState<ViewType>('main');
  const [method, setMethod] = useState<PaymentMethod>(null);
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Filtering states
  const [txTypeFilter, setTxTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredTransactions = useMemo(() => {
    return MOCK_TRANSACTIONS.filter(tx => {
      if (txTypeFilter !== 'all' && tx.type !== txTypeFilter) return false;
      
      const txDate = new Date(tx.dateISO);
      txDate.setHours(0, 0, 0, 0); // normalize for comparison

      if (startDate) {
        const sDate = new Date(startDate);
        sDate.setHours(0, 0, 0, 0);
        if (txDate < sDate) return false;
      }
      
      if (endDate) {
        const eDate = new Date(endDate);
        eDate.setHours(0, 0, 0, 0);
        // If they pick an end date, we should include that day
        if (txDate > eDate) return false;
      }

      return true;
    });
  }, [txTypeFilter, startDate, endDate]);

  const handleAction = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setSuccessMsg(view === 'deposit' ? 'Deposit request submitted successfully' : 'Withdrawal pending approval');
      setTimeout(() => {
        setSuccessMsg('');
        setView('main');
        setMethod(null);
        setAmount('');
        setAddress('');
      }, 3000);
    }, 1500);
  };

  const selectMethod = (m: PaymentMethod) => setMethod(m);

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {view === 'main' && (
          <motion.div 
            key="main"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
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
                  <button 
                    onClick={() => { setView('withdraw'); setMethod(null); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center transition-colors active:scale-95"
                  >
                    <ArrowDownLeft className="w-4 h-4 mr-1.5" />
                    Withdraw
                  </button>
                  <button 
                    onClick={() => { setView('deposit'); setMethod(null); }}
                    className="bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center transition-colors active:scale-95"
                  >
                    <ArrowUpRight className="w-4 h-4 mr-1.5" />
                    Deposit
                  </button>
                </div>
              </div>
            </div>

            {/* Transaction History */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <History className="w-5 h-5 mr-2 text-gray-400" />
                  Transactions
                </h3>
              </div>

              {/* Filters */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-auto flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Type</label>
                  <select
                    value={txTypeFilter}
                    onChange={(e) => setTxTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="reward">Task Reward</option>
                    <option value="withdrawal">Withdrawal</option>
                    <option value="deposit">Deposit</option>
                    <option value="referral_bonus">Referral Bonus</option>
                  </select>
                </div>
                
                <div className="w-full md:w-auto flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="w-full md:w-auto flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
              </div>
              
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-2">
                {filteredTransactions.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm">
                    No transactions found for the selected filters.
                  </div>
                ) : (
                  filteredTransactions.map((tx) => (
                    <div key={tx.id} className="p-3 flex items-center justify-between border-b last:border-0 border-gray-50 hover:bg-gray-50 transition-colors rounded-xl">
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
                        <p className="text-[10px] text-gray-400 mt-0.5">{tx.displayDate}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {view !== 'main' && (
          <motion.div 
            key="action"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <header className="flex items-center space-x-3">
              <button onClick={() => setView('main')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 capitalize">{view} Funds</h1>
            </header>

            {successMsg ? (
               <div className="bg-green-50 border border-green-200 rounded-2xl p-8 flex flex-col items-center text-center">
                 <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-4">
                   <CheckCircle2 className="w-8 h-8" />
                 </div>
                 <h2 className="text-xl font-bold text-gray-900 mb-2">Success!</h2>
                 <p className="text-gray-600 text-sm">{successMsg}</p>
               </div>
            ) : (
              // Method Selection
              <form onSubmit={handleAction} className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-3 ml-1 uppercase tracking-wider">Select Method</h3>
                  <div className="grid gap-3">
                    <div onClick={() => selectMethod('usdt')} className={`border-2 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-colors ${method === 'usdt' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold">₮</div>
                        <div>
                          <h4 className="font-semibold text-gray-900">USDT (TRC20)</h4>
                          <p className="text-xs text-gray-500">Tether USD • Fee $1.00</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method === 'usdt' ? 'border-blue-600' : 'border-gray-300'}`}>
                        {method === 'usdt' && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full"></div>}
                      </div>
                    </div>

                    <div onClick={() => selectMethod('trx')} className={`border-2 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-colors ${method === 'trx' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-500 font-bold">T</div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Tron (TRX)</h4>
                          <p className="text-xs text-gray-500">TRON Network • Free</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method === 'trx' ? 'border-blue-600' : 'border-gray-300'}`}>
                        {method === 'trx' && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full"></div>}
                      </div>
                    </div>

                    <div onClick={() => selectMethod('payeer')} className={`border-2 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-colors ${method === 'payeer' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'}`}>
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center text-sky-600 font-bold text-xl">P</div>
                        <div>
                          <h4 className="font-semibold text-gray-900">Payeer</h4>
                          <p className="text-xs text-gray-500">Instant • Fee 0.5%</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method === 'payeer' ? 'border-blue-600' : 'border-gray-300'}`}>
                        {method === 'payeer' && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full"></div>}
                      </div>
                    </div>
                  </div>
                </div>

                {method && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }} 
                    animate={{ opacity: 1, height: 'auto' }} 
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Amount (USD)</label>
                      <input 
                        type="number" 
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        min="1"
                        step="0.01"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-lg"
                      />
                    </div>
                    
                    {view === 'withdraw' && (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                          {method === 'payeer' ? 'Payeer Account (e.g., P1000000)' : 'Wallet Address'}
                        </label>
                        <input 
                          type="text" 
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder={method === 'payeer' ? 'P...' : 'T...'}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                        />
                      </div>
                    )}

                    <button 
                      type="submit" 
                      disabled={isProcessing || !amount || (view === 'withdraw' && !address)}
                      className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-xl font-bold shadow-sm transition-colors mt-2 disabled:opacity-70 flex items-center justify-center active:scale-95"
                    >
                      {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : `${view === 'withdraw' ? 'Submit Withdrawal' : 'Proceed to Payment'}`}
                    </button>
                  </motion.div>
                )}
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
