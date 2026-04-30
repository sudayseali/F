import React, { useState, useMemo, useEffect } from "react";
import { Search, Filter, ChevronDown, Pin, ChevronRight, CheckCircle2 } from "lucide-react";
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
    <div className="space-y-8 pb-10">
      <header className="mb-10 text-center lg:text-left">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-brand/10 text-brand text-[10px] font-bold uppercase tracking-[0.2em] mb-4">Marketplace</span>
            <h1 className="text-4xl lg:text-5xl font-display font-bold text-white tracking-tight mb-4 gradient-text">Available Opportunities</h1>
            <p className="text-slate-400 max-w-xl text-balance">
              Explore professional micro-tasks tailored to your region. Each job is verified for secure payouts.
            </p>
          </div>
          <div className="hidden lg:flex items-center space-x-2 bg-slate-900/50 p-2 rounded-2xl border border-white/5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">{jobs.length} Active Jobs</span>
          </div>
        </div>
      </header>

      {/* Tabs / Categories */}
      <div className="relative group overflow-hidden">
        <div className="flex space-x-3 overflow-x-auto scrollbar-hide pb-4 -mx-1 px-1">
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
                className={`relative px-6 py-3 rounded-2xl text-sm font-bold transition-all duration-300 border ${
                  isActive 
                    ? "bg-brand text-white border-brand shadow-[0_0_20px_rgba(59,130,246,0.3)]" 
                    : "bg-slate-900 text-slate-400 border-white/5 hover:border-white/20 hover:text-white"
                }`}
              >
                <span className="relative z-10 flex items-center whitespace-nowrap">
                  {tab.id.replace('Write an honest review', 'Reviews').replace('Social Media', 'Social')}
                  <span className={`ml-3 px-1.5 py-0.5 rounded-md text-[9px] ${isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-500'}`}>
                    {tab.count}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Global Filters */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-10">
        <div className="lg:col-span-6 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 z-10" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, skills or keyword..." 
            className="w-full bg-slate-900 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 text-white transition-all shadow-inner"
          />
        </div>
        
        <div className="lg:col-span-3 relative">
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-900 border border-white/5 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 appearance-none text-slate-300 shadow-inner font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Now</option>
            <option value="completed">Fulfilled</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        </div>

        <div className="lg:col-span-3">
          <button className="w-full flex items-center justify-center space-x-3 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl py-4 transition-all shadow-sm border border-white/5">
            <Filter className="w-4 h-4" />
            <span className="text-sm font-bold">Advanced Filters</span>
          </button>
        </div>
      </div>

      <div className="lg:hidden mb-6 relative">
          <label className="absolute -top-2.5 left-4 z-10 bg-[#020617] px-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Category</label>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-slate-900 border border-white/5 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 appearance-none text-slate-300 shadow-inner font-medium"
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
      </div>

      {/* Tasks Grid */}
      <AnimatePresence mode="popLayout">
        {loading ? (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-center py-20 premium-card !p-12 border-white/5">
            <p className="text-slate-400 font-bold uppercase tracking-[0.2em] animate-pulse">Synchronizing Jobs...</p>
          </motion.div>
        ) : filteredJobs.length === 0 ? (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-center py-24 premium-card border-white/5 flex flex-col items-center">
            <div className="p-6 bg-slate-900 rounded-full mb-6 border border-white/5">
              <Filter className="w-12 h-12 text-slate-600" />
            </div>
            <p className="text-white font-bold text-2xl mb-2">Filters Exhausted</p>
            <p className="text-slate-500 text-sm max-w-xs line-height-relaxed mx-auto text-balance">We couldn't find any contracts matching your current parameters. Try a broader search.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredJobs.map((job, index) => (
              <motion.div 
                layout
                key={job.id} 
                onClick={() => navigate(`/tasks/${job.id}`)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5, delay: index * 0.05, ease: [0.23, 1, 0.32, 1] }}
                className="premium-card group cursor-pointer flex flex-col"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-white/5 rounded-2xl border border-white/5 group-hover:bg-brand/10 group-hover:border-brand/20 transition-all duration-500">
                    <span className="text-[10px] font-bold text-slate-300 group-hover:text-brand uppercase tracking-[0.2em]">{job.category.split(' ')[0]}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${ job.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-500' }`}>
                      {job.status}
                    </span>
                  </div>
                </div>

                <h3 className="text-xl font-display font-bold text-white leading-tight mb-4 group-hover:text-brand transition-colors duration-300">
                  {job.title}
                </h3>
                
                <div className="mt-auto pt-6 border-t border-white/5">
                  <div className="flex justify-between items-end mb-6">
                    <div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Contract Pay</p>
                      <p className="text-3xl font-display font-bold text-white group-hover:text-emerald-400 transition-colors duration-500">{job.pay}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Duration</p>
                      <p className="text-sm font-bold text-slate-300">~{job.timeToComplete}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                      <span className="text-slate-500">Resource Quota</span>
                      <span className="text-slate-300">{job.available} Left</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: job.percentage }}
                        transition={{ duration: 1.5, ease: "circOut" }}
                        className="h-full bg-gradient-to-r from-brand to-brand-light rounded-full shadow-[0_0_10px_rgba(59,130,246,0.3)]" 
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


