import React, { useState } from "react";
import { Megaphone, Users, Clock, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

export function MyCampaigns() {
  const navigate = useNavigate();

  // Mock data for advertiser's campaigns
  const campaigns = [
    { id: 1, title: "Join Telegram Crypto Group", reward: 0.15, slots: 500, filled: 450, pending: 12, status: "active" },
    { id: 2, title: "Follow Twitter Account", reward: 0.10, slots: 1000, filled: 1000, pending: 0, status: "completed" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Campaigns</h1>
          <p className="text-gray-400 text-sm">Manage your tasks and review worker submissions.</p>
        </div>
        <Link to="/tasks/create" className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-semibold hover:bg-amber-600 transition-colors">
          New Campaign
        </Link>
      </header>

      <div className="grid gap-4">
        {campaigns.map(camp => (
          <div key={camp.id} className="bg-[#111218] rounded-2xl border border-gray-800 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{camp.title}</h3>
                <div className="flex items-center space-x-3 mt-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${camp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-800 text-gray-400'}`}>
                    {camp.status}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">Reward: ${camp.reward}</span>
                </div>
              </div>
              <button 
                onClick={() => navigate(`/campaigns/${camp.id}/review`)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-amber-500/10 text-amber-400 rounded-lg text-sm font-semibold hover:bg-amber-500/20 transition-colors"
              >
                <span>Review</span>
                {camp.pending > 0 && <span className="w-5 h-5 bg-amber-500 text-white rounded-full flex items-center justify-center text-[10px] ml-1">{camp.pending}</span>}
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-gray-800 pt-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">Slots Filled</p>
                  <p className="text-sm font-bold text-white">{camp.filled} / {camp.slots}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">Pending Review</p>
                  <p className="text-sm font-bold text-white">{camp.pending} users</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && (
          <div className="text-center py-10">
            <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400">You haven't created any campaigns yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
