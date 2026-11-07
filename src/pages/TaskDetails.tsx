import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Users, ShieldAlert, Upload, CheckCircle, Image as ImageIcon, X, Loader2 } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { tgHaptics, tgBackButton } from "../lib/telegram";

export function TaskDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    tgBackButton.show(() => navigate('/tasks'));
    return () => tgBackButton.hide();
  }, [navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      setError('Please upload an image file (JPG, PNG, WebP).');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    tgHaptics.impact("medium");
    if (!file) {
      setError('Please attach a screenshot proof.');
      return;
    }
    setError(null);
    setStatus('submitting');
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('proofs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('proofs')
        .getPublicUrl(fileName);

      const { error: submitError } = await supabase.functions.invoke('submit_task', {
        body: {
          task_id: id,
          proof: publicUrl,
          proof_text: publicUrl,
          proof_data: publicUrl,
          telegram_username: username
        }
      });

      if (submitError) throw submitError;

      tgHaptics.notification("success");
      setStatus('success');
    } catch (err: any) {
      console.error(err);
      tgHaptics.notification("error");
      setError(err.message || 'Submission failed. Please try again.');
      setStatus('idle');
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Back Header */}
      <button 
        onClick={() => {
          tgHaptics.impact("light");
          navigate('/tasks');
        }}
        className="flex items-center gap-1.5 text-xs font-bold text-[#38bdf8] active:opacity-70"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Tasks</span>
      </button>

      {/* Task Info Card */}
      <div className="card-glass-dark p-4.5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold text-[#38bdf8] bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded-full">
              Telegram Task
            </span>
            <h2 className="text-base font-bold text-white mt-1.5 leading-snug">
              Join Telegram Community & Channel
            </h2>
          </div>
          <div className="text-right shrink-0">
            <span className="badge-green-pill text-xs font-extrabold px-2.5 py-1 rounded-full">
              +$0.15
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Join our official channel, stay active, and upload a screenshot proof of membership.
        </p>

        <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-2 border-t border-white/5">
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>450/500 Slots</span>
          </div>
          <span>·</span>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>Instant review</span>
          </div>
        </div>
      </div>

      {/* Instructions & Submission */}
      <div className="card-glass-dark p-4.5 space-y-4">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider text-slate-400">
          Instructions
        </h3>

        <ol className="space-y-2 text-xs text-slate-200">
          <li className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-sky-500/20 text-[#38bdf8] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
            <span>Open the channel and tap <b>Join</b>.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-sky-500/20 text-[#38bdf8] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
            <span>Take a screenshot showing you are a member.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="w-4 h-4 rounded-full bg-sky-500/20 text-[#38bdf8] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
            <span>Upload the screenshot proof below.</span>
          </li>
        </ol>

        <a
          href="https://t.me/PayvoraCommunity"
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => tgHaptics.impact("light")}
          className="block w-full py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-[#38bdf8] font-bold text-xs text-center border border-sky-500/30 transition active:scale-98 shadow-sm"
        >
          Open Telegram Channel →
        </a>

        {status === 'success' ? (
          <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-4 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
            <h4 className="text-sm font-bold text-white mb-0.5">Proof Submitted!</h4>
            <p className="text-xs text-slate-300">
              Your proof has been received. Reward will be added to your balance shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 pt-2 border-t border-white/5">
            {error && (
              <div className="bg-rose-500/15 text-rose-300 px-3 py-2 text-xs rounded-xl border border-rose-500/30 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Your Telegram Username
              </label>
              <input 
                type="text" 
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="@username" 
                className="w-full px-3.5 py-2.5 rounded-xl border border-white/10 bg-[#0c162e] text-xs text-white focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Screenshot Proof
              </label>
              <input 
                type="file"
                accept="image/*"
                className="hidden"
                id="screenshot-upload"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              
              {previewUrl ? (
                <div className="relative border border-white/10 rounded-2xl overflow-hidden bg-[#0c162e] aspect-video flex items-center justify-center">
                  <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                  <button 
                    type="button"
                    onClick={removeImage}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full active:scale-95"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label 
                  htmlFor="screenshot-upload"
                  className="border border-dashed border-white/15 rounded-2xl p-5 flex flex-col items-center justify-center text-slate-400 hover:border-sky-400 hover:text-sky-300 transition cursor-pointer active:scale-98 bg-[#0c162e]/50"
                >
                  <Upload className="w-6 h-6 mb-1.5 text-sky-400" />
                  <span className="text-xs font-semibold text-white">Tap to select screenshot</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG up to 5MB</span>
                </label>
              )}
            </div>

            <button 
              type="submit" 
              disabled={status === 'submitting'}
              className="w-full py-3 btn-cyan-glow text-white text-center rounded-xl font-extrabold text-xs transition active:scale-98 disabled:opacity-50 shadow-lg shadow-sky-500/25 flex items-center justify-center gap-1.5 mt-2"
            >
              {status === 'submitting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Verification</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
