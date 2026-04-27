import React, { useState } from "react";
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

  const handleAction = (id: number | string, type: string, action: string) => {
    alert(`${action.toUpperCase()} action triggered for ${type} ${id}`);
  };

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
          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-[#111218] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex items-center space-x-3 mb-3 text-gray-500 dark:text-gray-400">
                  <Users className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Total Users</span>
                </div>
                <p className="text-3xl font-black text-gray-900 dark:text-white">12,459</p>
                <div className="mt-2 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">+142 today</div>
              </div>
              <div className="bg-white dark:bg-[#111218] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex items-center space-x-3 mb-3 text-gray-500 dark:text-gray-400">
                  <CheckSquare className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Active Tasks</span>
                </div>
                <p className="text-3xl font-black text-amber-500">842</p>
                <div className="mt-2 text-[10px] text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full inline-block">14 Pending Approval</div>
              </div>
              <div className="bg-white dark:bg-[#111218] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex items-center space-x-3 mb-3 text-gray-500 dark:text-gray-400">
                  <ArrowDownLeft className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Payouts</span>
                </div>
                <p className="text-3xl font-black text-red-500">$2.4k</p>
                <div className="mt-2 text-[10px] text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded-full inline-block">8 Pending Requests</div>
              </div>
              <div className="bg-white dark:bg-[#111218] p-5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
                <div className="flex items-center space-x-3 mb-3 text-gray-500 dark:text-gray-400">
                  <ArrowUpRight className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Deposits</span>
                </div>
                <p className="text-3xl font-black text-emerald-500">$8.9k</p>
                <div className="mt-2 text-[10px] text-emerald-500 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full inline-block">3 Unverified</div>
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
                {[
                  { id: '1849201', name: 'John Doe', username: '@johndoe', bal: '$45.20', status: 'Active' },
                  { id: '9482012', name: 'Scammer123', username: '@earnfast', bal: '$0.05', status: 'Banned' },
                  { id: '5820122', name: 'Alice Smith', username: '@alice', bal: '$120.50', status: 'Active' },
                ].map((u, i) => (
                  <div key={i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold">
                        {u.name[0]}
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-bold text-gray-900 dark:text-white text-sm">{u.name}</h4>
                          <span className="text-xs text-gray-500">({u.username})</span>
                          {u.status === 'Banned' && <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-500 text-[10px] rounded uppercase font-bold">Banned</span>}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">ID: {u.id} • Balance: <span className="font-bold text-amber-600 dark:text-amber-500">{u.bal}</span></p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <button onClick={() => handleAction(u.id, 'User', 'edit_balance')} className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:text-amber-500 dark:hover:text-amber-500 transition-colors tooltip" title="Edit Balance">
                        <Wallet className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleAction(u.id, 'User', u.status === 'Banned' ? 'unban' : 'ban')} className={`p-2 rounded-lg transition-colors ${u.status === 'Banned' ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-600' : 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-500'}`} title={u.status === 'Banned' ? 'Unban' : 'Ban User'}>
                        {u.status === 'Banned' ? <RefreshCw className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
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
                {[
                  { id: 101, title: 'Join Telegram Channel and React', status: 'Pending' },
                  { id: 102, title: 'Download app and rate 5 stars', status: 'Active' },
                ].map((task) => (
                  <div key={task.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-gray-900 dark:text-white">Task #{task.id}: {task.title}</h4>
                        {task.status === 'Pending' ? (
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-500 text-[10px] font-bold rounded-full uppercase">Needs Approval</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-500 text-[10px] font-bold rounded-full uppercase">Live</span>
                        )}
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400 mt-2">
                        <span>Adv: @cryptoguy</span>
                        <span>•</span>
                        <span>Reward: $0.10</span>
                        <span>•</span>
                        <span>Slots: 100</span>
                        <span>•</span>
                        <span className="font-semibold text-amber-600 dark:text-amber-500">Pool: $10.00</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {task.status === 'Pending' && (
                        <button onClick={() => handleAction(task.id, 'Task', 'approve')} className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-lg transition-colors">
                          Approve
                        </button>
                      )}
                      <button onClick={() => handleAction(task.id, 'Task', 'edit')} className="p-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:text-amber-500 transition-colors">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleAction(task.id, 'Task', 'reject_delete')} className="p-2 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-500 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
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
                {[1, 2].map((id) => (
                  <div key={id} className="p-4 flex flex-col lg:flex-row lg:items-start justify-between gap-4 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <div className="flex space-x-4">
                      <div className="w-24 h-24 bg-gray-100 dark:bg-[#0b0c10] rounded-xl border border-gray-200 dark:border-gray-800 flex items-center justify-center shrink-0 overflow-hidden">
                        <img src={`https://placehold.co/200x200?text=Proof+${id}`} alt="Proof" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 dark:text-white text-sm">Join Group Task #{id}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Worker: <span className="font-semibold text-gray-700 dark:text-gray-300">@worker{id}</span></p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">IP: <span className="font-mono">192.168.1.{100 + id}</span></p>
                        <div className="mt-2 bg-gray-50 dark:bg-[#0b0c10] p-2 border border-gray-200 dark:border-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-300">
                          <strong>Submitted Text:</strong> I joined with username @myuser{id}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0 w-full lg:w-auto">
                      <button onClick={() => handleAction(id, 'Submission', 'approve')} className="flex-1 lg:flex-none justify-center px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-colors">
                        Approve (Pay)
                      </button>
                      <button onClick={() => handleAction(id, 'Submission', 'reject')} className="flex-1 lg:flex-none justify-center px-4 py-2 border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-500 text-sm font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors">
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
                {[1, 2].map((id) => (
                  <div key={id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <div>
                      <div className="flex items-center space-x-2">
                        <ArrowDownLeft className="w-5 h-5 text-red-500" />
                        <h4 className="font-black text-gray-900 dark:text-white text-lg">${(id * 5.5).toFixed(2)}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded uppercase">TRX (TRC20)</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">User: <span className="font-semibold text-gray-700 dark:text-gray-200">@earner{id}</span></p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-mono bg-gray-50 dark:bg-[#0b0c10] p-1.5 rounded mt-1 overflow-hidden text-ellipsis">
                        T{id}JxyzABCdefGHIjklMNOpqrSTUvwxYZ
                      </p>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <button onClick={() => handleAction(id, 'Withdrawal', 'approve')} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-colors">
                        Mark Paid
                      </button>
                      <button onClick={() => handleAction(id, 'Withdrawal', 'reject')} className="px-4 py-2 bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-red-500/20 text-red-600 dark:text-red-500 text-sm font-bold rounded-xl transition-colors">
                        Decline
                      </button>
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
                {[1].map((id) => (
                  <div key={id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-white/[0.02]">
                    <div>
                      <div className="flex items-center space-x-2">
                        <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                        <h4 className="font-black text-gray-900 dark:text-white text-lg">$50.00</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded uppercase">USDT</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Adv: <span className="font-semibold text-gray-700 dark:text-gray-200">@bigposter</span></p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-1">TXID: 0x123abc987def654...</p>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <button onClick={() => handleAction(id, 'Deposit', 'approve')} className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-colors">
                        Verify & Credit
                      </button>
                      <button onClick={() => handleAction(id, 'Deposit', 'reject')} className="px-4 py-2 bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-500 hover:bg-red-200 dark:hover:bg-red-500/20 text-sm font-bold rounded-xl transition-colors">
                        Reject
                      </button>
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
