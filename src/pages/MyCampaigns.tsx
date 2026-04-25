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
      <header className="flex items-center justify-between border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Campaigns</h1>
          <p className="text-gray-500 text-sm">Manage your tasks and review worker submissions.</p>
        </div>
        <Link to="/tasks/create" className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
          New Campaign
        </Link>
      </header>

      <div className="grid gap-4">
        {campaigns.map(camp => (
          <div key={camp.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{camp.title}</h3>
                <div className="flex items-center space-x-3 mt-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${camp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {camp.status}
                  </span>
                  <span className="text-xs text-gray-500 font-medium">Reward: ${camp.reward}</span>
                </div>
              </div>
              <button 
                onClick={() => navigate(`/campaigns/${camp.id}/review`)}
                className="flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors"
              >
                <span>Review</span>
                {camp.pending > 0 && <span className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-[10px] ml-1">{camp.pending}</span>}
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-gray-50 pt-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Slots Filled</p>
                  <p className="text-sm font-bold text-gray-900">{camp.filled} / {camp.slots}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold">Pending Review</p>
                  <p className="text-sm font-bold text-gray-900">{camp.pending} users</p>
                </div>
              </div>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && (
          <div className="text-center py-10">
            <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">You haven't created any campaigns yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
