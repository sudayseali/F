import React, { useState, useMemo } from "react";
import { Search, Filter, ChevronDown, Pin, ChevronRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const JOBS = [
  { id: 1, category: "Other", title: "reddit rep post and user. 1 minutes to do", pinned: true, pay: "$0.05", location: "All", timeToComplete: "20 minutes", created: "04/24/26", pending: 15, available: 96, total: 239, percentage: "40.17%", status: "active" },
  { id: 2, category: "Offer/Sign up", title: "Simple Sign Up only", pinned: true, pay: "$0.05", location: "All", timeToComplete: "1 minutes", created: "04/13/26", pending: 131, available: 496, total: 590, percentage: "84.07%", status: "completed" },
  { id: 3, category: "Social Media", title: "Download, fast payment", pinned: true, pay: "$0.08", location: "All", timeToComplete: "1 minutes", created: "04/02/26", pending: 4, available: 6, total: 15, percentage: "40.0%", status: "active" },
  { id: 4, category: "Other", title: "Visit Website (Fast Approval)", pinned: true, pay: "$0.05", location: "All", timeToComplete: "2 minutes", created: "03/31/26", pending: 7, available: 48, total: 500, percentage: "9.6%", status: "active" },
  { id: 5, category: "Social Media", title: "A task valid for both new and existing users.", pinned: false, pay: "$0.15", location: "All", timeToComplete: "1 minutes", created: "04/26/26", pending: 1, available: 1, total: 10, percentage: "10.0%", status: "canceled" },
  { id: 6, category: "Write an honest review", title: "5 Star Trustpilot", pinned: false, pay: "$0.05", location: "All", timeToComplete: "1 minutes", created: "04/26/26", pending: 0, available: 0, total: 9, percentage: "0%", status: "active" },
  { id: 7, category: "Write an honest review", title: "Trustpilot Review", pinned: false, pay: "$0.05", location: "All", timeToComplete: "1 minutes", created: "04/26/26", pending: 1, available: 1, total: 6, percentage: "16.67%", status: "active" },
  { id: 8, category: "Social Media", title: "comment on reddit post ( 1 min )", pinned: false, pay: "$0.20", location: "All", timeToComplete: "1 minutes", created: "04/26/26", pending: 20, available: 20, total: 120, percentage: "16.67%", status: "active" },
];

export function Tasks() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("All");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredJobs = useMemo(() => {
    return JOBS.filter((job) => {
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
        const [month, day, year] = job.created.split('/');
        const jobDate = new Date(`20${year}-${month}-${day}T00:00:00Z`);

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
  }, [activeTab, startDate, endDate, statusFilter, categoryFilter, searchQuery]);

  // Unique categories for the dropdown
  const categories = useMemo(() => {
    const cats = new Set(JOBS.map(j => j.category));
    return Array.from(cats);
  }, []);

  return (
    <div className="bg-gray-50 dark:bg-[#0b0c10] min-h-screen text-gray-700 dark:text-gray-300 pb-20 -m-4 sm:-m-6 md:-m-8 p-4 sm:p-6 md:p-8 font-sans">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Explore Available Jobs:</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          We've detected that you're located in countries.SO. Only jobs that are available in countries.SO are shown
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-500 text-[9px] ml-1 opacity-70">i</span>
        </p>
      </header>

      {/* Tabs */}
      <div className="flex space-x-6 border-b border-gray-200 dark:border-gray-800 mb-6 overflow-x-auto scrollbar-hide">
        {[
          { id: "All", count: JOBS.length },
          { id: "Social Media", count: JOBS.filter(j => j.category === "Social Media").length },
          { id: "Other", count: JOBS.filter(j => j.category === "Other").length },
          { id: "Write an honest review", count: JOBS.filter(j => j.category === "Write an honest review").length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id !== "All") setCategoryFilter("all"); // Reset distinct category filter if tab is used
            }}
            className={`pb-3 text-sm font-semibold whitespace-nowrap border-b-2 flex items-center transition-colors ${ activeTab === tab.id ? "border-amber-500 text-white" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-200" }`}
          >
            {tab.id} <span className="ml-2 bg-amber-500 text-amber-950 px-1.5 py-0.5 rounded text-[10px]">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="relative">
          <label className="absolute -top-2 left-3 bg-gray-50 dark:bg-[#0b0c10] px-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start Date</label>
          <input 
            type="date" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-transparent border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500 text-gray-900 dark:text-white [color-scheme:dark]"
          />
        </div>
        <div className="relative">
          <label className="absolute -top-2 left-3 bg-gray-50 dark:bg-[#0b0c10] px-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">End Date</label>
          <input 
            type="date" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-transparent border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500 text-gray-900 dark:text-white [color-scheme:dark]"
          />
        </div>
        <div className="relative">
          <label className="absolute -top-2 left-3 bg-gray-50 dark:bg-[#0b0c10] px-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</label>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-transparent border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500 appearance-none text-gray-900 dark:text-white lg:min-w-[120px]"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative hidden lg:block">
          {/* We only show category filter if activeTab is "All" or if we want to allow cross filtering, but let's just make it available */}
          <label className="absolute -top-2 left-3 bg-gray-50 dark:bg-[#0b0c10] px-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</label>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-transparent border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500 appearance-none text-gray-900 dark:text-white lg:min-w-[120px]"
          >
            <option value="all">All</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative md:col-span-2 lg:col-span-1">
          <label className="absolute -top-2 left-3 z-10 bg-gray-50 dark:bg-[#0b0c10] px-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Search</label>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none z-10" />
          <input 
            type="text" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search..." 
            className="w-full bg-transparent border border-gray-200 dark:border-gray-800 rounded-lg pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-amber-500 text-gray-900 dark:text-white placeholder:text-gray-600 relative z-0"
          />
        </div>
      </div>

      <div className="lg:hidden mb-6 relative">
          <label className="absolute -top-2 left-3 bg-gray-50 dark:bg-[#0b0c10] px-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</label>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-transparent border border-gray-200 dark:border-gray-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-amber-500 appearance-none text-gray-900 dark:text-white"
          >
            <option value="all">All</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
      </div>

      {/* Tasks Grid */}
      {filteredJobs.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800">
          <p className="text-gray-500 dark:text-gray-400 text-sm">No jobs found matching your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pb-4">
          {filteredJobs.map((job, index) => (
            <motion.div 
              key={job.id} 
              onClick={() => navigate(`/tasks/${job.id}`)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="bg-white dark:bg-[#111218] border border-gray-200 dark:border-gray-800 rounded-2xl p-5 cursor-pointer shadow-sm hover:shadow-md dark:shadow-none dark:hover:shadow-[0_4px_20px_rgba(245,158,11,0.05)] dark:hover:border-amber-500/30 transition-all group flex flex-col"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest bg-gray-100 dark:bg-white/[0.03] px-2 py-1 rounded-md">{job.category}</span>
                <span className={`border px-2.5 py-0.5 rounded-full text-[10px] font-bold capitalize tracking-wide ${ job.status === 'active' ? 'border-emerald-200 dark:border-[#14532d] text-emerald-700 dark:text-[#4ade80] bg-emerald-50 dark:bg-[#052e16]' : job.status === 'completed' ? 'border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30' : job.status === 'canceled' ? 'border-red-200 dark:border-red-900 text-red-700 dark:text-red-500 bg-red-50 dark:bg-red-950/30' : '' }`}>
                  {job.status}
                </span>
              </div>
              
              <div className="flex items-start mb-4 flex-1">
                {job.pinned && <Pin className="w-4 h-4 text-amber-500 mr-2 mt-0.5 shrink-0 fill-amber-500" />}
                <h3 className="text-[15px] font-bold text-gray-900 dark:text-white leading-snug group-hover:text-amber-500 transition-colors line-clamp-2">{job.title}</h3>
              </div>
              
              <div className="mt-auto">
                <div className="flex justify-between items-center bg-gray-50 dark:bg-[#0b0c10] p-3 rounded-xl border border-gray-100 dark:border-gray-800/50 mb-4 group-hover:border-amber-500/20 transition-colors">
                  <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mb-0.5 uppercase tracking-wide">Reward</p>
                    <p className="text-lg font-black text-amber-600 dark:text-amber-500 leading-none">{job.pay}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mb-0.5 uppercase tracking-wide">Time</p>
                    <p className="text-[13px] font-bold text-gray-700 dark:text-gray-300 leading-none flex items-center justify-end"><CheckCircle2 className="w-3.5 h-3.5 mr-1 text-gray-400 dark:text-gray-500"/> {job.timeToComplete}</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-end">
                  <div className="flex flex-col flex-1 mr-4">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[11px] text-gray-600 dark:text-gray-400 font-medium">Available</span>
                      <span className="text-[11px] font-bold text-gray-900 dark:text-white">{job.available} <span className="text-gray-400 dark:text-gray-500 font-normal">/ {job.total}</span></span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: job.percentage }}></div>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium text-right shrink-0">
                    Created <br/>{job.created}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}


