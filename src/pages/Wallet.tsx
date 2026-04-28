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
    <div className="space-y-8">
      <AnimatePresence mode="wait">
        {view === 'main' && (
          <motion.div 
            key="main"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <header className="flex justify-between items-end">
              <div>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1 tracking-wide uppercase">Finances</p>
                <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-white tracking-tight">
                  Your Wallet
                </h1>
              </div>
            </header>

            {/* Main Balance - Glassmorphic */}
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-500 to-purple-600 p-[1px] shadow-2xl">
              <div className="absolute inset-0 bg-white/10 dark:bg-black/20" />
              <div className="relative h-full w-full rounded-[2rem] bg-gradient-to-br from-white/90 to-white/40 dark:from-zinc-900/90 dark:to-zinc-900/40 backdrop-blur-xl p-8 border border-white/20 dark:border-white/10">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-brand rounded-full blur-[80px] opacity-20"></div>
                
                <div className="relative z-10">
                  <p className="text-brand-dark dark:text-brand-light text-sm font-bold uppercase tracking-widest mb-2">Total Balance</p>
                  <div className="flex items-baseline space-x-2 mb-8">
                    <h2 className="text-5xl font-display font-black tracking-tighter text-gray-900 dark:text-white">${balance.toFixed(2)}</h2>
                    <span className="text-xl font-medium text-gray-500 pt-1">USD</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => { setView('withdraw'); setMethod(null); }}
                      className="group relative w-full bg-brand hover:bg-brand-light text-white py-4 rounded-2xl font-bold shadow-[0_0_40px_-10px_rgba(124,58,237,0.5)] flex items-center justify-center transition-all overflow-hidden"
                    >
                      <ArrowDownLeft className="w-5 h-5 mr-2 group-hover:-translate-y-1 group-hover:-translate-x-1 transition-transform" />
                      Withdraw
                    </button>
                    <button 
                      onClick={() => { setView('deposit'); setMethod(null); }}
                      className="group relative w-full bg-white/50 hover:bg-white/80 dark:bg-white/5 dark:hover:bg-white/10 text-gray-900 dark:text-white py-4 rounded-2xl font-bold flex items-center justify-center transition-all border border-gray-200/50 dark:border-white/10 backdrop-blur-sm"
                    >
                      <ArrowUpRight className="w-5 h-5 mr-2 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                      Deposit
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction History */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-display font-bold text-gray-900 dark:text-white flex items-center">
                  <History className="w-5 h-5 mr-2 text-brand" />
                  Transactions
                </h3>
              </div>

              {/* Filters - Glass */}
              <div className="glass-panel rounded-2xl p-5 flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-auto flex-1">
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">Type</label>
                  <select
                    value={txTypeFilter}
                    onChange={(e) => setTxTypeFilter(e.target.value)}
                    className="w-full px-4 py-2.5 glass-panel rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand appearance-none"
                  >
                    <option value="all">All Transactions</option>
                    <option value="reward">Task Rewards</option>
                    <option value="withdrawal">Withdrawals</option>
                    <option value="deposit">Deposits</option>
                  </select>
                </div>
                
                <div className="w-full md:w-auto flex-1">
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2.5 glass-panel rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>

                <div className="w-full md:w-auto flex-1">
                  <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-widest">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2.5 glass-panel rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand [color-scheme:light] dark:[color-scheme:dark]"
                  />
                </div>
              </div>
              
              <div className="glass-panel rounded-[2rem] overflow-hidden p-2">
                {loading ? (
                  <div className="p-8 text-center text-gray-500 font-medium animate-pulse">Loading transactions...</div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="p-12 text-center flex flex-col items-center justify-center">
                     <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
                       <History className="w-8 h-8 text-gray-400" />
                     </div>
                     <p className="text-gray-900 dark:text-white font-bold mb-1">No transactions found</p>
                     <p className="text-gray-500 text-sm max-w-[200px] mx-auto">Try adjusting your filters or complete more tasks.</p>
                  </div>
                ) : (
                  filteredTransactions.map((tx) => {
                    const isPositive = ['reward', 'deposit', 'refund'].includes(tx.type);
                    return (
                      <div key={tx.id} className="p-4 flex items-center justify-between border-b last:border-0 border-gray-200/50 dark:border-white/5 hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors rounded-xl mx-2 my-1">
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isPositive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                            {isPositive ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                          </div>
                          <div>
                            <h4 className="font-bold text-gray-900 dark:text-white text-sm capitalize">{tx.type}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">{tx.status}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-display font-bold text-lg tracking-tight ${isPositive ? 'text-emerald-500' : 'text-gray-900 dark:text-white'}`}>
                            {isPositive ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-gray-500 mt-0.5 font-mono">{new Date(tx.created_at).toLocaleDateString()}</p>
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
            className="space-y-8"
          >
            <header className="flex items-center space-x-4">
              <button onClick={() => setView('main')} className="p-3 bg-white hover:bg-gray-50 dark:bg-white/5 dark:hover:bg-white/10 rounded-full transition-colors glass-panel hover-lift">
                <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" />
              </button>
              <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-white capitalize">{view} Funds</h1>
            </header>

            {successMsg ? (
               <div className="glass-panel rounded-[2rem] p-12 flex flex-col items-center text-center">
                 <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-6">
                   <CheckCircle2 className="w-10 h-10" />
                 </div>
                 <h2 className="text-2xl font-display font-bold text-gray-900 dark:text-white mb-2">Success!</h2>
                 <p className="text-gray-500">{successMsg}</p>
               </div>
            ) : (
              /* Method Selection */
              <form onSubmit={handleAction} className="space-y-8">
                <div>
                  <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-4 uppercase tracking-widest ml-2">Select Method</h3>
                  <div className="grid gap-3">
                    <div onClick={() => selectMethod('usdt')} className={`glass-panel border border-transparent rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all hover-lift ${method === 'usdt' ? '!border-brand bg-brand/5 dark:bg-brand/10' : 'hover:border-brand/30'}`}>
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 font-bold text-lg">₮</div>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white">USDT (TRC20)</h4>
                          <p className="text-xs text-gray-500 mt-1">Tether USD • Fee $1.00</p>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${method === 'usdt' ? 'border-brand' : 'border-gray-300 dark:border-gray-700'}`}>
                        {method === 'usdt' && <div className="w-3 h-3 bg-brand rounded-full"></div>}
                      </div>
                    </div>

                    <div onClick={() => selectMethod('trx')} className={`glass-panel border border-transparent rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all hover-lift ${method === 'trx' ? '!border-brand bg-brand/5 dark:bg-brand/10' : 'hover:border-brand/30'}`}>
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 font-bold text-xl px-1">T</div>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white">Tron (TRX)</h4>
                          <p className="text-xs text-gray-500 mt-1">TRON Network • Free</p>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${method === 'trx' ? 'border-brand' : 'border-gray-300 dark:border-gray-700'}`}>
                        {method === 'trx' && <div className="w-3 h-3 bg-brand rounded-full"></div>}
                      </div>
                    </div>

                    <div onClick={() => selectMethod('ton')} className={`glass-panel border border-transparent rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all hover-lift ${method === 'ton' ? '!border-brand bg-brand/5 dark:bg-brand/10' : 'hover:border-brand/30'}`}>
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 font-bold text-xl">💎</div>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white">The Open Network (TON)</h4>
                          <p className="text-xs text-gray-500 mt-1">TON Network • Free</p>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${method === 'ton' ? 'border-brand' : 'border-gray-300 dark:border-gray-700'}`}>
                        {method === 'ton' && <div className="w-3 h-3 bg-brand rounded-full"></div>}
                      </div>
                    </div>

                    <div onClick={() => selectMethod('payeer')} className={`glass-panel border border-transparent rounded-2xl p-4 flex items-center justify-between cursor-pointer transition-all hover-lift ${method === 'payeer' ? '!border-brand bg-brand/5 dark:bg-brand/10' : 'hover:border-brand/30'}`}>
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-sky-500/10 rounded-full flex items-center justify-center text-sky-500 font-bold text-2xl pr-1">P</div>
                        <div>
                          <h4 className="font-bold text-gray-900 dark:text-white">Payeer</h4>
                          <p className="text-xs text-gray-500 mt-1">Instant • Fee 0.5%</p>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${method === 'payeer' ? 'border-brand' : 'border-gray-300 dark:border-gray-700'}`}>
                        {method === 'payeer' && <div className="w-3 h-3 bg-brand rounded-full"></div>}
                      </div>
                    </div>
                  </div>
                </div>

                {method && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="space-y-6 glass-panel rounded-2xl p-6"
                  >
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 ml-1">Amount (USD)</label>
                      <input 
                        type="number" 
                        required
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        min="1"
                        step="0.01"
                        className="w-full px-5 py-4 rounded-xl glass-panel text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand font-display font-medium text-xl transition-all"
                      />
                    </div>
                    
                    {view === 'withdraw' && (
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2 ml-1">
                          {method === 'payeer' ? 'Payeer Account (e.g., P1000000)' : method === 'ton' ? 'TON Wallet Address' : `${method.toUpperCase()} Wallet Address`}
                        </label>
                        <input 
                          type="text" 
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder={method === 'payeer' ? 'P...' : method === 'ton' ? 'EQ...' : 'T...'}
                          className="w-full px-5 py-4 rounded-xl glass-panel text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand font-mono text-sm transition-all"
                        />
                      </div>
                    )}

                    <button 
                      type="submit" 
                      disabled={isProcessing || !amount || (view === 'withdraw' && !address)}
                      className="w-full py-4 bg-brand hover:bg-brand-light text-white rounded-xl font-bold shadow-[0_0_20px_-10px_rgba(124,58,237,0.5)] transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center hover-lift mt-4"
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
