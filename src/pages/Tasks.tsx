import React, { useState, useMemo, useEffect } from "react";
import { Search, Filter, ChevronRight, CheckCircle2, Clock, Users, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "../lib/supabase";
import { useTelegram } from "../contexts/TelegramContext";
import { tgHaptics } from "../lib/telegram";

export function Tasks() {
  const navigate = useNavigate();
  const { location } = useTelegram();
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTasks() {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false });
          
        if (data) {
          const mapped = data.filter(task => {
             if (task.allowed_countries && Array.isArray(task.allowed_countries) && task.allowed_countries.length > 0) {
                 if (!task.allowed_countries.includes('International')) {
                     if (!location) return false;
                     return task.allowed_countries.includes(location.country) || task.allowed_countries.includes(location.continent);
                 }
             }
             return true;
          }).map(task => ({
            id: task.id,
            category: task.category || "Other",
            title: task.title,
            pay: `$${Number(task.reward).toFixed(2)}`,
            timeToComplete: task.job_length ? `${task.job_length}m` : "5m",
            available: (task.max_completions || 100) - (task.current_completions || 0),
            total: task.max_completions || 100,
            status: task.status
          }));
          setJobs(mapped);
        }
      } catch (err) {
        console.error("Error fetching tasks:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, [location]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (activeTab !== "All") {
        if (activeTab === "Social" && !job.category.toLowerCase().includes("social")) return false;
        if (activeTab === "Reviews" && !job.category.toLowerCase().includes("review")) return false;
        if (activeTab === "Other" && (job.category.toLowerCase().includes("social") || job.category.toLowerCase().includes("review"))) return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return job.title.toLowerCase().includes(query) || job.category.toLowerCase().includes(query);
      }
      return true;
    });
  }, [jobs, activeTab, searchQuery]);

  return (
    <div className="space-y-4 pb-6">
      {/* Header Search with glowing blue border on focus */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search active tasks & bounties..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#0c162e] border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-sky-400 shadow-md"
        />
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {["All", "Social", "Reviews", "Other"].map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => {
                tgHaptics.selection();
                setActiveTab(tab);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 active:scale-95 ${
                isActive
                  ? "bg-[#0284c7] text-white shadow-md shadow-sky-500/30"
                  : "bg-[#0c162e] text-slate-400 hover:text-white border border-white/5"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Task List */}
      <div className="space-y-2.5">
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#38bdf8]" />
            Loading active tasks...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="card-glass-dark p-8 text-center text-xs text-slate-400">
            No tasks found matching your filter.
          </div>
        ) : (
          filteredJobs.map((job) => (
            <motion.div
              key={job.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                tgHaptics.impact("light");
                navigate(`/tasks/${job.id}`);
              }}
              className="card-glass-dark p-3.5 flex items-center justify-between cursor-pointer hover:border-sky-400/40 transition-all duration-200 group active:bg-[#0f1d3d]"
            >
              <div className="flex-1 min-w-0 pr-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] text-[#38bdf8] font-bold bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 rounded-full">
                    {job.category}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-sky-400" />
                    <span>~{job.timeToComplete}</span>
                  </span>
                </div>

                <h3 className="text-xs font-bold text-white truncate group-hover:text-[#38bdf8] transition-colors">
                  {job.title}
                </h3>

                <div className="text-[10px] text-slate-400 mt-1">
                  {job.available} slots available
                </div>
              </div>

              {/* Reward & Arrow */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="badge-green-pill text-xs font-extrabold px-2.5 py-1 rounded-full tabular-nums flex items-center gap-0.5">
                  <span>{job.pay}</span>
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
