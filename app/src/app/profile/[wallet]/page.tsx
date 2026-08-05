"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { Users, TrendingUp, Activity, MessageCircle, UserPlus, Award, CheckCircle, AlertTriangle } from "lucide-react";
import Link from "next/link";

interface UserProfile {
  wallet: string;
  username?: string;
  avatarUrl?: string;
  bio?: string;
  twitterHandle?: string;
  totalWagered: number;
  totalWon: number;
  totalProfit: number;
  marketsTraded: number;
  winRate: number;
  pasScore: number;
  createdAt?: string;
}

interface Position {
  marketPubkey: string;
  question: string;
  side: "YES" | "NO";
  shares: number;
  avgPriceSol: number;
  currentPriceSol: number;
  valueSol: number;
  pnlSol: number;
  pnlPercent: number;
}

export default function ProfilePage() {
  const params = useParams();
  const wallet = params.wallet as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("positions");

  useEffect(() => {
    if (!wallet) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/user/profile/${wallet}`).then(r => r.json()).catch(() => null),
      fetch(`/api/user/positions?wallet=${wallet}`).then(r => r.json()).catch(() => null),
    ]).then(([profileRes, posRes]) => {
      if (profileRes?.ok && profileRes.profile) {
        setProfile(profileRes.profile);
      }
      if (posRes?.ok && posRes.positions) {
        setPositions(posRes.positions);
      }
    }).finally(() => setLoading(false));
  }, [wallet]);

  const shortAddr = wallet ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : "";
  const username = profile?.username || `@${shortAddr}`;
  const totalWagered = profile?.totalWagered ?? positions.reduce((acc, p) => acc + (p.shares * p.avgPriceSol), 0);
  const winRate = profile?.winRate ?? 0;

  const stats = [
    { label: "Total Volume", value: `${totalWagered.toFixed(2)} SOL` },
    { label: "Markets Traded", value: profile?.marketsTraded || positions.length },
    { label: "Win Rate", value: `${(winRate * 100).toFixed(0)}%` },
    { label: "PAS Score", value: profile?.pasScore || 50 },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="holo-card p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7B3FE4] to-[#FF3D9A] p-0.5 flex-shrink-0">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt={username} className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full bg-[#0A0B12] flex items-center justify-center font-bold text-2xl text-[#00E5FF]">
                {wallet.slice(0, 2)}
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F5FA]">
                {username}
              </h1>
              <span className="text-xs text-[#A5A8B8] bg-white/5 px-2 py-0.5 rounded-full font-mono">
                {shortAddr}
              </span>
            </div>
            <p className="text-[#A5A8B8] mb-3 text-sm">{profile?.bio || "Solana Prediction Market Trader"}</p>
            {profile?.twitterHandle && (
              <a href={`https://twitter.com/${profile.twitterHandle}`} target="_blank" rel="noreferrer" className="text-xs text-[#00E5FF] hover:underline flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" /> @{profile.twitterHandle}
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full sm:w-auto">
            {stats.map((s) => (
              <div key={s.label} className="text-center p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="font-display text-lg font-bold text-gradient">{s.value}</p>
                <p className="text-[10px] text-[#A5A8B8] uppercase font-mono">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-white/5">
        {["positions", "activity"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-[1px] ${
              activeTab === tab
                ? "text-[#00E5FF] border-[#00E5FF]"
                : "text-[#A5A8B8] border-transparent hover:text-[#F4F5FA]"
            }`}
          >
            {tab} ({tab === "positions" ? positions.length : 0})
          </button>
        ))}
      </div>

      <div className="holo-card p-6">
        {loading ? (
          <div className="py-12 text-center text-[#A5A8B8] animate-pulse">Loading profile data...</div>
        ) : activeTab === "positions" ? (
          positions.length === 0 ? (
            <div className="py-12 text-center text-[#A5A8B8]">No active positions found for this trader.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-[#A5A8B8] uppercase tracking-wider border-b border-white/5">
                    <th className="pb-3 pr-4">Market</th>
                    <th className="pb-3 pr-4">Side</th>
                    <th className="pb-3 pr-4 text-right">Shares</th>
                    <th className="pb-3 pr-4 text-right">Avg Price</th>
                    <th className="pb-3 pr-4 text-right">Current Value</th>
                    <th className="pb-3 pr-4 text-right">P&L</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-[#F4F5FA] font-mono">
                  {positions.map((p, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 pr-4 font-sans font-medium text-xs max-w-xs truncate">
                        <Link href={`/market/${p.marketPubkey}`} className="hover:text-[#00E5FF]">
                          {p.question}
                        </Link>
                      </td>
                      <td className="py-4 pr-4">
                        <span className={p.side === "YES" ? "text-[#C8FF00] font-bold text-xs" : "text-[#FF4D6D] font-bold text-xs"}>
                          {p.side}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-right text-xs">{p.shares.toFixed(2)}</td>
                      <td className="py-4 pr-4 text-right text-xs">{p.avgPriceSol.toFixed(2)} SOL</td>
                      <td className="py-4 pr-4 text-right text-xs">{p.valueSol.toFixed(2)} SOL</td>
                      <td className={`py-4 pr-4 text-right text-xs font-bold ${p.pnlSol >= 0 ? 'text-[#C8FF00]' : 'text-[#FF4D6D]'}`}>
                        {p.pnlSol >= 0 ? '+' : ''}{p.pnlSol.toFixed(3)} SOL ({p.pnlPercent.toFixed(1)}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="py-12 text-center text-[#A5A8B8]">Activity feed updated via on-chain listener.</div>
        )}
      </div>
    </main>
  );
}
