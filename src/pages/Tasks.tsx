import React, { useState, useMemo, useEffect } from "react";
import { Search, Filter, ChevronDown, Pin, ChevronRight, CheckCircle2, LayoutGrid, LayoutList } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { supabase } from "../lib/supabase";
import { useTelegram } from "../contexts/TelegramContext";

export function Tasks() {
  const navigate = useNavigate();
  const { location } = useTelegram();
  const [activeTab, setActiveTab] = useState("All");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
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
             // Location targeting logic
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
            pinned: false,
            pay: `$${Number(task.reward).toFixed(2)}`,
            location: (task.allowed_countries && task.allowed_countries.length > 0 && !task.allowed_countries.includes('International')) ? "Specific Regions" : "International",
            timeToComplete: task.job_length ? `${task.job_length}m` : "N/A",
            created: new Date(task.created_at).toLocaleDateString(),
            pending: 0,
            available: task.max_completions - (task.current_completions || 0),
            total: task.max_completions,
            percentage: `${Math.round(((task.current_completions || 0) / task.max_completions) * 100)}%`,
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
    // ensure location is ready if it's supposed to be fetched
    if (location !== undefined) {
      fetchTasks();
    }
  }, [location]);

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (activeTab !== "All" && job.category !== activeTab) return false;
      if (categoryFilter !== "all" && job.category !== categoryFilter) return false;
      if (statusFilter !== "all" && job.status !== statusFilter) return false;

      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!job.title.toLowerCase().includes(query) && !job.category.toLowerCase().includes(query)) {
          return false;
        }
      }

      if (startDate || endDate) {
        const jobDate = new Date(job.created);

        if (startDate) {
          const sDate = new Date(startDate);
          if (jobDate < sDate) return false;
        }

        if (endDate) {
          const eDate = new Date(endDate);
          eDate.setHours(23, 59, 59, 999);
          if (jobDate > eDate) return false;
        }
      }

      return true;
    });
  }, [jobs, activeTab, startDate, endDate, statusFilter, categoryFilter, searchQuery]);

  const categories = useMemo(() => {
    const cats = new Set(jobs.map(j => j.category));
    return Array.from(cats);
  }, [jobs]);

  return (
    <div className="space-y-10 pb-24">
      <header className="mb-12 text-center lg:text-left pt-4">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
          <div>
            <span className="inline-block px-4 py-1.5 rounded-full bg-[#111827] text-brand text-[10px] font-bold uppercase tracking-[0.3em] mb-6 border border-brand/20 shadow-inner">
              Task Matrix
            </span>
            <h1 className="text-5xl lg:text-6xl font-serif font-bold text-white tracking-tight mb-4 flex flex-col gap-2">
              Available <span className="font-light italic text-white/50">Contracts</span>
            </h1>
            <p className="text-white/50 max-w-xl text-lg font-serif">
              Explore specialized micro-tasks tailored to your clearance level. Each contract is verified for secure fulfillment.
            </p>
          </div>
          <div className="hidden lg:flex items-center space-x-3 bg-white/[0.02] p-3 rounded-[1.5rem] border border-white/5 backdrop-blur-md">
            <div className="w-2 h-2 rounded-full bg-brand animate-ping" />
            <span className="text-xs font-bold text-white/60 uppercase tracking-widest px-2">{filteredJobs.length} Active Nodes</span>
          </div>
        </div>
      </header>

      {/* Tabs / Categories */}
      <div className="relative group overflow-hidden">
        <div className="flex space-x-4 overflow-x-auto scrollbar-hide pb-4 -mx-1 px-1">
          {[
            { id: "All", count: jobs.length },
            { id: "Social Media", count: jobs.filter(j => j.category === "Social Media").length },
            { id: "Write an honest review", count: jobs.filter(j => j.category === "Write an honest review").length },
            { id: "Other", count: jobs.filter(j => j.category === "Other").length },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id !== "All") setCategoryFilter("all");
                }}
                className={`relative px-8 py-4 rounded-[1.5rem] text-sm transition-all duration-500 border ${
                  isActive 
                    ? "bg-[#1a0f0a] text-brand border-brand/40 shadow-[0_0_20px_rgba(255,78,0,0.15)] font-black uppercase tracking-wider" 
                    : "bg-black/20 text-white/40 border-white/5 hover:border-white/20 hover:text-white font-medium"
                }`}
              >
                <span className="relative z-10 flex items-center whitespace-nowrap">
                  {tab.id.replace('Write an honest review', 'Reviews').replace('Social Media', 'Social')}
                  <span className={`ml-4 px-2 py-1 rounded-lg text-[9px] font-bold ${isActive ? 'bg-brand/10 text-brand border border-brand/20' : 'bg-white/[0.02] text-white/30 border border-white/5'}`}>
                    {tab.count}
                  </span>
                </span>
                {isActive && (
                  <motion.div layoutId="tabIndicator" className="absolute -bottom-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-brand to-transparent opacity-50" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Global Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-12">
        <div className="lg:col-span-6 relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-brand/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem] blur-xl pointer-events-none" />
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 z-10 group-focus-within:text-brand transition-colors" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Initialize query parameters..." 
            className="w-full bg-[#111827]/50 border border-white/10 rounded-[2rem] pl-14 pr-6 py-5 text-sm focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/40 text-white transition-all shadow-inner backdrop-blur-md placeholder:text-white/20 placeholder:font-serif placeholder:italic"
          />
        </div>
        
        <div className="lg:col-span-3 relative">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-[#0A0E1A]/80 border border-white/10 rounded-[2rem] px-6 py-5 text-sm focus:outline-none focus:border-brand/40 focus:ring-1 focus:ring-brand/40 appearance-none text-white/70 shadow-inner font-medium backdrop-blur-md"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Sequence</option>
            <option value="completed">Fulfilled</option>
          </select>
          <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        </div>

        <div className="lg:col-span-3">
          <button className="w-full h-full flex items-center justify-center space-x-3 bg-white/[0.02] hover:bg-white/5 text-white rounded-[2rem] py-5 transition-all duration-300 border border-white/10 active:scale-95 group">
            <Filter className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
            <span className="text-sm font-bold tracking-wide uppercase">Refine Logic</span>
          </button>
        </div>
      </div>

      <div className="lg:hidden mb-8 relative">
          <label className="absolute -top-2.5 left-6 z-10 bg-[#0A0E1A] px-2 text-[9px] font-bold text-brand uppercase tracking-[0.2em]">Target Sector</label>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-[#111827]/50 border border-white/10 rounded-[2rem] px-6 py-5 text-sm focus:outline-none focus:border-brand/40 appearance-none text-white/80 shadow-inner font-medium backdrop-blur-md"
          >
            <option value="all">All Sectors</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
      </div>

      {/* Tasks Grid */}
      <AnimatePresence mode="popLayout">
        {loading ? (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-center py-32 premium-card !p-12 border-white/5 bg-[#0A0E1A]/80 backdrop-blur-xl">
            <p className="text-white/30 font-bold uppercase tracking-[0.3em] font-mono animate-pulse">Synchronizing Ledgers...</p>
          </motion.div>
        ) : filteredJobs.length === 0 ? (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-center py-32 premium-card border-white/5 flex flex-col items-center bg-[#0A0E1A]/80 backdrop-blur-xl">
            <div className="p-8 bg-white/[0.02] rounded-[2rem] mb-8 border border-white/5 shadow-inner">
              <Filter className="w-12 h-12 text-white/20" />
            </div>
            <p className="text-white font-display font-bold text-3xl mb-4 tracking-tight">Query Null</p>
            <p className="text-white/40 text-lg max-w-sm font-serif italic line-height-relaxed mx-auto text-balance">No active contracts match current parameters. Recalibrate logic filters.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredJobs.map((job, index) => (
              <motion.div 
                layout
                key={job.id} 
                onClick={() => navigate(`/tasks/${job.id}`)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5, delay: index * 0.05, ease: [0.23, 1, 0.32, 1] }}
                className="premium-card group cursor-pointer flex flex-col !p-8 !rounded-[2rem] bg-gradient-to-br from-[#111827]/80 to-[#0A0E1A]/80 backdrop-blur-2xl"
              >
                <div className="flex justify-between items-start mb-8">
                  <div className="px-4 py-2 bg-brand/5 rounded-full border border-brand/10 group-hover:bg-brand/10 group-hover:border-brand/20 transition-all duration-500 shadow-inner">
                    <span className="text-[10px] font-bold text-white/50 group-hover:text-brand uppercase tracking-[0.2em]">{job.category.split(' ')[0]}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] shadow-inner ${ job.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-white/5 text-white/40 border border-white/10' }`}>
                      {job.status}
                    </span>
                  </div>
                </div>

                <h3 className="text-2xl font-display font-bold text-white leading-tight mb-8 group-hover:text-brand transition-colors duration-500 tracking-tight">
                  {job.title}
                </h3>
                
                <div className="mt-auto pt-8 border-t border-white/[0.05]">
                  <div className="flex justify-between items-end mb-8">
                    <div>
                      <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em] mb-2 font-mono">Bounty</p>
                      <p className="text-4xl font-display font-black text-white group-hover:text-brand transition-colors duration-500 tracking-tighter drop-shadow-lg">{job.pay}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em] mb-2 font-mono">Time</p>
                      <p className="text-lg font-bold text-white/60">~{job.timeToComplete}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.2em]">
                      <span className="text-white/30">Network Capacity</span>
                      <span className="text-brand">{job.available} Left</span>
                    </div>
                    <div className="h-2 w-full bg-[#0A0E1A] border border-white/5 rounded-full overflow-hidden shadow-inner flex">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: job.percentage }}
                        transition={{ duration: 1.5, ease: "circOut" }}
                        className="h-full bg-gradient-to-r from-brand-dark via-brand to-brand-light rounded-full" 
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


