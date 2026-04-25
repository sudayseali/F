import React, { useState } from "react";
import { PlusCircle, Target, Link as LinkIcon, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTelegram } from "../contexts/TelegramContext";

export function CreateTask() {
  const navigate = useNavigate();
  const { user } = useTelegram();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    reward: "",
    slots: "",
    proof_type: "image",
    target_url: "",
    platform: "telegram"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const reward = parseFloat(formData.reward);
    const slots = parseInt(formData.slots, 10);

    if (reward <= 0) {
      setError("Reward must be greater than $0.");
      setIsSubmitting(false);
      return;
    }
    if (slots <= 0) {
      setError("Slots must be at least 1.");
      setIsSubmitting(false);
      return;
    }

    try {
      // Simulate an API call to the Edge Function
      // In a real app, you would fetch from your Supabase Edge Function URL:
      // await fetch(`${process.env.VITE_SUPABASE_URL}/functions/v1/create_task`, { ... })
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate success response
      navigate("/tasks");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const totalCost = (parseFloat(formData.reward || "0") * parseInt(formData.slots || "0", 10)).toFixed(2);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Create New Task</h1>
        <p className="text-gray-500 text-sm">Post a task and get real users to complete it.</p>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm flex items-start">
          <AlertCircle className="w-5 h-5 mr-2 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden p-6 space-y-5">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Task Title</label>
          <input 
            type="text" 
            name="title"
            required
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Join our Crypto Telegram Group" 
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
          />
        </div>

        <div>
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Platform</label>
                <select 
                  name="platform"
                  value={formData.platform}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm appearance-none"
                >
                  <option value="telegram">Telegram</option>
                  <option value="youtube">YouTube</option>
                  <option value="tiktok">TikTok</option>
                  <option value="twitter">Twitter</option>
                  <option value="web">Website</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Proof Required</label>
                <select 
                  name="proof_type"
                  value={formData.proof_type}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm appearance-none"
                >
                  <option value="image">Screenshot</option>
                  <option value="text">Text / Username</option>
                  <option value="url">URL Link</option>
                </select>
              </div>
           </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Target URL</label>
          <div className="relative flex items-center">
            <LinkIcon className="absolute left-3 w-4 h-4 text-gray-400" />
            <input 
              type="url" 
              name="target_url"
              required
              value={formData.target_url}
              onChange={handleChange}
              placeholder="https://t.me/yourgroup" 
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Detailed Description & Instructions</label>
          <textarea 
            name="description"
            required
            rows={4}
            value={formData.description}
            onChange={handleChange}
            placeholder="1. Click the link...&#10;2. Join the channel...&#10;3. Submit screenshot showing you joined." 
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm resize-none"
          ></textarea>
        </div>

        <div className="pt-4 border-t border-gray-100">
           <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Reward per User ($)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                  <input 
                    type="number" 
                    name="reward"
                    required
                    min="0.01"
                    step="0.01"
                    value={formData.reward}
                    onChange={handleChange}
                    placeholder="0.10" 
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Number of Slots</label>
                <div className="relative">
                  <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input 
                    type="number" 
                    name="slots"
                    required
                    min="1"
                    step="1"
                    value={formData.slots}
                    onChange={handleChange}
                    placeholder="100" 
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                  />
                </div>
              </div>
           </div>
        </div>

        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
           <div>
              <p className="text-sm font-semibold text-blue-900">Total Campaign Cost</p>
              <p className="text-xs text-blue-700 mt-0.5">Will be deducted from your wallet balance.</p>
           </div>
           <div className="text-right">
              <span className="text-2xl font-bold text-blue-700">${isNaN(parseFloat(totalCost)) ? "0.00" : totalCost}</span>
           </div>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white text-center rounded-xl font-bold shadow-sm transition-colors mt-2 disabled:opacity-70 flex items-center justify-center"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
          ) : (
            <>
              <PlusCircle className="w-5 h-5 mr-2" />
              Publish Task
            </>
          )}
        </button>
      </form>
    </div>
  );
}
