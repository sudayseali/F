import { ArrowUpRight, ArrowDownLeft, ShieldCheck, Wallet as WalletIcon, History, ArrowLeft, ChevronRight, Loader2, CheckCircle2, Filter, ChevronDown } from "lucide-react";
import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useTelegram } from "../contexts/TelegramContext";
import { supabase } from "../lib/supabase";

type ViewType = 'main' | 'withdraw';
type PaymentMethod = 'payeer' | 'trx' | 'zaad' | null;

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
      if (view === 'withdraw') {
        const res = await supabase.functions.invoke('withdraw', {
          body: { user_uuid: user.uuid, amount: parseFloat(amount), method, wallet_address: address }
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
      }, 5000); // Wait bit longer before redirecting
    }
  };

  const selectMethod = (m: PaymentMethod) => setMethod(m);

  return (
    <div className="space-y-10 pb-24">
      <AnimatePresence mode="wait">
        {view === 'main' && (
          <motion.div 
            key="main"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-12"
          >
            <header className="flex justify-between items-end pt-4">
              <div>
                <p className="text-brand text-[10px] font-bold mb-3 tracking-[0.3em] uppercase">Treasury Management</p>
                <h1 className="text-5xl font-serif font-bold text-white tracking-tight">
                  Reserve <span className="font-light italic text-white/50">Wallet</span>
                </h1>
              </div>
            </header>

            {/* Main Balance - Luxury Card */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#111827] to-[#0A0E1A] p-1 shadow-2xl border border-white/5 group">
              <div className="absolute inset-0 bg-gradient-to-bl from-brand/10 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-1000" />
              <div className="relative h-full w-full rounded-[2.5rem] bg-[#0A0E1A]/80 backdrop-blur-2xl p-10 overflow-hidden shadow-inner flex flex-col items-center text-center sm:items-start sm:text-left">
                <div className="absolute -top-32 -right-32 w-[30rem] h-[30rem] bg-gradient-radial from-brand/20 to-transparent blur-3xl opacity-40 pointer-events-none"></div>
                
                <div className="relative z-10 w-full">
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.3em] font-mono mb-6">Available Liquidity</p>
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 mb-12 justify-center sm:justify-start">
                    <h2 className="text-6xl md:text-7xl font-display font-black tracking-tighter text-white drop-shadow-md">
                      {(balance * 1000).toLocaleString()}
                    </h2>
                    <span className="text-2xl font-serif italic text-white/30 pt-2">Paycoin</span>
                  </div>
                  
                  <div className="grid grid-cols-1 w-full max-w-md mx-auto sm:mx-0">
                    <button 
                      onClick={() => { setView('withdraw'); setMethod(null); }}
                      className="group/btn relative w-full bg-brand hover:bg-brand-light text-white py-5 rounded-[1.5rem] font-bold shadow-[0_0_40px_-10px_rgba(255,78,0,0.5)] flex items-center justify-center transition-all overflow-hidden border border-white/10 active:scale-95"
                    >
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-in-out" />
                      <span className="relative flex items-center tracking-wide uppercase">
                        <ArrowDownLeft className="w-5 h-5 mr-3 group-hover/btn:-translate-y-1 group-hover/btn:-translate-x-1 transition-transform" />
                        Execute Withdrawal
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction History */}
            <div className="space-y-8">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <h3 className="text-3xl font-serif font-light text-white flex items-center">
                  <History className="w-6 h-6 mr-4 text-brand" />
                  Ledger <span className="font-bold ml-2">History</span>
                </h3>
              </div>

              {/* Filters - Glass */}
              <div className="bg-[#111827]/30 rounded-[2rem] p-6 flex flex-col md:flex-row gap-6 border border-white/5 backdrop-blur-md">
                <div className="w-full md:w-auto flex-1">
                  <label className="block text-[10px] font-bold text-white/30 mb-3 uppercase tracking-[0.2em] font-mono ml-2">Transaction Type</label>
                  <div className="relative">
                    <select
                      value={txTypeFilter}
                      onChange={(e) => setTxTypeFilter(e.target.value)}
                      className="w-full px-6 py-4 bg-[#0A0E1A]/80 rounded-[1.5rem] text-sm text-white/70 font-medium focus:outline-none focus:border-brand/40 border border-white/5 appearance-none backdrop-blur-md shadow-inner"
                    >
                      <option value="all">All Operations</option>
                      <option value="reward">Bounty Rewards</option>
                      <option value="withdrawal">Withdrawal Executions</option>
                    </select>
                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  </div>
                </div>
                
                <div className="w-full md:w-auto flex-1">
                  <label className="block text-[10px] font-bold text-white/30 mb-3 uppercase tracking-[0.2em] font-mono ml-2">Start Range</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-6 py-4 bg-[#0A0E1A]/80 rounded-[1.5rem] text-sm text-white/70 font-medium focus:outline-none focus:border-brand/40 border border-white/5 appearance-none backdrop-blur-md shadow-inner [color-scheme:dark]"
                  />
                </div>

                <div className="w-full md:w-auto flex-1">
                  <label className="block text-[10px] font-bold text-white/30 mb-3 uppercase tracking-[0.2em] font-mono ml-2">End Range</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-6 py-4 bg-[#0A0E1A]/80 rounded-[1.5rem] text-sm text-white/70 font-medium focus:outline-none focus:border-brand/40 border border-white/5 appearance-none backdrop-blur-md shadow-inner [color-scheme:dark]"
                  />
                </div>
              </div>
              
              <div className="bg-[#111827]/20 rounded-[2.5rem] border border-white/5 overflow-hidden backdrop-blur-xl">
                {loading ? (
                  <div className="p-16 text-center text-white/30 font-bold tracking-[0.3em] font-mono animate-pulse uppercase">Synchronizing Ledger...</div>
                ) : filteredTransactions.length === 0 ? (
                  <div className="p-20 text-center flex flex-col items-center justify-center">
                     <div className="w-24 h-24 rounded-full bg-white/[0.02] flex items-center justify-center mb-8 border border-white/5 shadow-inner">
                       <History className="w-10 h-10 text-white/10" />
                     </div>
                     <p className="text-white font-display font-bold text-2xl mb-2 tracking-tight">Empty Record</p>
                     <p className="text-white/40 text-base font-serif italic max-w-xs mx-auto">No transaction data matched the provided criteria.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-white/[0.05]">
                    {filteredTransactions.map((tx) => {
                      const isPositive = ['reward', 'deposit', 'refund'].includes(tx.type);
                      return (
                        <div key={tx.id} className="p-6 sm:p-8 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                          <div className="flex items-center space-x-6">
                            <div className={`w-14 h-14 rounded-[1.2rem] flex items-center justify-center shadow-inner border group-hover:scale-105 transition-transform ${isPositive ? 'bg-emerald-500/5 text-emerald-500 border-emerald-500/10' : 'bg-brand/5 text-brand border-brand/10'}`}>
                              {isPositive ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-base capitalize tracking-wide">{tx.type}</h4>
                              <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-mono">{tx.status}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-display font-bold text-2xl tracking-tighter ${isPositive ? 'text-emerald-500' : 'text-white'}`}>
                              {isPositive ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                            </p>
                            <p className="text-[10px] text-white/30 mt-1 font-mono tracking-widest">{new Date(tx.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
            className="space-y-10"
          >
            <header className="flex items-center space-x-6 pt-4 border-b border-white/5 pb-8">
              <button onClick={() => setView('main')} className="p-4 bg-[#111827] hover:bg-[#1E293B] rounded-full transition-colors border border-white/5 flex items-center justify-center group active:scale-95 shadow-inner">
                <ArrowLeft className="w-6 h-6 text-white/70 group-hover:text-brand transition-colors" />
              </button>
              <div>
                <p className="text-brand text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Action Required</p>
                <h1 className="text-4xl font-serif font-bold text-white tracking-tight capitalize">{view} Funds</h1>
              </div>
            </header>

            {successMsg ? (
               <div className="bg-[#111827]/50 rounded-[2.5rem] p-16 flex flex-col items-center text-center border border-emerald-500/20 backdrop-blur-xl shadow-[0_0_50px_rgba(16,185,129,0.05)]">
                 <div className="w-24 h-24 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-8 border border-emerald-500/20 shadow-inner">
                   <CheckCircle2 className="w-12 h-12" />
                 </div>
                 <h2 className="text-4xl font-display font-bold text-white mb-4 tracking-tight">Execution Success</h2>
                 <p className="text-white/50 font-serif italic text-lg">{successMsg}</p>
               </div>
            ) : (
              /* Method Selection */
              <form onSubmit={handleAction} className="space-y-10 max-w-2xl mx-auto">
                <div>
                  <h3 className="text-xs font-bold text-white/30 mb-6 uppercase tracking-[0.3em] font-mono ml-4">Select Routing Method</h3>
                  <div className="grid gap-4">
                    {[
                      { id: 'payeer', name: 'Payeer Network', icon: 'P', desc: 'Instant Clearance • 0.5% Fee', color: 'text-sky-500', bg: 'bg-sky-500/5', border: 'border-sky-500/20' },
                      { id: 'trx', name: 'Tron Protocol', icon: 'T', desc: 'TRC-10/20 • Zero Fee', color: 'text-[#ff4e00]', bg: 'bg-[#ff4e00]/5', border: 'border-[#ff4e00]/20' },
                      { id: 'zaad', name: 'Zaad Gateway', icon: 'Z', desc: 'Mobile Infrastructure • SLA', color: 'text-emerald-500', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20' }
                    ].map((m) => (
                      <div 
                        key={m.id}
                        onClick={() => selectMethod(m.id as PaymentMethod)} 
                        className={`group relative bg-[#0A0E1A]/80 rounded-[2rem] p-6 flex items-center justify-between cursor-pointer transition-all duration-300 border backdrop-blur-md overflow-hidden ${method === m.id ? 'border-brand shadow-[0_0_30px_rgba(59,130,246,0.1)]' : 'border-white/5 hover:border-white/20 hover:bg-[#111827]/80'}`}
                      >
                        {method === m.id && <div className="absolute inset-0 bg-brand/5 pointer-events-none" />}
                        <div className="flex items-center space-x-6 relative z-10">
                          <div className={`w-16 h-16 rounded-[1.2rem] flex items-center justify-center font-display font-black text-2xl shadow-inner border ${m.bg} ${m.color} ${m.border}`}>
                            {m.icon}
                          </div>
                          <div>
                            <h4 className={`font-bold text-lg tracking-tight transition-colors ${method === m.id ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>{m.name}</h4>
                            <p className="text-xs text-white/40 mt-1 uppercase tracking-widest font-mono">{m.desc}</p>
                          </div>
                        </div>
                        <div className={`relative z-10 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${method === m.id ? 'border-brand bg-brand/10' : 'border-white/10 group-hover:border-white/30'}`}>
                          {method === m.id && <motion.div layoutId="check" className="w-3 h-3 bg-brand rounded-full"></motion.div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <AnimatePresence>
                  {method && (
                    <motion.div 
                      key="form"
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }} 
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-6 bg-[#111827]/30 rounded-[2.5rem] p-8 sm:p-10 border border-white/5 backdrop-blur-xl"
                    >
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-[0.3em] font-mono text-white/40 mb-3 ml-2">Transfer Value (USD)</label>
                        <div className="relative">
                          <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-serif text-white/30">$</span>
                          <input 
                            type="number" 
                            required
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            min="1"
                            step="0.01"
                            className="w-full pl-12 pr-6 py-5 bg-[#0A0E1A]/80 rounded-[1.5rem] border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/50 font-display font-medium text-2xl transition-all shadow-inner"
                          />
                        </div>
                      </div>
                      
                      {view === 'withdraw' && (
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-[0.3em] font-mono text-white/40 mb-3 ml-2">
                            {method === 'payeer' ? 'Target Identifier (e.g., P1000000)' : method === 'zaad' ? 'Mobile Endpoint' : `Target ${method.toUpperCase()} Address`}
                          </label>
                          <input 
                            type="text" 
                            required
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder={method === 'payeer' ? 'P...' : method === 'zaad' ? '063...' : 'T...'}
                            className="w-full px-6 py-5 bg-[#0A0E1A]/80 rounded-[1.5rem] border border-white/10 text-white placeholder:text-white/20 focus:outline-none focus:border-brand/50 focus:ring-1 focus:ring-brand/50 font-mono text-base transition-all shadow-inner"
                          />
                        </div>
                      )}

                      <button 
                        type="submit" 
                        disabled={isProcessing || !amount || (view === 'withdraw' && !address)}
                        className="w-full py-5 bg-brand hover:bg-brand-light text-white rounded-[1.5rem] font-bold shadow-[0_0_30px_-10px_rgba(255,78,0,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center active:scale-95 border border-white/10 group mt-8 uppercase tracking-widest text-sm"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <span className="flex items-center">
                            {view === 'withdraw' ? 'Authorize Transfer' : 'Initialize Routing'}
                            <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                          </span>
                        )}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
