import React, { useState, useEffect } from "react";
import { useTelegram } from "../contexts/TelegramContext";
import { 
  Shield, Users, CheckSquare, ArrowDownLeft, ArrowUpRight, CheckCircle, 
  XCircle, AlertTriangle, Settings, Search, Ban, Wallet, Activity,
  SlidersHorizontal, Edit, Trash2, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type TabType = 'overview' | 'users' | 'tasks' | 'submissions' | 'disputes' | 'withdrawals' | 'deposits' | 'settings';

const TABS: { id: TabType; label: string; icon: any }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'tasks', label: 'Live Offers', icon: CheckSquare },
  { id: 'submissions', label: 'Flagged Submissions', icon: CheckCircle },
  { id: 'disputes', label: 'Disputes', icon: AlertTriangle },
  { id: 'withdrawals', label: 'Withdrawals', icon: ArrowDownLeft },
  { id: 'deposits', label: 'Deposits', icon: ArrowUpRight },
  { id: 'settings', label: 'System', icon: Settings },
];

export function Admin() {
  const { user, isAdmin } = useTelegram();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminData, setAdminData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin || !user) return;
    const fetchAdminData = async () => {
      try {
        const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
        if (!baseUrl) return;
        const res = await fetch(`${baseUrl}/functions/v1/admin_action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            admin_telegram_id: user.id,
            action: 'get_admin_data'
          })
        });
        const json = await res.json();
        if (json.success) {
          setAdminData(json.data);
          setErrorMsg(null);
        } else {
          setErrorMsg(json.error || "Failed to load admin data");
        }
      } catch (error) {
        console.error("Error fetching admin data:", error);
        setErrorMsg("Network error or backend is not deployed properly.");
      } finally {
        setLoading(false);
      }
    };
    
    fetchAdminData();
  }, [isAdmin, user]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-8">
        <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-[2rem] flex items-center justify-center mb-8 border border-red-500/20 shadow-2xl">
          <Shield className="w-12 h-12" />
        </div>
        <h1 className="text-4xl font-display font-bold text-white mb-4 tracking-tight">Access Restricted</h1>
        <p className="text-slate-400 max-w-sm mx-auto mb-10 leading-relaxed">
          Your current credentials lack the necessary clearances for the system core.
        </p>
        <div className="premium-card p-6 border-white/5 bg-slate-900/50">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Detected Identity</p>
          <code className="text-brand font-mono font-bold text-sm">ID: {user?.id}</code>
        </div>
      </div>
    );
  }

  const handleAction = async (id: number | string, type: string, action: string, extra_data: any = {}) => {
    if (!user) return;
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
      const res = await fetch(`${baseUrl}/functions/v1/admin_action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          admin_telegram_id: user.id,
          action,
          target_id: id,
          extra_data
        })
      });
      const data = await res.json();
      if (!data.success) {
         alert("Protocol Breach: " + data.error);
      } else {
         alert("Execution Success: " + data.message);
      }
    } catch (e) {
      alert("Network disruption detected.");
    }
  };

  if (loading && isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
        <p className="mt-6 text-slate-500 font-bold uppercase tracking-[0.3em] animate-pulse">Syncing Core...</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-10 pb-24"
    >
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center space-x-6">
          <div className="w-16 h-16 bg-brand/10 rounded-2xl flex items-center justify-center text-brand border border-brand/20 shadow-xl">
            <Shield className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight">Mainframe Controller</h1>
            <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">L7 Security Authorization Active</p>
          </div>
        </div>
        <div className="flex items-center space-x-3 bg-slate-900 border border-white/5 px-4 py-2 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Protocol Online</span>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex overflow-x-auto scrollbar-hide space-x-3 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-6 py-4 rounded-2xl text-sm font-bold whitespace-nowrap transition-all duration-300 border ${ 
                isActive 
                  ? 'bg-brand text-white border-brand shadow-[0_0_20px_rgba(59,130,246,0.3)] scale-105 z-10' 
                  : 'bg-slate-900 text-slate-500 border-white/5 hover:bg-slate-800' 
              }`}
            >
              <Icon className={`w-4 h-4 mr-2 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <div className="premium-card bg-red-500/5 border-red-500/20 p-6 flex items-start space-x-4">
           <AlertTriangle className="w-6 h-6 text-red-500 shrink-0" />
           <div>
             <h4 className="font-bold text-white">Interface Desynchronization</h4>
             <p className="text-xs text-red-400 mt-1">{errorMsg}</p>
           </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="min-h-[40vh]"
        >
          {activeTab === 'overview' && adminData && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: 'Network Users', val: adminData.stats?.totalUsers || 0, icon: Users, color: 'text-brand' },
                { label: 'Active Contracts', val: adminData.stats?.activeTasks || 0, icon: CheckSquare, color: 'text-brand' },
                { label: 'Total Outflow', val: `$${adminData.withdrawals?.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0).toFixed(2) || '0.00'}`, icon: ArrowDownLeft, color: 'text-red-400' },
                { label: 'System Inflow', val: `$${adminData.deposits?.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0).toFixed(2) || '0.00'}`, icon: ArrowUpRight, color: 'text-emerald-400' },
              ].map((stat, i) => (
                <div key={i} className="premium-card border-white/5 p-6 hover:border-brand/30 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <stat.icon className={`w-6 h-6 ${stat.color} opacity-80`} />
                    <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse"></span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{stat.label}</p>
                  <p className="text-3xl font-display font-bold text-white tracking-tight">{stat.val}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'users' && (
            <div className="premium-card !p-0 border-white/5 overflow-hidden">
              <div className="p-8 border-b border-white/5 bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-display font-bold text-white">Identity Management</h3>
                  <p className="text-sm text-slate-500 mt-1">Comprehensive user node manipulation portal.</p>
                </div>
                <div className="relative group">
                  <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-brand transition-colors" />
                  <input 
                    type="text"
                    placeholder="Search Node Identity..."
                    className="w-full sm:w-80 pl-12 pr-6 py-4 bg-slate-950 border border-white/5 rounded-2xl text-sm focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 text-white transition-all shadow-inner"
                  />
                </div>
              </div>
              <div className="divide-y divide-white/5">
                {adminData?.users?.map((u: any, i: number) => (
                  <motion.div 
                    key={u.id} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex items-center space-x-6">
                      <div className="w-14 h-14 bg-slate-950 border border-white/10 rounded-2xl flex items-center justify-center text-brand font-display font-black text-xl group-hover:scale-105 transition-transform duration-500">
                        {u.first_name?.[0] || u.username?.[0] || '?'}
                      </div>
                      <div>
                        <div className="flex items-center space-x-3">
                          <h4 className="font-bold text-white text-lg">{u.first_name || 'Anonymous Node'}</h4>
                          {u.is_banned && <span className="px-2 py-0.5 bg-red-500/10 text-red-500 text-[9px] rounded-lg uppercase font-black border border-red-500/20 tracking-tighter">Terminated</span>}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Network ID: <span className="font-mono text-slate-400">{u.telegram_id}</span> • Credits: <span className="font-display font-bold text-brand ml-1">${Number(u.balance || 0).toFixed(2)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <button onClick={async () => {
                        const newBalanceStr = prompt("Adjust Liquid Capital for " + (u.first_name || u.username) + ":", String(u.balance));
                        if (newBalanceStr === null || newBalanceStr.trim() === '') return;
                        const newBalance = parseFloat(newBalanceStr);
                        if (isNaN(newBalance) || newBalance < 0) return;
                        await handleAction(u.id, 'User', 'edit_balance', { new_balance: newBalance });
                      }} className="p-4 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-white/5 rounded-2xl hover:text-brand transition-all group/btn">
                        <Wallet className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />
                      </button>
                      <button onClick={() => handleAction(u.id, 'User', u.is_banned ? 'unban_user' : 'ban_user')} className={`p-4 rounded-2xl transition-all border group/btn ${u.is_banned ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'}`}>
                        {u.is_banned ? <RefreshCw className="w-5 h-5 group-hover/btn:rotate-180 transition-transform duration-700" /> : <Ban className="w-5 h-5 group-hover/btn:scale-110 transition-transform" />}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="premium-card !p-0 border-white/5 overflow-hidden">
              <div className="p-8 border-b border-white/5 bg-slate-900/50">
                <h3 className="text-xl font-display font-bold text-white">Contract Registry</h3>
                <p className="text-sm text-slate-500 mt-1">Authorization and deployment of ecosystem rewards.</p>
              </div>
              <div className="divide-y divide-white/5">
                {adminData?.tasks?.map((task: any) => (
                  <div key={task.id} className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/[0.02] transition-all group">
                    <div>
                      <div className="flex items-center space-x-4">
                        <h4 className="font-bold text-white text-lg group-hover:text-brand transition-colors">{task.title}</h4>
                        {task.status === 'pending' ? (
                          <span className="px-2 py-0.5 bg-amber-500/10 text-amber-500 text-[10px] font-black rounded-lg border border-amber-500/20 uppercase tracking-widest">Awaiting Ops</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-brand/10 text-brand text-[10px] font-black rounded-lg border border-brand/20 uppercase tracking-widest">Deployed</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-xs font-bold uppercase tracking-widest text-slate-500 mt-3">
                         <span className="text-brand">Reward: ${task.reward}</span>
                         <span className="text-slate-700">|</span>
                         <span>Utilization: {task.current_completions}/{task.max_completions} Nodes</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {task.status === 'pending' && (
                        <button onClick={() => handleAction(task.id, 'Task', 'approve_task')} className="btn-primary !px-6 !py-3">
                          Authorize
                        </button>
                      )}
                      <button onClick={() => handleAction(task.id, 'Task', task.status === 'paused' ? 'resume_task' : 'pause_task')} className="p-4 bg-slate-900 border border-white/5 text-slate-400 rounded-2xl hover:text-brand transition-all">
                        <Edit className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'withdrawals' && (
            <div className="premium-card !p-0 border-white/5 overflow-hidden">
              <div className="p-8 border-b border-white/5 bg-slate-900/50">
                <h3 className="text-xl font-display font-bold text-white">Outflow Authorization</h3>
                <p className="text-sm text-slate-500 mt-1">Manual verification of institutional liquidations.</p>
              </div>
              <div className="divide-y divide-white/5">
                {adminData?.withdrawals?.map((tx: any) => (
                  <div key={tx.id} className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/[0.02] group">
                    <div className="flex items-center space-x-6">
                      <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 border border-red-500/20 group-hover:scale-105 transition-transform duration-500">
                        <ArrowDownLeft className="w-7 h-7" />
                      </div>
                      <div>
                        <h4 className="font-display font-black text-2xl text-white">${Number(tx.amount).toFixed(2)}</h4>
                        <div className="flex items-center space-x-3 mt-1">
                          <span className="text-slate-500 text-xs font-bold font-mono">@{tx.user?.username || 'user'}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">{tx.status}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {tx.status === 'pending' && (
                        <>
                          <button onClick={() => handleAction(tx.id, 'Withdrawal', 'approve_withdrawal')} className="btn-primary !px-6 !py-3">
                            Confirm Payout
                          </button>
                          <button onClick={() => handleAction(tx.id, 'Withdrawal', 'reject_withdrawal')} className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold text-sm rounded-2xl border border-red-500/20 transition-all">
                            Deny
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="premium-card p-10 border-white/5">
              <div className="mb-10">
                <h3 className="text-2xl font-display font-bold text-white tracking-tight">Ecosystem Parameters</h3>
                <p className="text-slate-500 mt-2">Manipulation of global economic constraints.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[
                  { label: "Minimum Liquidation ($)", default: "2.00", type: "number" },
                  { label: "Protocol Fee (%)", default: "5", type: "number" },
                  { label: "AI Auto-Approve Floor ($)", default: "0.00", type: "number", hint: "Manual overhead threshold" }
                ].map((input, i) => (
                  <div key={i} className="space-y-3">
                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 px-1">{input.label}</label>
                    <input 
                      type={input.type} 
                      defaultValue={input.default} 
                      className="w-full px-6 py-4 bg-slate-950 border border-white/5 rounded-2xl text-white focus:outline-none focus:border-brand transition-all shadow-inner font-mono" 
                    />
                    {input.hint && <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">{input.hint}</p>}
                  </div>
                ))}
                <div className="space-y-3">
                  <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 px-1">Infrastructure Status</label>
                  <select className="w-full px-6 py-4 bg-slate-950 border border-white/5 rounded-2xl text-white focus:outline-none focus:border-brand transition-all shadow-inner appearance-none">
                    <option value="off">Operational (Live)</option>
                    <option value="on">Maintenance Mode (Sealed)</option>
                  </select>
                </div>
              </div>

              <div className="pt-12 mt-10 border-t border-white/5 flex justify-end">
                <button onClick={() => alert("Ecosystem adjusted.")} className="btn-primary !px-12 !py-5 shadow-2xl">
                  Commit Changes to Ledger
                </button>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
