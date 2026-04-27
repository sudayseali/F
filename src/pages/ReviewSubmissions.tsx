import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, MessageSquareX } from "lucide-react";

export function ReviewSubmissions() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Mock submissions
  const [submissions, setSubmissions] = useState([
    { id: 101, user: "@johndoe", proofText: "@johndoe_tg", proofImg: "https://placehold.co/600x400?text=Screenshot+Proof", status: "pending", date: "2 mins ago" },
    { id: 102, user: "@crypto_fan", proofText: "@crypto_fan", proofImg: "https://placehold.co/600x400?text=Invalid+Proof", status: "pending", date: "1 hour ago" },
  ]);

  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleReview = (subId: number, action: 'approved' | 'rejected', _reason?: string) => {
    setSubmissions(prev => prev.filter(sub => sub.id !== subId));
    if (action === 'rejected') {
      setRejectingId(null);
      setRejectReason("");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center space-x-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <button 
          onClick={() => navigate('/campaigns')}
          className="p-2 bg-white dark:bg-[#111218] rounded-full shadow-sm hover:bg-gray-50 dark:hover:bg-[#0b0c10] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Review Submissions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Campaign #{id} • Review carefully to prevent fraud.</p>
        </div>
      </header>

      {submissions.length === 0 ? (
        <div className="bg-white dark:bg-[#111218] p-10 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">All caught up!</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">There are no pending submissions for this campaign.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-200/80">
              <strong className="font-semibold text-amber-500">Notice:</strong> If you maliciously reject valid submissions, workers can file a dispute. Admins monitor disputes, and fraudulent advertisers will be permanently banned.
            </p>
          </div>

          {submissions.map((sub) => (
            <div key={sub.id} className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-[#0b0c10]">
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Worker: {sub.user}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Submitted {sub.date}</p>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3"><strong className="font-semibold text-gray-900 dark:text-white">Text Proof:</strong> {sub.proofText}</p>
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-black aspect-video flex items-center justify-center">
                  <img src={sub.proofImg} alt="Proof" className="max-w-full max-h-full object-contain" />
                </div>
              </div>
              
              {rejectingId === sub.id ? (
                <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-red-500/10 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-1 flex items-center">
                      <MessageSquareX className="w-4 h-4 mr-1.5 text-red-500" />
                      Reason for Rejection
                    </label>
                    <textarea 
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Explain why this submission is invalid. This will be shown to the worker..."
                      className="w-full px-3 py-2 rounded-xl border border-red-500/20 bg-white dark:bg-[#111218] text-gray-900 dark:text-white focus:outline-none focus:border-red-500 transition-all text-sm resize-none placeholder:text-gray-600"
                      rows={3}
                      autoFocus
                    ></textarea>
                  </div>
                  <div className="flex space-x-3">
                    <button 
                      onClick={() => handleReview(sub.id, 'rejected', rejectReason)}
                      disabled={!rejectReason.trim()}
                      className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                      <XCircle className="w-5 h-5 mr-2" />
                      Confirm Rejection
                    </button>
                    <button 
                      onClick={() => {
                        setRejectingId(null);
                        setRejectReason("");
                      }}
                      className="flex-1 py-2.5 bg-white dark:bg-[#111218] border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#0b0c10] text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-colors active:scale-95"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex space-x-3 bg-gray-50 dark:bg-[#0b0c10]">
                  <button 
                    onClick={() => handleReview(sub.id, 'approved')}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center transition-colors active:scale-95"
                  >
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Approve
                  </button>
                  <button 
                    onClick={() => setRejectingId(sub.id)}
                    className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold flex items-center justify-center transition-colors active:scale-95"
                  >
                    <XCircle className="w-5 h-5 mr-2" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
