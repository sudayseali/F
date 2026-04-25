import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Users, ShieldAlert, Upload, CheckCircle } from "lucide-react";
import { useState } from "react";

export function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setTimeout(() => {
      setStatus('success');
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center space-x-4">
        <button 
          onClick={() => navigate('/tasks')}
          className="p-2 bg-white rounded-full shadow-sm hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 line-clamp-1">Task Verification</h1>
      </header>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-600 mb-3">
                Telegram
              </span>
              <h2 className="text-2xl font-bold text-gray-900 leading-tight">Join Telegram Crypto Group</h2>
            </div>
            <div className="bg-green-50 px-4 py-2 rounded-xl border border-green-100">
               <p className="text-sm text-green-600 font-medium">Reward</p>
               <p className="text-2xl font-bold text-green-700">$0.15</p>
            </div>
          </div>
          
          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            Join the official TaskMaster Crypto group on Telegram and stay active for at least 3 days. Do not mute the channel immediately to ensure your verification passes the anti-fraud checks.
          </p>

          <div className="flex flex-wrap gap-3">
             <div className="flex items-center space-x-2 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
               <Users className="w-4 h-4" />
               <span>450/500 Slots</span>
             </div>
             <div className="flex items-center space-x-2 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
               <Clock className="w-4 h-4" />
               <span>24hr hold</span>
             </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-4">Instructions</h3>
          <ol className="space-y-4 mb-8">
            <li className="flex space-x-3 text-sm text-gray-700">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">1</span>
              <span>Click the button below to go to Telegram.</span>
            </li>
            <li className="flex space-x-3 text-sm text-gray-700">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">2</span>
              <span>Join the channel and take a screenshot showing you have joined.</span>
            </li>
            <li className="flex space-x-3 text-sm text-gray-700">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">3</span>
              <span>Upload the screenshot here and input your Telegram username.</span>
            </li>
          </ol>

          <a href="#" className="block w-full py-3 px-4 bg-sky-500 hover:bg-sky-600 text-white text-center rounded-xl font-bold shadow-sm transition-colors mb-6">
            Open Telegram Channel
          </a>

          {status === 'success' ? (
             <div className="bg-green-100 border border-green-200 rounded-xl p-6 text-center text-green-700">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <h3 className="text-lg font-bold mb-1">Submission Received!</h3>
                <p className="text-sm opacity-90">Your proof is under review. The reward will be added to your wallet within 24 hours.</p>
             </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 bg-white p-5 rounded-2xl border border-gray-200">
              <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">Submit Proof</h3>
              
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Your Telegram Username</label>
                <input 
                  type="text" 
                  required
                  placeholder="@username" 
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Screenshot Proof</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-50 hover:border-blue-300 transition-colors cursor-pointer group">
                  <Upload className="w-6 h-6 mb-2 group-hover:text-blue-500 transition-colors" />
                  <span className="text-xs font-medium group-hover:text-blue-500 transition-colors">Tap to upload image</span>
                </div>
              </div>

              <div className="flex items-start space-x-2 pt-2">
                <ShieldAlert className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-gray-500 leading-tight">
                  Our anti-fraud system checks all submissions. Using fake screenshots or multiple accounts will result in an immediate permanent ban.
                </p>
              </div>

              <button 
                type="submit" 
                disabled={status === 'submitting'}
                className="w-full py-3.5 bg-gray-900 hover:bg-black text-white text-center rounded-xl font-bold shadow-sm transition-colors mt-2 disabled:opacity-70"
              >
                {status === 'submitting' ? 'Submitting...' : 'Submit Verification'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
