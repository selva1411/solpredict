"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Users, TrendingUp, Activity, MessageCircle, UserPlus } from "lucide-react";

export default function ProfilePage() {
  const params = useParams();
  const wallet = params.wallet as string;

  const [activeTab, setActiveTab] = useState("positions");

  const stats = [
    { label: "Total Volume", value: "1,234 SOL" },
    { label: "Win Rate", value: "67%" },
    { label: "Followers", value: "42" },
    { label: "Following", value: "18" },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="holo-card p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7B3FE4] to-[#FF3D9A] flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-2xl">{wallet.slice(0, 2)}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F5FA]">
                @{wallet.slice(0, 8)}
              </h1>
              <span className="text-xs text-[#A5A8B8] bg-white/5 px-2 py-0.5 rounded-full">
                {wallet.slice(0, 4)}...{wallet.slice(-4)}
              </span>
            </div>
            <p className="text-[#A5A8B8] mb-3">Prediction market enthusiast · SOL believer</p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-sm text-[#00E5FF] hover:underline flex items-center gap-1">
                <MessageCircle className="w-4 h-4" /> @trader
              </a>
              <button className="bg-[#7B3FE4] hover:bg-[#6A2FD4] text-white text-xs px-4 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                <UserPlus className="w-3.5 h-3.5" /> Follow
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-display text-lg font-bold text-gradient">{s.value}</p>
                <p className="text-xs text-[#A5A8B8]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-white/5">
        {["positions", "activity", "markets", "followers", "following"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium capitalize transition-all border-b-2 -mb-[1px] ${
              activeTab === tab
                ? "text-[#00E5FF] border-[#00E5FF]"
                : "text-[#A5A8B8] border-transparent hover:text-[#F4F5FA]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="holo-card p-6">
        {activeTab === "positions" && (
          <div>
            <h3 className="font-display text-lg font-bold text-[#F4F5FA] mb-4">Open Positions</h3>
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-[#A5A8B8] uppercase tracking-wider border-b border-white/5">
                  <th className="pb-3 pr-4">Market</th>
                  <th className="pb-3 pr-4">Side</th>
                  <th className="pb-3 pr-4 text-right">Entry</th>
                  <th className="pb-3 pr-4 text-right">Current</th>
                  <th className="pb-3 pr-4 text-right">P&L</th>
                </tr>
              </thead>
              <tbody className="text-sm text-[#F4F5FA]">
                <tr className="border-b border-white/5">
                  <td className="py-4 pr-4">SOL &gt; $250 EOY</td>
                  <td className="py-4 pr-4">
                    <span className="text-[#C8FF00] text-xs font-bold">YES</span>
                  </td>
                  <td className="py-4 pr-4 text-right font-mono text-[#A5A8B8]">0.64</td>
                  <td className="py-4 pr-4 text-right font-mono text-[#A5A8B8]">0.72</td>
                  <td className="py-4 pr-4 text-right font-mono text-[#C8FF00]">+0.08</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {activeTab === "activity" && (
          <p className="text-[#A5A8B8] text-center py-8">Activity feed coming soon</p>
        )}
        {activeTab === "markets" && (
          <p className="text-[#A5A8B8] text-center py-8">Markets created coming soon</p>
        )}
        {activeTab === "followers" && (
          <p className="text-[#A5A8B8] text-center py-8">Followers coming soon</p>
        )}
        {activeTab === "following" && (
          <p className="text-[#A5A8B8] text-center py-8">Following coming soon</p>
        )}
      </div>
    </main>
  );
}
