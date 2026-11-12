import React, { useState, useMemo, useEffect } from "react";
import { Search, Filter, ChevronRight, CheckCircle2, Clock, Users, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "../lib/supabase";
import { useTelegram } from "../contexts/TelegramContext";
import { tgHaptics } from "../lib/telegram";
import { ASSETS_3D } from "../lib/assets";
import { PayvoraLoadingState } from "../components";
import type { TaskItem } from "../types";

export function Tasks() {
  const navigate = useNavigate();
  const { location, user } = useTelegram();
  const [activeTab, setActiveTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [jobs, setJobs] = useState<TaskItem[]>([]);
  const [userStats, setUserStats] = useState({ completed: 0, pending: 0 });
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
                     if (!location) return true;
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

        if (user?.uuid) {
          const { data: subs } = await supabase
            .from('submissions')
            .select('status')
            .eq('user_id', user.uuid);
          if (subs) {
            setUserStats({
              completed: subs.filter(s => s.status === 'approved').length,
              pending: subs.filter(s => s.status === 'pending').length,
            });
          }
        }
      } catch (err) {
        console.error("Error fetching tasks:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchTasks();
  }, [location, user?.uuid]);

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
      {/* Category Pills at top matching Mockup Screen 3 */}
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

      {/* Hero Banner: Complete Tasks Earn More! with 3D Rocket */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#1e1b4b] via-[#2e1065] to-[#1e3a8a] border border-sky-400/30 p-5 shadow-2xl">
        <div className="absolute top-0 right-0 w-40 h-40 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4 mb-3">
          <div className="shrink-0 -ml-1">
            <img
              src={ASSETS_3D.rocket}
              alt="3D Rocket"
              className="w-16 h-16 object-contain drop-shadow-[0_10px_20px_rgba(56,189,248,0.5)] transform -rotate-12"
            />
          </div>
          <div>
            <h2 className="text-base font-black text-white tracking-tight leading-snug">
              Complete Tasks<br />Earn More!
            </h2>
            <p className="text-[11px] text-sky-200/80 mt-1 leading-snug">
              Follow channels, like posts, and complete simple tasks.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            tgHaptics.impact("light");
            const el = document.getElementById("tasks-list-anchor");
            if (el) el.scrollIntoView({ behavior: "smooth" });
          }}
          className="w-full py-2.5 rounded-xl btn-cyan-glow text-white font-extrabold text-xs shadow-lg transition active:scale-98"
        >
          View Tasks
        </button>
      </div>

      {/* Task Stats Section matching Screen 3 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Sparkles className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>Task Stats</span>
          </div>
          <span className="text-xs font-bold text-[#38bdf8] flex items-center gap-0.5 cursor-pointer">
            <span>See All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Card 1: Completed */}
          <div className="card-glass-dark p-3 rounded-2xl flex flex-col items-center justify-center text-center">
            <div className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-1">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Completed</span>
            <span className="text-sm font-black text-white tabular-nums mt-0.5">{userStats.completed}</span>
          </div>

          {/* Card 2: Earned */}
          <div className="card-glass-dark p-3 rounded-2xl flex flex-col items-center justify-center text-center">
            <div className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center mb-1">
              <img src={ASSETS_3D.starCoin} alt="" className="w-4 h-4 object-contain" />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Earned</span>
            <span className="text-sm font-black text-white tabular-nums mt-0.5">${(user?.balance || 0).toFixed(2)}</span>
          </div>

          {/* Card 3: Pending Review */}
          <div className="card-glass-dark p-3 rounded-2xl flex flex-col items-center justify-center text-center">
            <div className="w-7 h-7 rounded-xl bg-purple-500/15 text-purple-300 flex items-center justify-center mb-1">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-[10px] text-slate-400 font-medium">In Review</span>
            <span className="text-sm font-black text-amber-400 tabular-nums mt-0.5">{userStats.pending}</span>
          </div>
        </div>
      </div>

      {/* Task List Anchor */}
      <div id="tasks-list-anchor" className="space-y-2.5 pt-1">
        {loading ? (
          <PayvoraLoadingState message="Loading active tasks..." size="md" className="py-12" />
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
