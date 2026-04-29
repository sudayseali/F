import React, { useState, useEffect } from "react";
import { Search, ChevronDown, Pin, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTelegram } from "../contexts/TelegramContext";
import { supabase } from "../lib/supabase";

export function MyTasks() {
  const navigate = useNavigate();
  const { user } = useTelegram();
  const [activeTab, setActiveTab] = useState("All");

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSubmissions() {
      if (!user?.uuid) return;
      try {
        const { data, error } = await supabase
          .from('submissions')
          .select('*, tasks(*)')
          .eq('worker_id', user.uuid)
          .order('created_at', { ascending: false });

        if (data) {
          const mapped = data.map(sub => {
            const t = sub.tasks;
            return {
              id: sub.id,
              category: "Other", // Add category to tasks later
              title: t?.title || "Unknown Task",
              pay: `$${Number(t?.reward || 0).toFixed(2)}`,
              location: "All",
              completedOn: new Date(sub.created_at).toLocaleDateString(),
              pending: t?.current_completions || 0,
              available: t ? (t.max_completions - t.current_completions) : 0,
              total: t?.max_completions || 0,
              percentage: t ? `${Math.round((t.current_completions / t.max_completions) * 100)}%` : "0%",
              status: sub.status
            };
          });
          setSubmissions(mapped);
        }
      } catch (err) {
        console.error("Error fetching submissions:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSubmissions();
  }, [user?.uuid]);

  // Derived tabs counts based on submissions if category was real, but for now we'll do simple filter:
  const filteredSubmissions = submissions.filter(s => {
    if (activeTab !== "All" && s.category !== activeTab) return false;
    return true;
  });

  return (
    <div className="bg-gray-50 dark:bg-[#0b0c10] min-h-screen text-gray-700 dark:text-gray-300 pb-20 -m-4 sm:-m-6 md:-m-8 p-4 sm:p-6 md:p-8 font-sans">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Your Completed Offers</h1>
      </header>

      {/* Tabs */}
      <div className="flex space-x-6 border-b border-gray-200 dark:border-gray-800 mb-6 overflow-x-auto scrollbar-hide">
        {[
          { id: "All", count: submissions.length },
          { id: "Social Media", count: submissions.filter(s => s.category === "Social Media").length },
          { id: "Other", count: submissions.filter(s => s.category === "Other").length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-semibold whitespace-nowrap border-b-2 flex items-center transition-colors ${ activeTab === tab.id ? "border-amber-500 text-white" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-200" }`}
          >
            {tab.id} <span className="ml-2 bg-amber-500 text-amber-950 px-1.5 py-0.5 rounded text-[10px]">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Filters (Mock front-end) */}
      <div className="space-y-3 mb-6">
        <input 
          type="text" 
          placeholder="Start date" 
          className="w-full bg-transparent border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-600"
        />
        <input 
          type="text" 
          placeholder="End date" 
          className="w-full bg-transparent border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-600"
        />
        <div className="relative">
          <label className="absolute -top-2 left-3 bg-gray-50 dark:bg-[#0b0c10] px-1 text-[10px] font-semibold text-gray-900 dark:text-white uppercase tracking-wider">Status</label>
          <select className="w-full bg-transparent border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-gray-600 appearance-none text-gray-900 dark:text-white">
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input 
            type="text" 
            placeholder="Search titles and descriptions..." 
            className="w-full bg-transparent border border-gray-200 dark:border-gray-800 rounded-lg pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-gray-600 text-gray-900 dark:text-white placeholder:text-gray-600"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 pb-4">
        <div className="min-w-[800px] border-t border-gray-200 dark:border-gray-800 px-4 sm:px-0">
          {/* Table Header */}
          <div className="grid grid-cols-[1.5fr_3fr_1fr_1fr_1fr_1fr_1.5fr_1fr] gap-4 py-4 border-b border-gray-200 dark:border-gray-800 text-[11px] font-bold text-gray-500 dark:text-gray-400 capitalize tracking-wider">
            <div>Category</div>
            <div>Offer Title</div>
            <div>Pay</div>
            <div>Location</div>
            <div>Completed On</div>
            <div className="text-center">Pending</div>
            <div className="text-right">Availability</div>
            <div className="text-right">Approval Status</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-800/60">
            {loading ? (
               <div className="py-8 text-center text-gray-500 text-sm">Loading your submissions...</div>
            ) : filteredSubmissions.length === 0 ? (
               <div className="py-8 text-center text-gray-500 text-sm">No submissions found.</div>
            ) : filteredSubmissions.map((job) => (
              <div 
                key={job.id} 
                className="grid grid-cols-[1.5fr_3fr_1fr_1fr_1fr_1fr_1.5fr_1fr] gap-4 py-4 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
              >
                <div className="text-xs text-gray-700 dark:text-gray-300 font-medium break-words leading-tight pr-2">{job.category}</div>
                <div className="text-[13px] text-gray-800 dark:text-gray-200 font-medium leading-snug">
                  {job.title}
                </div>
                <div className="text-[13px] font-bold text-gray-900 dark:text-white">{job.pay}</div>
                <div className="text-[13px] text-gray-700 dark:text-gray-300">{job.location}</div>
                <div className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                  {job.completedOn}
                </div>
                <div className="text-[13px] text-gray-700 dark:text-gray-300 text-center font-medium">{job.pending}</div>
                <div className="text-xs text-right whitespace-nowrap flex flex-col justify-center items-end">
                  <div className="text-gray-700 dark:text-gray-300 font-medium">{job.available} / {job.total}</div>
                  <div className="text-amber-500 font-bold">{job.percentage}</div>
                </div>
                <div className="flex justify-end">
                  {job.status === "approved" ? (
                    <span className="border border-[#14532d] text-[#4ade80] bg-[#052e16] px-2 py-0.5 rounded text-[10px] font-bold capitalize tracking-wider">
                      Approved
                    </span>
                  ) : job.status === "rejected" ? (
                    <span className="border border-[#7f1d1d] text-[#f87171] bg-[#450a0a] px-2 py-0.5 rounded text-[10px] font-bold capitalize tracking-wider">
                      Rejected
                    </span>
                  ) : (
                    <span className="border border-[#78350f] text-[#fbbf24] bg-[#422006] px-2 py-0.5 rounded text-[10px] font-bold capitalize tracking-wider">
                      Pending
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


