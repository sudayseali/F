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
  { id: 'tasks', label: 'Live Tasks', icon: CheckSquare },
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
        }
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAdminData();
  }, [isAdmin, user]);

  // Secure Admin constraint - tied to backend via Context
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Shield className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h1>
        <p className="text-gray-500 dark:text-gray-400">You do not have administrator privileges to view this page.</p>
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
         alert("Error: " + data.error);
      } else {
         alert("Success: " + data.message);
         // You could trigger a re-fetch here if needed
      }
    } catch (e) {
      alert("Network error.");
    }
  };

  if (loading && isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
        <p className="mt-4 text-gray-500">Loading admin data...</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-20"
    >
      <header className="flex items-center space-x-4 border-b border-gray-200 dark:border-gray-800 pb-6">
        <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-500/20">
          <Shield className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">System Admin</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Full control & monitoring panel.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex overflow-x-auto scrollbar-hide space-x-2 pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${ 
                activeTab === tab.id 
                  ? 'bg-amber-500 text-amber-950 shadow-sm' 
                  : 'bg-white dark:bg-[#111218] text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.03]' 
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && adminData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-[#111218] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex items-center space-x-3 mb-3 text-gray-500 dark:text-gray-400">
                  <Users className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Total Users</span>
                </div>
                <p className="text-3xl font-black text-gray-900 dark:text-white">{adminData.stats?.totalUsers || 0}</p>
              </div>
              <div className="bg-white dark:bg-[#111218] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex items-center space-x-3 mb-3 text-gray-500 dark:text-gray-400">
                  <CheckSquare className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Active Tasks</span>
                </div>
                <p className="text-3xl font-black text-amber-500">{adminData.stats?.activeTasks || 0}</p>
                <div className="mt-2 text-[10px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full inline-block">{adminData.tasks?.filter((t: any) => t.status === 'pending').length || 0} Pending Approval</div>
              </div>
              <div className="bg-white dark:bg-[#111218] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex items-center space-x-3 mb-3 text-gray-500 dark:text-gray-400">
                  <ArrowDownLeft className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Payouts</span>
                </div>
                <p className="text-3xl font-black text-red-500">${adminData.withdrawals?.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0).toFixed(2) || '0.00'}</p>
                <div className="mt-2 text-[10px] text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded-full inline-block">{adminData.withdrawals?.filter((w: any) => w.status === 'pending').length || 0} Pending Requests</div>
              </div>
              <div className="bg-white dark:bg-[#111218] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex items-center space-x-3 mb-3 text-gray-500 dark:text-gray-400">
                  <ArrowUpRight className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Deposits</span>
                </div>
                <p className="text-3xl font-black text-emerald-500">${adminData.deposits?.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0).toFixed(2) || '0.00'}</p>
                <div className="mt-2 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">{adminData.deposits?.filter((d: any) => d.status === 'pending').length || 0} Unverified</div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0b0c10] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">User Management</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Search, edit, and moderate user accounts.</p>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="text"
                    placeholder="Search ID, @username..."
                    className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white dark:bg-[#111218] border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:border-amber-500 dark:focus:border-amber-500 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {adminData?.users?.map((u: any, i: number) => (
                  <div key={u.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold uppercase">
                        {u.first_name?.[0] || u.username?.[0] || '?'}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-gray-900 dark:text-white text-sm">{u.first_name || 'User'}</h4>
                          <span className="text-xs text-gray-500">(@{u.username || 'unknown'})</span>
                          {u.is_banned && <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-500 text-[10px] rounded uppercase font-bold">Banned</span>}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">ID: {u.telegram_id} • Balance: <span className="font-bold text-amber-600 dark:text-amber-500">${Number(u.balance || 0).toFixed(2)}</span></p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <button onClick={() => handleAction(u.id, 'User', 'edit_balance')} className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:text-amber-500 dark:hover:text-amber-500 transition-colors tooltip" title="Edit Balance">
                        <Wallet className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleAction(u.id, 'User', u.is_banned ? 'unban_user' : 'ban_user')} className={`p-2 rounded-lg transition-colors ${u.is_banned ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600' : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-500'}`} title={u.is_banned ? 'Unban' : 'Ban User'}>
                        {u.is_banned ? <RefreshCw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0b0c10]">
                <h3 className="font-bold text-gray-900 dark:text-white">Live & Pending Tasks</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Review new campaigns before they go live on the platform.</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {adminData?.tasks?.map((task: any) => (
                  <div key={task.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-gray-900 dark:text-white">Task: {task.title}</h4>
                        {task.status === 'pending' ? (
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-500 text-[10px] font-bold rounded-full uppercase">Needs Approval</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-500 text-[10px] font-bold rounded-full uppercase">{task.status}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center space-x-3 text-xs text-gray-500 dark:text-gray-400 mt-2">
                        <span>Adv ID: {task.advertiser_id?.slice(0,8)}...</span>
                        <span>•</span>
                        <span>Reward: ${task.reward}</span>
                        <span>•</span>
                        <span>Slots: {task.current_completions}/{task.max_completions}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {task.status === 'pending' && (
                        <button onClick={() => handleAction(task.id, 'Task', 'approve_task')} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg transition-colors">
                          Approve
                        </button>
                      )}
                      <button onClick={() => handleAction(task.id, 'Task', task.status === 'paused' ? 'resume_task' : 'pause_task')} className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:text-amber-500 transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'submissions' && (
            <div className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0b0c10]">
                <h3 className="font-bold text-gray-900 dark:text-white">Task Submissions (System Flags)</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Verify user proofs that were flagged for manual admin review.</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {adminData?.submissions?.map((sub: any) => (
                  <div key={sub.id} className="p-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <div className="flex space-x-4">
                      <div className="w-24 h-24 bg-gray-100 dark:bg-[#0b0c10] rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-center shrink-0 overflow-hidden">
                         {sub.proof?.startsWith('http') ? (
                           <img src={sub.proof} alt="Proof" className="w-full h-full object-cover" />
                         ) : (
                           <span className="text-xs text-gray-400">No Image</span>
                         )}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">Task: {sub.task?.title}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Worker: <span className="font-semibold text-gray-700 dark:text-gray-300">@{sub.worker?.username || 'unknown'}</span></p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">IP: <span className="font-mono">{sub.ip_address || 'hidden'}</span></p>
                        <div className="mt-2 bg-gray-50 dark:bg-[#0b0c10] p-2 border border-gray-200 dark:border-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-300">
                          <strong>Proof data:</strong> <span className="overflow-hidden text-ellipsis inline-block max-w-[200px]">{sub.proof || 'None provided'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0 w-full lg:w-auto">
                      <button onClick={() => handleAction(sub.id, 'Submission', 'approve_submission', { advertiser_id: sub.task?.advertiser_id })} className="flex-1 lg:flex-none justify-center px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-colors">
                        Approve (Pay)
                      </button>
                      <button onClick={() => handleAction(sub.id, 'Submission', 'reject_submission')} className="flex-1 lg:flex-none justify-center px-4 py-2 border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 text-sm font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'disputes' && (
            <div className="bg-white dark:bg-[#111218] rounded-2xl shadow-sm overflow-hidden border-2 border-red-500 dark:border-red-500/50">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-red-50 dark:bg-red-500/10">
                <h3 className="font-black text-red-700 dark:text-red-500 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  Active Disputes
                </h3>
                <p className="text-xs text-red-600 dark:text-red-400 ml-7">Advertisers rejected these, but workers successfully appealed.</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {[1].map((id) => (
                  <div key={id} className="p-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="flex space-x-4">
                      <div className="w-24 h-24 bg-gray-100 dark:bg-[#0b0c10] rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-center shrink-0 overflow-hidden">
                        <img src="https://placehold.co/200x200?text=Disputed" alt="Proof" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-gray-900 dark:text-white text-sm">Task: Sign up for Newsletter</h4>
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-500 text-[10px] font-bold rounded-full">ACTION REQ</span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex flex-col space-y-1">
                          <span>Adv: <span className="font-semibold text-red-600 dark:text-red-400">@bad_adv</span> (Rejected)</span>
                          <span>Worker: <span className="font-semibold text-emerald-600 dark:text-emerald-500">@honest_worker</span> (Appealed)</span>
                        </p>
                        <div className="mt-2 text-sm bg-gray-50 dark:bg-[#0b0c10] p-2 rounded-lg border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300">
                          <strong>Worker's Proof:</strong> worker_email@test.com
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2 shrink-0 w-full lg:w-48">
                      <button onClick={() => handleAction(id, 'Dispute', 'force_approve')} className="flex justify-center px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs uppercase tracking-wider font-bold rounded-lg transition-colors shadow-sm">
                        Force Approve
                      </button>
                      <button onClick={() => handleAction(id, 'Dispute', 'reject_worker')} className="flex justify-center px-4 py-2 bg-gray-800 dark:bg-gray-700 text-white text-xs uppercase tracking-wider font-bold rounded-lg hover:bg-gray-900 dark:hover:bg-gray-600 transition-colors shadow-sm">
                        Keep Rejected
                      </button>
                      <button onClick={() => handleAction(id, 'Dispute', 'ban_adv')} className="flex justify-center px-4 py-2 border border-red-500 text-red-600 dark:text-red-500 text-xs uppercase tracking-wider font-bold rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                        Ban Advertiser
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'withdrawals' && (
            <div className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0b0c10]">
                <h3 className="font-bold text-gray-900 dark:text-white">Withdrawal Requests</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Manually process user payouts (verify for fraud before approving).</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {adminData?.withdrawals?.map((tx: any) => (
                  <div key={tx.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <div>
                      <div className="flex items-center space-x-2">
                        <ArrowDownLeft className="w-5 h-5 text-red-500" />
                        <h4 className="font-black text-gray-900 dark:text-white text-lg">${Number(tx.amount).toFixed(2)}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded uppercase">{tx.status}</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">User: <span className="font-semibold text-gray-700 dark:text-gray-200">@{tx.user?.username || 'user'}</span></p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-[#0b0c10] p-1.5 rounded mt-1 overflow-hidden text-ellipsis">
                        Address/Ref: {tx.reference_id || 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      {tx.status === 'pending' && (
                        <>
                          <button onClick={() => handleAction(tx.id, 'Withdrawal', 'approve_withdrawal')} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-colors">
                            Mark Paid
                          </button>
                          <button onClick={() => handleAction(tx.id, 'Withdrawal', 'reject_withdrawal')} className="px-4 py-2 bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 text-red-600 dark:text-red-500 text-sm font-bold rounded-xl transition-colors">
                            Decline
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'deposits' && (
            <div className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0b0c10]">
                <h3 className="font-bold text-gray-900 dark:text-white">Deposit Verifications</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">Verify cross-chain or manual deposits visually.</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-800">
                {adminData?.deposits?.map((tx: any) => (
                  <div key={tx.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <div>
                      <div className="flex items-center space-x-2">
                        <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                        <h4 className="font-black text-gray-900 dark:text-white text-lg">${Number(tx.amount).toFixed(2)}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded uppercase">{tx.status}</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">User: <span className="font-semibold text-gray-700 dark:text-gray-200">@{tx.user?.username || 'user'}</span></p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">TXID: {tx.reference_id || 'N/A'}</p>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      {tx.status === 'pending' && (
                        <>
                          <button onClick={() => handleAction(tx.id, 'Deposit', 'approve_deposit')} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-colors">
                            Verify & Credit
                          </button>
                          <button onClick={() => handleAction(tx.id, 'Deposit', 'reject_deposit')} className="px-4 py-2 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-500 hover:bg-red-200 dark:hover:bg-red-500/20 text-sm font-bold rounded-xl transition-colors">
                            Reject
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
            <div className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden p-6 space-y-6">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">Global System Settings</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Manage platform fees, minimums, and maintenance mode.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Min. Withdrawal ($)</label>
                    <input type="number" defaultValue="2.00" className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#0b0c10] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:border-amber-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Platform Fee (%)</label>
                    <input type="number" defaultValue="5" className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#0b0c10] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:border-amber-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Auto-Approve Threshold ($)</label>
                    <input type="number" defaultValue="0.00" className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#0b0c10] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:border-amber-500" />
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">Set to 0 to require manual admin approval for all withdrawals.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Maintenance Mode</label>
                    <select className="w-full px-4 py-2.5 bg-gray-50 dark:bg-[#0b0c10] border border-gray-200 dark:border-gray-800 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:border-amber-500">
                      <option value="off">Off (Live)</option>
                      <option value="on">On (Users locked out)</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-200 dark:border-gray-800 flex justify-end">
                <button onClick={() => alert("Settings saved successfully!")} className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold rounded-xl transition-colors shadow-sm active:scale-95">
                  Save All Settings
                </button>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
