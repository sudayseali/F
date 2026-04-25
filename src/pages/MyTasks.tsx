import React, { useState } from "react";
import { CheckCircle, Clock, XCircle, History, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

type StatusType = 'all' | 'pending' | 'approved' | 'rejected';

export function MyTasks() {
  const [filter, setFilter] = useState<StatusType>('all');

  // Mock data for user's task history
  const submissions = [
    { id: 1, title: "Join Telegram Crypto Group", reward: 0.15, status: "pending", date: "2 hours ago" },
    { id: 2, title: "Subscribe to Crypto Channel", reward: 0.50, status: "approved", date: "1 day ago" },
    { id: 3, title: "Sign up for Newsletter", reward: 1.00, status: "rejected", date: "2 days ago" },
    { id: 4, title: "Follow Twitter Account", reward: 0.10, status: "approved", date: "3 days ago" },
  ];

  const filteredSubmissions = filter === 'all' 
    ? submissions 
    : submissions.filter(s => s.status === filter);

  const handleDispute = (id: number) => {
    alert(`Dispute filed for task #${id}. An admin will review it shortly.`);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Task History</h1>
        <p className="text-gray-500 text-sm">Track the status of your submitted tasks.</p>
      </header>

      {/* Filters */}
      <div className="flex space-x-2 overflow-x-auto scrollbar-hide pb-2 border-b border-gray-100">
        {(['all', 'pending', 'approved', 'rejected'] as StatusType[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize whitespace-nowrap transition-colors ${
              filter === f 
                ? 'bg-gray-900 text-white shadow-sm' 
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Submissions List */}
      <div className="space-y-3">
        {filteredSubmissions.length === 0 ? (
          <div className="text-center py-10">
            <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No submissions found in this category.</p>
          </div>
        ) : (
          filteredSubmissions.map((sub, i) => (
            <motion.div 
              key={sub.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start space-x-3">
                <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  sub.status === 'approved' ? 'bg-green-100 text-green-600' :
                  sub.status === 'rejected' ? 'bg-red-100 text-red-600' :
                  'bg-orange-100 text-orange-600'
                }`}>
                  {sub.status === 'approved' && <CheckCircle className="w-4 h-4" />}
                  {sub.status === 'rejected' && <XCircle className="w-4 h-4" />}
                  {sub.status === 'pending' && <Clock className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm">{sub.title}</h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      sub.status === 'approved' ? 'bg-green-100 text-green-700' :
                      sub.status === 'rejected' ? 'bg-red-100 text-red-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {sub.status}
                    </span>
                    <span className="text-xs text-gray-400">•</span>
                    <span className="text-xs text-gray-500">{sub.date}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-center">
                <span className={`font-bold text-lg ${
                  sub.status === 'approved' ? 'text-green-600' : 'text-gray-900'
                }`}>
                  ${sub.reward.toFixed(2)}
                </span>
                
                {sub.status === 'rejected' && (
                  <button 
                    onClick={() => handleDispute(sub.id)}
                    className="flex items-center text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 px-2 py-1 rounded inline-flex uppercase tracking-wider transition-colors mt-1"
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Appeal / Dispute
                  </button>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
