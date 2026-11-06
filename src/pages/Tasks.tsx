import React, { useState, useMemo, useEffect } from "react";
import { Search, Filter, ChevronRight, CheckCircle2, Clock, Users, Loader2 } from "lucide-react";
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
      {/* Header Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#7e8c9b]" />
        <input
          type="text"
          placeholder="Search available tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#17212b] border border-white/5 rounded-xl pl-9 pr-3.5 py-2.5 text-xs text-white placeholder-[#7e8c9b] focus:outline-none focus:border-[#2481cc]"
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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 ${
                isActive
                  ? "bg-[#2481cc] text-white shadow-md shadow-[#2481cc]/25"
                  : "bg-[#17212b] text-[#7e8c9b] hover:text-white border border-white/5"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {loading ? (
          <div className="py-12 text-center text-xs text-[#7e8c9b]">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#2481cc]" />
            Loading active tasks...
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="tg-card p-8 text-center text-xs text-[#7e8c9b]">
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
              className="tg-card p-3.5 flex items-center justify-between cursor-pointer hover:border-[#2481cc]/30 transition group"
            >
              <div className="flex-1 min-w-0 pr-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] text-[#2481cc] font-semibold bg-[#2481cc]/10 px-2 py-0.5 rounded">
                    {job.category}
                  </span>
                  <span className="text-[10px] text-[#7e8c9b] flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    <span>~{job.timeToComplete}</span>
                  </span>
                </div>

                <h3 className="text-xs font-bold text-white truncate group-hover:text-[#2481cc] transition-colors">
                  {job.title}
                </h3>

                <div className="text-[10px] text-[#7e8c9b] mt-1">
                  {job.available} slots remaining
                </div>
              </div>

              {/* Reward & Arrow */}
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg tabular-nums">
                  {job.pay}
                </span>
                <ChevronRight className="w-4 h-4 text-[#7e8c9b] group-hover:text-white transition-colors" />
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
