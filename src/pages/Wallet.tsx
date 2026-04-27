import { ArrowUpRight, ArrowDownLeft, ShieldCheck, Wallet as WalletIcon, History, ArrowLeft, ChevronRight, Loader2, CheckCircle2, Filter } from "lucide-react";
import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTelegram } from "../contexts/TelegramContext";
import { supabase } from "../lib/supabase";

type ViewType = 'main' | 'withdraw' | 'deposit';
type PaymentMethod = 'payeer' | 'usdt' | 'trx' | 'ton' | null;

export function Wallet() {
  const { user } = useTelegram();
  const balance = user?.balance || 0;

  const [view, setView] = useState<ViewType>('main');
  const [method, setMethod] = useState<PaymentMethod>(null);
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtering states
  const [txTypeFilter, setTxTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    async function fetchTransactions() {
      if (!user?.uuid) return;
      
      try {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.uuid)
          .order('created_at', { ascending: false });
          
        if (data) {
          setTransactions(data);
        }
      } catch (err) {
        console.error("Error fetching transactions:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTransactions();
  }, [user?.uuid]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (txTypeFilter !== 'all' && tx.type !== txTypeFilter) return false;
      
      const txDate = new Date(tx.created_at);
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
  }, [transactions, txTypeFilter, startDate, endDate]);

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uuid) return;

    setIsProcessing(true);
    try {
      if (view === 'deposit') {
        const res = await supabase.functions.invoke('deposit', {
          body: { amount: parseFloat(amount), method, address }
        });
        if (res.error) throw new Error(res.error.message || 'Deposit failed');
        setSuccessMsg('Deposit request submitted successfully');
      } else if (view === 'withdraw') {
        const res = await supabase.functions.invoke('withdraw', {
          body: { amount: parseFloat(amount), method, address }
        });
        if (res.error) throw new Error(res.error.message || 'Withdrawal failed');
        setSuccessMsg('Withdrawal request submitted successfully');
      }
    } catch(err: any) {
      alert(err.message || 'An error occurred');
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        setSuccessMsg('');
        setView('main');
        setMethod(null);
        setAmount('');
        setAddress('');
      }, 3000);
    }
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wallet</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Manage your earnings and withdrawals.</p>
            </header>

            {/* Main Balance */}
            <div className="bg-white dark:bg-[#111218] rounded-3xl p-6 text-gray-900 dark:text-white shadow-xl relative overflow-hidden border border-gray-200 dark:border-gray-800">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500 rounded-full blur-3xl opacity-[0.05]"></div>
              <div className="relative z-10">
                <p className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-1 uppercase tracking-wider">Total Balance</p>
                <div className="flex items-end space-x-2 mb-6">
                  <h2 className="text-5xl font-bold tracking-tight text-gray-900 dark:text-white">${balance.toFixed(2)}</h2>
                  <span className="text-gray-500 font-bold pb-1.5">USD</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => { setView('withdraw'); setMethod(null); }}
                    className="bg-amber-500 hover:bg-amber-600 text-amber-950 py-3 rounded-xl font-bold text-sm flex items-center justify-center transition-colors active:scale-95"
                  >
                    <ArrowDownLeft className="w-4 h-4 mr-1.5" />
                    Withdraw
                  </button>
                  <button 
                    onClick={() => { setView('deposit'); setMethod(null); }}
                    className="bg-white/5 hover:bg-white/10 text-gray-900 dark:text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center transition-colors border border-white/10 active:scale-95"
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
                <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                  <History className="w-5 h-5 mr-2 text-amber-500" />
                  Transactions
                </h3>
              </div>

              {/* Filters */}
              <div className="bg-white dark:bg-[#111218] border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-auto flex-1">
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Type</label>
                  <select
                    value={txTypeFilter}
                    onChange={(e) => setTxTypeFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0c10] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:border-amber-500 appearance-none"
                  >
                    <option value="all">All</option>
                    <option value="reward">Task Reward</option>
                    <option value="withdrawal">Withdrawal</option>
                    <option value="deposit">Deposit</option>
                  </select>
                </div>
                
                <div className="w-full md:w-auto flex-1">
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0c10] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:border-amber-500 [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>

                <div className="w-full md:w-auto flex-1">
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 dark:bg-[#0b0c10] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:outline-none focus:border-amber-500 [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
              </div>
              
              <div className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden p-2">
                {loading ? (
                  <div className="p-6 text-center text-gray-500 text-sm font-medium">Loading transactions...</div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 text-sm font-medium">
                    No transactions found for the selected filters.
                  </div>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isPositive = ['reward', 'deposit', 'refund'].includes(tx.type);
                    return (
                      <div key={tx.id} className="p-3 flex items-center justify-between border-b last:border-0 border-gray-800/60 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors rounded-xl">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full border flex items-center justify-center ${isPositive ? 'bg-[#052e16] text-[#4ade80] border-[#14532d]' : 'bg-[#450a0a] text-[#f87171] border-[#7f1d1d]'}`}>
                            {isPositive ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm capitalize">{tx.type}</h4>
                            <p className="text-xs text-gray-500 line-clamp-1">{tx.status}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold text-sm ${isPositive ? 'text-[#4ade80]' : 'text-gray-200'}`}>
                            {isPositive ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5">{new Date(tx.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    );
                  })
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
              <button onClick={() => setView('main')} className="p-2 hover:bg-gray-100 dark:hover:bg-white/[0.03] rounded-full transition-colors">
                <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white capitalize">{view} Funds</h1>
            </header>

            {successMsg ? (
               <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-8 flex flex-col items-center text-center">
                 <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-500 rounded-full flex items-center justify-center mb-4">
                   <CheckCircle2 className="w-8 h-8" />
                 </div>
                 <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Success!</h2>
                 <p className="text-gray-600 dark:text-gray-300 text-sm">{successMsg}</p>
               </div>
            ) : (
              // Method Selection
              <form onSubmit={handleAction} className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 ml-1 uppercase tracking-wider">Select Method</h3>
                  <div className="grid gap-3">
                    <div onClick={() => selectMethod('usdt')} className={`border-2 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all ${method === 'usdt' ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111218] hover:border-amber-300 dark:hover:border-amber-500/50'}`}>
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-500 font-bold">₮</div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">USDT (TRC20)</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Tether USD • Fee $1.00</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method === 'usdt' ? 'border-amber-500' : 'border-gray-300 dark:border-gray-600'}`}>
                        {method === 'usdt' && <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>}
                      </div>
                    </div>

                    <div onClick={() => selectMethod('trx')} className={`border-2 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all ${method === 'trx' ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111218] hover:border-amber-300 dark:hover:border-amber-500/50'}`}>
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-500/20 rounded-full flex items-center justify-center text-red-600 dark:text-red-500 font-bold">T</div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">Tron (TRX)</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">TRON Network • Free</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method === 'trx' ? 'border-amber-500' : 'border-gray-300 dark:border-gray-600'}`}>
                        {method === 'trx' && <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>}
                      </div>
                    </div>

                    <div onClick={() => selectMethod('ton')} className={`border-2 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all ${method === 'ton' ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111218] hover:border-amber-300 dark:hover:border-amber-500/50'}`}>
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-500/20 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-500 font-bold">💎</div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">The Open Network (TON)</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">TON Network • Free</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method === 'ton' ? 'border-amber-500' : 'border-gray-300 dark:border-gray-600'}`}>
                        {method === 'ton' && <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>}
                      </div>
                    </div>

                    <div onClick={() => selectMethod('payeer')} className={`border-2 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all ${method === 'payeer' ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111218] hover:border-amber-300 dark:hover:border-amber-500/50'}`}>
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-sky-100 dark:bg-sky-500/20 rounded-full flex items-center justify-center text-sky-600 dark:text-sky-500 font-bold text-xl">P</div>
                        <div>
                          <h4 className="font-semibold text-gray-900 dark:text-white">Payeer</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Instant • Fee 0.5%</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${method === 'payeer' ? 'border-amber-500' : 'border-gray-300 dark:border-gray-600'}`}>
                        {method === 'payeer' && <div className="w-2.5 h-2.5 bg-amber-500 rounded-full"></div>}
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
                      <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Amount (USD)</label>
                      <input 
                        type="number" 
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        min="1"
                        step="0.01"
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111218] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium text-lg transition-colors"
                      />
                    </div>
                    
                    {view === 'withdraw' && (
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">
                          {method === 'payeer' ? 'Payeer Account (e.g., P1000000)' : method === 'ton' ? 'TON Wallet Address' : `${method.toUpperCase()} Wallet Address`}
                        </label>
                        <input 
                          type="text" 
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder={method === 'payeer' ? 'P...' : method === 'ton' ? 'EQ...' : 'T...'}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#111218] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm transition-colors"
                        />
                      </div>
                    )}

                    <button 
                      type="submit" 
                      disabled={isProcessing || !amount || (view === 'withdraw' && !address)}
                      className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-amber-950 rounded-xl font-bold shadow-sm transition-colors mt-2 disabled:opacity-70 flex items-center justify-center active:scale-95"
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
