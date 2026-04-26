import React, { useState } from "react";
import { Search, Filter, ChevronDown, Pin, ChevronRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const JOBS = [
  { id: 1, category: "Other", title: "reddit rep post and user. 1 minutes to do", pinned: true, pay: "$0.05", location: "All", timeToComplete: "20 minutes", created: "04/24/26", pending: 15, available: 96, total: 239, percentage: "40.17%" },
  { id: 2, category: "Offer/Sign up", title: "Simple Sign Up only", pinned: true, pay: "$0.05", location: "All", timeToComplete: "1 minutes", created: "04/13/26", pending: 131, available: 496, total: 590, percentage: "84.07%" },
  { id: 3, category: "Social Media", title: "Download, fast payment", pinned: true, pay: "$0.08", location: "All", timeToComplete: "1 minutes", created: "04/02/26", pending: 4, available: 6, total: 15, percentage: "40.0%" },
  { id: 4, category: "Other", title: "Visit Website (Fast Approval)", pinned: true, pay: "$0.05", location: "All", timeToComplete: "2 minutes", created: "03/31/26", pending: 7, available: 48, total: 500, percentage: "9.6%" },
  { id: 5, category: "Social Media", title: "A task valid for both new and existing users.", pinned: false, pay: "$0.15", location: "All", timeToComplete: "1 minutes", created: "04/26/26", pending: 1, available: 1, total: 10, percentage: "10.0%" },
  { id: 6, category: "Write an honest review", title: "5 Star Trustpilot", pinned: false, pay: "$0.05", location: "All", timeToComplete: "1 minutes", created: "04/26/26", pending: 0, available: 0, total: 9, percentage: "0%" },
  { id: 7, category: "Write an honest review", title: "Trustpilot Review", pinned: false, pay: "$0.05", location: "All", timeToComplete: "1 minutes", created: "04/26/26", pending: 1, available: 1, total: 6, percentage: "16.67%" },
  { id: 8, category: "Social Media", title: "comment on reddit post ( 1 min )", pinned: false, pay: "$0.20", location: "All", timeToComplete: "1 minutes", created: "04/26/26", pending: 20, available: 20, total: 120, percentage: "16.67%" },
];

export function Tasks() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("All");

  return (
    <div className="bg-[#0b0c10] min-h-screen text-gray-300 pb-20 -m-4 sm:-m-6 md:-m-8 p-4 sm:p-6 md:p-8 font-sans">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Explore Available Jobs:</h1>
        <p className="text-sm text-gray-400">
          We've detected that you're located in countries.SO. Only jobs that are available in countries.SO are shown
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-gray-500 text-[9px] ml-1 opacity-70">i</span>
        </p>
      </header>

      {/* Tabs */}
      <div className="flex space-x-6 border-b border-gray-800 mb-6 overflow-x-auto scrollbar-hide">
        {[
          { id: "All", count: 4689 },
          { id: "Social Media", count: 1930 },
          { id: "App Install", count: 1 },
          { id: "Survey", count: 1 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 text-sm font-semibold whitespace-nowrap border-b-2 flex items-center transition-colors ${
              activeTab === tab.id
                ? "border-amber-500 text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.id} <span className="ml-2 bg-amber-500 text-amber-950 px-1.5 py-0.5 rounded text-[10px]">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-6">
        <input 
          type="text" 
          placeholder="Start date" 
          className="w-full bg-transparent border border-gray-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-gray-600 text-white placeholder:text-gray-600"
        />
        <input 
          type="text" 
          placeholder="End date" 
          className="w-full bg-transparent border border-gray-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-gray-600 text-white placeholder:text-gray-600"
        />
        <div className="relative">
          <label className="absolute -top-2 left-3 bg-[#0b0c10] px-1 text-[10px] font-semibold text-white uppercase tracking-wider">Status</label>
          <select className="w-full bg-transparent border border-gray-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-gray-600 appearance-none text-white">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          <input 
            type="text" 
            placeholder="Search titles and descriptions..." 
            className="w-full bg-transparent border border-gray-800 rounded-lg pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-gray-600 text-white placeholder:text-gray-600"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto -mx-4 sm:mx-0 pb-4">
        <div className="min-w-[800px] border-t border-gray-800 px-4 sm:px-0">
          {/* Table Header */}
          <div className="grid grid-cols-[1.5fr_3fr_1fr_1fr_1.5fr_1fr_1fr_1fr] gap-4 py-4 border-b border-gray-800 text-[11px] font-bold text-gray-400 capitalize tracking-wider">
            <div>Category</div>
            <div>Job Title</div>
            <div>Pay</div>
            <div>Location</div>
            <div>Time to Complete</div>
            <div className="text-center">Pending Approval</div>
            <div className="text-right">Availability</div>
            <div className="text-right flex items-center justify-end">Status <span className="ml-1">↑</span></div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-800/60">
            {JOBS.map((job) => (
              <div 
                key={job.id} 
                onClick={() => navigate(`/tasks/${job.id}`)}
                className="grid grid-cols-[1.5fr_3fr_1fr_1fr_1.5fr_1fr_1fr_1fr] gap-4 py-4 items-center hover:bg-white/[0.02] cursor-pointer transition-colors group"
              >
                <div className="text-xs text-gray-300 font-medium break-words leading-tight pr-2">{job.category}</div>
                <div className="text-[13px] text-gray-200 font-medium flex items-start truncate leading-snug">
                  {job.pinned && <Pin className="w-3 h-3 text-amber-500 mr-1.5 mt-0.5 shrink-0 fill-amber-500" />}
                  <span className="group-hover:text-amber-500 transition-colors line-clamp-2">{job.title}</span>
                </div>
                <div className="text-[13px] font-bold text-white">{job.pay}</div>
                <div className="text-[13px] text-gray-300">{job.location}</div>
                <div className="text-xs text-gray-300">
                  <div className="mb-0.5 font-medium">{job.timeToComplete}</div>
                  <div className="text-[#a46d3e] text-[10px]">Created <br/>{job.created}</div>
                </div>
                <div className="text-[13px] text-gray-300 text-center font-medium">{job.pending}</div>
                <div className="text-xs text-right whitespace-nowrap flex flex-col justify-center items-end">
                  <div className="text-gray-300 font-medium">{job.available} / {job.total}</div>
                  <div className="text-amber-500 font-bold">{job.percentage}</div>
                </div>
                <div className="flex justify-end">
                  <span className="border border-[#14532d] text-[#4ade80] bg-[#052e16] px-2 py-0.5 rounded text-[10px] font-bold capitalize tracking-wider">
                    Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

