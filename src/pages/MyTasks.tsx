import React, { useState } from "react";
import { Search, ChevronDown, Pin, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const JOBS = [
  { id: 1, category: "Other", title: "YouTube channel: SUBSCRIBE+ Comment+ like", pay: "$0.05", location: "All", completedOn: "Apr 19 2026", pending: 0, available: 200, total: 200, percentage: "100.0%", status: "Approved" },
  { id: 2, category: "SEO & Web Traffic", title: "Youtube Search + 1 Min Watch", pay: "$0.07", location: "All", completedOn: "Apr 19 2026", pending: 8, available: 495, total: 495, percentage: "100.0%", status: "Approved" },
  { id: 3, category: "Social Media", title: "github star", pay: "$0.25", location: "All", completedOn: "Apr 14 2026", pending: 0, available: 100, total: 100, percentage: "100.0%", status: "Approved" },
  { id: 4, category: "Offer/Sign up", title: "Simple Sign Up only", pay: "$0.05", location: "All", completedOn: "Apr 14 2026", pending: 131, available: 496, total: 590, percentage: "84.07%", status: "Approved" },
  { id: 5, category: "Social Media", title: "github star", pay: "$0.20", location: "All", completedOn: "Apr 12 2026", pending: 0, available: 150, total: 150, percentage: "100.0%", status: "Approved" },
  { id: 6, category: "Social Media", title: "A nice comment and a subscription to the channel! youtube", pay: "$0.05", location: "All", completedOn: "Apr 10 2026", pending: 0, available: 175, total: 175, percentage: "100.0%", status: "Approved" },
  { id: 7, category: "Social Media", title: "github star", pay: "$0.20", location: "All", completedOn: "Apr 10 2026", pending: 0, available: 155, total: 380, percentage: "40.79%", status: "Approved" },
  { id: 8, category: "Questions, Answers & Comments", title: "Leave a short positive hemilin.nl (5★) review about an online casino on Trustpilot.", pay: "$0.25", location: "All", completedOn: "Apr 11 2026", pending: 0, available: 0, total: 25, percentage: "0.0%", status: "Rejected" },
  { id: 9, category: "Social Media", title: "Twitter (X): Follow an account", pay: "$0.05", location: "All", completedOn: "Apr 09 2026", pending: 0, available: 110, total: 110, percentage: "100.0%", status: "Approved" },
];

export function MyTasks() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("All");

  return (
    <div className="bg-gray-50 dark:bg-[#0b0c10] min-h-screen text-gray-700 dark:text-gray-300 pb-20 -m-4 sm:-m-6 md:-m-8 p-4 sm:p-6 md:p-8 font-sans">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Your Completed Jobs</h1>
      </header>

      {/* Tabs */}
      <div className="flex space-x-6 border-b border-gray-200 dark:border-gray-800 mb-6 overflow-x-auto scrollbar-hide">
        {[
          { id: "All", count: 20 },
          { id: "Social Media", count: 14 },
          { id: "App Install", count: 0 },
          { id: "Survey", count: 0 },
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

      {/* Filters */}
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
            <div>Job Title</div>
            <div>Pay</div>
            <div>Location</div>
            <div>Completed On</div>
            <div className="text-center">Pending Approval</div>
            <div className="text-right">Availability</div>
            <div className="text-right">Approval Status</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-800/60">
            {JOBS.map((job) => (
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
                  {job.status === "Approved" ? (
                    <span className="border border-[#14532d] text-[#4ade80] bg-[#052e16] px-2 py-0.5 rounded text-[10px] font-bold capitalize tracking-wider">
                      Approved
                    </span>
                  ) : job.status === "Rejected" ? (
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

