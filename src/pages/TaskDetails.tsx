import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Users, ShieldAlert, Upload, CheckCircle, Image as ImageIcon, X } from "lucide-react";
import React, { useState, useRef } from "react";

export function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPG, PNG, etc).');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB.');
      return;
    }

    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
  };

  const removeImage = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please upload a screenshot proof.');
      return;
    }
    setError(null);
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
          className="p-2 bg-white dark:bg-[#111218] rounded-full shadow-sm hover:bg-gray-50 dark:hover:bg-[#0b0c10] transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-1">Offer Verification</h1>
      </header>

      <div className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex justify-between items-start mb-4">
            <div>
              <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-500 mb-3">
                Telegram
              </span>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">Join Telegram Crypto Group</h2>
            </div>
            <div className="bg-[#052e16] px-4 py-2 rounded-xl border border-[#14532d]">
               <p className="text-sm text-[#4ade80] font-medium">Reward</p>
               <p className="text-2xl font-bold text-gray-900 dark:text-white">$0.15</p>
            </div>
          </div>
          
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6">
            Join the official Payvora Crypto group on Telegram and stay active for at least 3 days. Do not mute the channel immediately to ensure your verification passes the anti-fraud checks.
          </p>

          <div className="flex flex-wrap gap-3">
             <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#0b0c10] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800">
               <Users className="w-4 h-4" />
               <span>450/500 Slots</span>
             </div>
             <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#0b0c10] px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800">
               <Clock className="w-4 h-4" />
               <span>24hr hold</span>
             </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-[#0b0c10]">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-4">Instructions</h3>
          <ol className="space-y-4 mb-8">
            <li className="flex space-x-3 text-sm text-gray-700 dark:text-gray-300">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs">1</span>
              <span>Click the button below to go to Telegram.</span>
            </li>
            <li className="flex space-x-3 text-sm text-gray-700 dark:text-gray-300">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs">2</span>
              <span>Join the channel and take a screenshot showing you have joined.</span>
            </li>
            <li className="flex space-x-3 text-sm text-gray-700 dark:text-gray-300">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-xs">3</span>
              <span>Upload the screenshot here and input your Telegram username.</span>
            </li>
          </ol>

          <a href="#" className="block w-full py-3 px-4 bg-sky-500 hover:bg-sky-600 text-gray-900 dark:text-white text-center rounded-xl font-bold shadow-sm transition-colors mb-6">
            Open Telegram Channel
          </a>

          {status === 'success' ? (
             <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center text-emerald-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-500" />
                <h3 className="text-lg font-bold mb-1 text-gray-900 dark:text-white">Submission Received!</h3>
                <p className="text-sm opacity-90 text-gray-700 dark:text-gray-300">Your proof is under review. The reward will be added to your wallet within 24 hours.</p>
             </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-[#111218] p-5 rounded-2xl border border-gray-200 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-800 pb-3">Submit Proof</h3>
              
              {error && (
                <div className="bg-red-500/10 text-red-500 px-3 py-2 text-sm rounded-lg border border-red-500/20 flex items-start">
                  <ShieldAlert className="w-4 h-4 mr-1.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Your Telegram Username</label>
                <input 
                  type="text" 
                  required
                  placeholder="@username" 
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0b0c10] text-gray-800 dark:text-gray-200 focus:bg-white dark:focus:bg-[#111218] focus:outline-none focus:border-amber-500 transition-all text-sm placeholder:text-gray-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Screenshot Proof</label>
                
                <input 
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp"
                  className="hidden"
                  id="screenshot-upload"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                
                {previewUrl ? (
                  <div className="relative border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-gray-50 dark:bg-[#0b0c10] aspect-video flex items-center justify-center">
                    <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                    <button 
                      type="button"
                      onClick={removeImage}
                      className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 text-gray-900 dark:text-white rounded-full backdrop-blur-sm transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label 
                    htmlFor="screenshot-upload"
                    className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#0b0c10] hover:border-amber-500 hover:text-amber-500 transition-colors cursor-pointer group"
                  >
                    <Upload className="w-8 h-8 mb-3" />
                    <span className="text-sm font-medium mb-1 group-hover:text-amber-500">Tap to upload image</span>
                    <span className="text-xs text-gray-500 flex items-center space-x-1"><ImageIcon className="w-3 h-3"/><span>PNG, JPG, WEBP up to 5MB</span></span>
                  </label>
                )}
              </div>

              <div className="flex items-start space-x-2 pt-2">
                <ShieldAlert className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                  Our anti-fraud system checks all submissions. Using fake screenshots or multiple accounts will result in an immediate permanent ban.
                </p>
              </div>

              <button 
                type="submit" 
                disabled={status === 'submitting'}
                className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-amber-950 text-center rounded-xl font-bold transition-colors mt-2 disabled:opacity-70 active:scale-95"
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
