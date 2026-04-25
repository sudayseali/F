import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

export function ReviewSubmissions() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Mock submissions
  const [submissions, setSubmissions] = useState([
    { id: 101, user: "@johndoe", proofText: "@johndoe_tg", proofImg: "https://placehold.co/600x400?text=Screenshot+Proof", status: "pending", date: "2 mins ago" },
    { id: 102, user: "@crypto_fan", proofText: "@crypto_fan", proofImg: "https://placehold.co/600x400?text=Invalid+Proof", status: "pending", date: "1 hour ago" },
  ]);

  const handleReview = (subId: number, action: 'approved' | 'rejected') => {
    setSubmissions(prev => prev.filter(sub => sub.id !== subId));
    // In real app, call Supabase edge function to update status and handle funds
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center space-x-4 border-b border-gray-200 pb-4">
        <button 
          onClick={() => navigate('/campaigns')}
          className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Review Submissions</h1>
          <p className="text-sm text-gray-500">Campaign #{id} • Review carefully to prevent fraud.</p>
        </div>
      </header>

      {submissions.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl border border-gray-100 shadow-sm text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900">All caught up!</h3>
          <p className="text-gray-500 text-sm">There are no pending submissions for this campaign.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            <p className="text-sm text-orange-800">
              <strong className="font-semibold">Notice:</strong> If you maliciously reject valid submissions, workers can file a dispute. Admins monitor disputes, and fraudulent advertisers will be permanently banned.
            </p>
          </div>

          {submissions.map((sub) => (
            <div key={sub.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                  <h4 className="font-bold text-gray-900">Worker: {sub.user}</h4>
                  <p className="text-xs text-gray-500">Submitted {sub.date}</p>
                </div>
              </div>
              <div className="p-4">
                <p className="text-sm text-gray-700 mb-3"><strong className="font-semibold">Text Proof:</strong> {sub.proofText}</p>
                <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-100 aspect-video flex items-center justify-center">
                  <img src={sub.proofImg} alt="Proof" className="max-w-full max-h-full object-contain" />
                </div>
              </div>
              <div className="p-4 border-t border-gray-100 flex space-x-3 bg-gray-50">
                <button 
                  onClick={() => handleReview(sub.id, 'approved')}
                  className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center justify-center transition-colors"
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Approve (Pay Worker)
                </button>
                <button 
                  onClick={() => handleReview(sub.id, 'rejected')}
                  className="flex-1 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-bold flex items-center justify-center transition-colors"
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  Reject (Invalid)
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
