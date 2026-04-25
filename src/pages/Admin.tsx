import React, { useState } from "react";
import { useTelegram } from "../contexts/TelegramContext";
import { Shield, Users, CheckSquare, ArrowDownLeft, ArrowUpRight, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type TabType = 'overview' | 'tasks' | 'submissions' | 'withdrawals' | 'deposits';

export function Admin() {
  const { user } = useTelegram();
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Hardcoded Admin ID constraint
  if (user?.id !== 5806129562 && user?.id !== 123456789) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Shield className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-500">You do not have administrator privileges to view this page.</p>
      </div>
    );
  }

  const handleAction = (id: number, type: string, action: 'approve' | 'reject') => {
    alert(`${action.toUpperCase()} action triggered for ${type} #${id}`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <header className="flex items-center space-x-3 border-b border-gray-200 pb-4">
        <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center text-white">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Control Panel</h1>
          <p className="text-gray-500 text-sm">Monitor and verify all system activities in real-time.</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex overflow-x-auto scrollbar-hide space-x-2 pb-2">
        {(['overview', 'tasks', 'submissions', 'withdrawals', 'deposits'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap capitalize transition-colors ${
              activeTab === tab 
                ? 'bg-gray-900 text-white shadow-md' 
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab}
          </button>
        ))}
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center space-x-3 mb-2 text-gray-500">
                  <Users className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Total Users</span>
                </div>
                <p className="text-3xl font-bold text-gray-900">1,245</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center space-x-3 mb-2 text-gray-500">
                  <CheckSquare className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Pending Tasks</span>
                </div>
                <p className="text-3xl font-bold text-orange-500">14</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center space-x-3 mb-2 text-gray-500">
                  <ArrowDownLeft className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Pending Withdrawals</span>
                </div>
                <p className="text-3xl font-bold text-red-500">8</p>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center space-x-3 mb-2 text-gray-500">
                  <ArrowUpRight className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-wider">Pending Deposits</span>
                </div>
                <p className="text-3xl font-bold text-emerald-500">3</p>
              </div>
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-900">Tasks Pending Approval</h3>
                <p className="text-xs text-gray-500">Verify advertiser funds and task validity.</p>
              </div>
              <div className="divide-y divide-gray-100">
                {[1, 2].map((id) => (
                  <div key={id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-gray-900">Task Title #{id}</h4>
                      <p className="text-sm text-gray-600 my-1">Join Telegram Channel and React.</p>
                      <div className="flex items-center space-x-3 text-xs text-gray-500">
                        <span>Adv: @cryptoguy</span>
                        <span>•</span>
                        <span>Reward: $0.10</span>
                        <span>•</span>
                        <span>Slots: 100</span>
                        <span>•</span>
                        <span className="font-semibold text-blue-600">Total: $10.00</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <button onClick={() => handleAction(id, 'Task', 'approve')} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100">
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleAction(id, 'Task', 'reject')} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                        <XCircle className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'submissions' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-900">Task Submissions</h3>
                <p className="text-xs text-gray-500">Verify user proofs before distributing rewards.</p>
              </div>
              <div className="divide-y divide-gray-100">
                {[1, 2, 3].map((id) => (
                  <div key={id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex space-x-4">
                      <div className="w-16 h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center shrink-0 overflow-hidden">
                        <img src="https://placehold.co/100x100?text=Proof" alt="Proof" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm">Join Group #{id}</h4>
                        <p className="text-xs text-gray-500 mt-1">User: @worker{id}</p>
                        <p className="text-xs text-gray-500">Submitted: Username @worker{id}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <button onClick={() => handleAction(id, 'Submission', 'approve')} className="flex items-center px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700">
                        Approve
                      </button>
                      <button onClick={() => handleAction(id, 'Submission', 'reject')} className="flex items-center px-3 py-1.5 bg-red-100 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-200">
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'withdrawals' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-900">Withdrawal Requests</h3>
                <p className="text-xs text-gray-500">Process user payouts.</p>
              </div>
              <div className="divide-y divide-gray-100">
                {[1, 2].map((id) => (
                  <div key={id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <ArrowDownLeft className="w-4 h-4 text-red-500" />
                        <h4 className="font-bold text-gray-900">${(id * 5.5).toFixed(2)}</h4>
                        <span className="text-xs font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded">TRX</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">User: @earner{id} • Wallet: T{id}abc...xyz</p>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <button onClick={() => handleAction(id, 'Withdrawal', 'approve')} className="px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700">
                        Mark Paid
                      </button>
                      <button onClick={() => handleAction(id, 'Withdrawal', 'reject')} className="px-3 py-1.5 bg-red-100 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-200">
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'deposits' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-gray-900">Deposit Verifications</h3>
                <p className="text-xs text-gray-500">Verify advertiser deposits to credit their wallet.</p>
              </div>
              <div className="divide-y divide-gray-100">
                {[1].map((id) => (
                  <div key={id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                        <h4 className="font-bold text-gray-900">$50.00</h4>
                        <span className="text-xs font-bold px-2 py-0.5 bg-gray-100 text-gray-600 rounded">USDT</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">Adv: @bigposter • TXID: 0x123abc...</p>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0">
                      <button onClick={() => handleAction(id, 'Deposit', 'approve')} className="px-3 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700">
                        Credit Account
                      </button>
                      <button onClick={() => handleAction(id, 'Deposit', 'reject')} className="px-3 py-1.5 bg-red-100 text-red-600 text-sm font-semibold rounded-lg hover:bg-red-200">
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
