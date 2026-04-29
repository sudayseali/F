import React, { useState, useMemo, useEffect } from "react";
import { Search, Filter, ChevronDown, Pin, ChevronRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
      <header className="mb-8">
        <h1 className="text-3xl font-display font-bold text-gray-900 dark:text-white tracking-tight mb-2">Explore Offers</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg">
          We've detected your location. Only offers available in your region are displayed.
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-400 dark:border-gray-600 text-[10px] ml-1 opacity-70">i</span>
        </p>
      </header>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-200/50 dark:border-white/10 mb-8 overflow-x-auto scrollbar-hide pb-1">
        {[
          { id: "All", count: jobs.length },
          { id: "Social Media", count: jobs.filter(j => j.category === "Social Media").length },
          { id: "Other", count: jobs.filter(j => j.category === "Other").length },
          { id: "Write an honest review", count: jobs.filter(j => j.category === "Write an honest review").length },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== "All") setCategoryFilter("all");
              }}
              className={`relative px-4 py-2.5 text-sm font-bold whitespace-nowrap rounded-xl transition-all ${ isActive ? "text-brand" : "text-gray-500 dark:text-gray-400 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/5 dark:hover:text-white" }`}
            >
              {isActive && (
                 <motion.div
                   layoutId="tasksTab"
                   className="absolute inset-0 bg-brand/10 rounded-xl"
                   transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                 />
              )}
              <span className="relative z-10 flex items-center">
                {tab.id.replace('Write an honest review', 'Reviews')}
                <span className={`ml-2 px-2 py-0.5 rounded-md text-[10px] ${isActive ? 'bg-brand text-white' : 'bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300'}`}>
                  {tab.count}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="relative col-span-1 md:col-span-2 lg:col-span-1">
          <label className="absolute -top-2.5 left-4 z-10 bg-[#f8fafc] dark:bg-[#09090b] px-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Search</label>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10 pointer-events-none" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search offers..." 
            className="w-full glass-panel border border-gray-200/50 dark:border-white/10 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-gray-900 dark:text-white placeholder:text-gray-400 relative z-0 transition-all shadow-sm"
          />
        </div>
        
        <div className="relative">
          <label className="absolute -top-2.5 left-4 z-10 bg-[#f8fafc] dark:bg-[#09090b] px-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</label>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full glass-panel border border-gray-200/50 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent appearance-none text-gray-900 dark:text-white shadow-sm font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>

        <div className="relative">
          <label className="absolute -top-2.5 left-4 z-10 bg-[#f8fafc] dark:bg-[#09090b] px-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Start Date</label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full glass-panel border border-gray-200/50 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark] shadow-sm font-medium"
          />
        </div>

        <div className="relative">
          <label className="absolute -top-2.5 left-4 z-10 bg-[#f8fafc] dark:bg-[#09090b] px-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">End Date</label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full glass-panel border border-gray-200/50 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-gray-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark] shadow-sm font-medium"
          />
        </div>
      </div>

      <div className="lg:hidden mb-6 relative">
          <label className="absolute -top-2.5 left-4 z-10 bg-[#f8fafc] dark:bg-[#09090b] px-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Category</label>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full glass-panel border border-gray-200/50 dark:border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent appearance-none text-gray-900 dark:text-white shadow-sm font-medium"
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      </div>

      {/* Tasks Grid */}
      <AnimatePresence mode="popLayout">
        {loading ? (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-center py-20 glass-panel rounded-[2rem]">
            <p className="text-gray-500 font-medium animate-pulse">Loading offers...</p>
          </motion.div>
        ) : filteredJobs.length === 0 ? (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="text-center py-20 glass-panel rounded-[2rem] flex flex-col items-center">
            <Filter className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-900 dark:text-white font-bold text-lg mb-1">No offers found</p>
            <p className="text-gray-500 text-sm">Try adjusting your filters or search query.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredJobs.map((job, index) => (
              <motion.div 
                layout
                key={job.id} 
                onClick={() => navigate(`/tasks/${job.id}`)}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="glass-panel border-transparent hover:border-brand/30 rounded-[2rem] p-6 cursor-pointer hover-lift flex flex-col relative overflow-hidden group"
              >
                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-5">
                    <span className="text-[10px] font-bold text-brand uppercase tracking-widest bg-brand/10 px-2.5 py-1 rounded-lg">{job.category}</span>
                    <span className={`border px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize tracking-wide shadow-sm ${ job.status === 'active' ? 'border-emerald-200 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10' : job.status === 'completed' ? 'border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10' : 'border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-500/10' }`}>
                      {job.status}
                    </span>
                  </div>
                  
                  <div className="flex items-start mb-6">
                    {job.pinned && <Pin className="w-5 h-5 text-amber-500 mr-2 shrink-0 fill-amber-500" />}
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white leading-tight group-hover:text-brand transition-colors line-clamp-2">{job.title}</h3>
                  </div>
                </div>
                
                <div className="mt-auto relative z-10">
                  <div className="flex justify-between items-center bg-white/50 dark:bg-white/5 p-4 rounded-2xl border border-gray-100 dark:border-white/5 mb-5 group-hover:border-brand/20 transition-colors">
                    <div>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mb-1 uppercase tracking-widest">Reward</p>
                      <p className="text-2xl font-display font-black text-emerald-600 dark:text-emerald-400 leading-none">{job.pay}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mb-1 uppercase tracking-widest">Time</p>
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-300 leading-none flex items-center justify-end"><CheckCircle2 className="w-4 h-4 mr-1 text-gray-400"/> {job.timeToComplete}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div className="flex flex-col flex-1 mr-6">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Available Spots</span>
                        <span className="text-[11px] font-bold text-gray-900 dark:text-white">{job.available} <span className="text-gray-400">/ {job.total}</span></span>
                      </div>
                      <div className="w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: job.percentage }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className="h-full bg-gradient-to-r from-brand to-brand-light rounded-full" 
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400 font-bold text-right shrink-0 uppercase tracking-wider">
                      {job.created}
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


