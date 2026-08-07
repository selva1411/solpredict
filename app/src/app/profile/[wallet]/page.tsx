"use client";

import React, { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { keys } from "@/lib/api/keys";
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

interface ActivityEntry {
  signature: string;
  marketPubkey: string;
  trader: string;
  side: string;
  lamportsIn: string;
  tokensOut: string;
  blockTime: string;
  question: string;
}

export default function ProfilePage() {
  const params = useParams();
  const wallet = params.wallet as string;

  const [activeTab, setActiveTab] = useState("positions");

  const profileQuery = useQuery({
    queryKey: keys.user.profile(wallet ?? "none"),
    queryFn: async (): Promise<UserProfile | null> => {
      if (!wallet) return null;
      const r = await fetch(`/api/user/profile/${wallet}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return data?.ok ? (data.profile as UserProfile) : null;
    },
    enabled: !!wallet,
    staleTime: 30_000,
  });

  const positionsQuery = useQuery({
    queryKey: keys.user.positions(wallet ?? "none"),
    queryFn: async (): Promise<Position[]> => {
      if (!wallet) return [];
      const r = await fetch(`/api/user/positions?wallet=${wallet}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return data?.ok ? (data.positions as Position[]) : [];
    },
    enabled: !!wallet,
    staleTime: 30_000,
  });

  const activityQuery = useQuery({
    queryKey: ["activity", "recent", wallet ?? "none"],
    queryFn: async (): Promise<ActivityEntry[]> => {
      if (!wallet) return [];
      const r = await fetch(`/api/activity/recent?wallet=${wallet}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return data?.ok ? (data.activities as ActivityEntry[]) : [];
    },
    enabled: !!wallet,
    staleTime: 30_000,
  });

  const loading = profileQuery.isLoading || positionsQuery.isLoading || activityQuery.isLoading;

  const profile = profileQuery.data ?? null;
  const positions = positionsQuery.data ?? [];
  const activities = activityQuery.data ?? [];

  const shortAddr = wallet ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : "";
  const username = profile?.username || `@${shortAddr}`;
  const winRate = profile?.winRate ?? null;

  const stats = [
    { label: "Total Volume", value: profile?.totalWagered != null ? `${profile.totalWagered.toFixed(2)} SOL` : "\u2014" },
    { label: "Markets Traded", value: profile?.marketsTraded != null ? String(profile.marketsTraded) : (positions.length ? String(positions.length) : "\u2014") },
    { label: "Win Rate", value: winRate != null ? `${(winRate * 100).toFixed(0)}%` : "\u2014" },
    { label: "PAS Score", value: profile?.pasScore != null ? String(profile.pasScore) : "\u2014" },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="holo-card p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#FFA500] to-[#D48800] p-0.5 flex-shrink-0">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt={username} className="w-full h-full rounded-full object-cover" />
            ) : (
              <div className="w-full h-full rounded-full bg-[#1A1C22] flex items-center justify-center font-bold text-2xl text-[#FFA500]">
                {wallet.slice(0, 2)}
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F4F9]">
                {username}
              </h1>
              <span className="text-xs text-[#808495] bg-white/5 px-2 py-0.5 rounded-full font-mono">
                {shortAddr}
              </span>
            </div>
            <p className="text-[#808495] mb-3 text-sm">{profile?.bio || "Solana Prediction Market Trader"}</p>
            {profile?.twitterHandle && (
              <a href={`https://twitter.com/${profile.twitterHandle}`} target="_blank" rel="noreferrer" className="text-xs text-[#FFA500] hover:underline flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" /> @{profile.twitterHandle}
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full sm:w-auto">
            {stats.map((s) => (
              <div key={s.label} className="text-center p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="font-display text-lg font-bold text-gradient">{s.value}</p>
                <p className="text-[10px] text-[#808495] uppercase font-mono">{s.label}</p>
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
                ? "text-[#FFA500] border-[#FFA500]"
                : "text-[#808495] border-transparent hover:text-[#F4F4F9]"
            }`}
          >
            {tab} ({tab === "positions" ? positions.length : activities.length})
          </button>
        ))}
      </div>

      <div className="holo-card p-6">
        {loading ? (
          <div className="py-12 text-center text-[#808495] animate-pulse">Loading profile data...</div>
        ) : activeTab === "positions" ? (
          positions.length === 0 ? (
            <div className="py-12 text-center text-[#808495]">No active positions found for this trader.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-[#808495] uppercase tracking-wider border-b border-white/5">
                    <th className="pb-3 pr-4">Market</th>
                    <th className="pb-3 pr-4">Side</th>
                    <th className="pb-3 pr-4 text-right">Shares</th>
                    <th className="pb-3 pr-4 text-right">Avg Price</th>
                    <th className="pb-3 pr-4 text-right">Current Value</th>
                    <th className="pb-3 pr-4 text-right">P&L</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-[#F4F4F9] font-mono">
                  {positions.map((p, i) => (
                    <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-4 pr-4 font-sans font-medium text-xs max-w-xs truncate">
                        <Link href={`/market/${p.marketPubkey}`} className="hover:text-[#FFA500]">
                          {p.question}
                        </Link>
                      </td>
                      <td className="py-4 pr-4">
                        <span className={p.side === "YES" ? "text-[#4CAF50] font-bold text-xs" : "text-[#E4574A] font-bold text-xs"}>
                          {p.side}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-right text-xs">{p.shares.toFixed(2)}</td>
                      <td className="py-4 pr-4 text-right text-xs">{p.avgPriceSol.toFixed(2)} SOL</td>
                      <td className="py-4 pr-4 text-right text-xs">{p.valueSol.toFixed(2)} SOL</td>
                      <td className={`py-4 pr-4 text-right text-xs font-bold ${p.pnlSol >= 0 ? 'text-[#4CAF50]' : 'text-[#E4574A]'}`}>
                        {p.pnlSol >= 0 ? '+' : ''}{p.pnlSol.toFixed(3)} SOL ({p.pnlPercent.toFixed(1)}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : activities.length === 0 ? (
          <div className="py-12 text-center text-[#808495]">No trade activity recorded for this trader yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-[#808495] uppercase tracking-wider border-b border-white/5">
                  <th className="pb-3 pr-4">Market</th>
                  <th className="pb-3 pr-4">Side</th>
                  <th className="pb-3 pr-4 text-right">Amount</th>
                  <th className="pb-3 pr-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="text-sm text-[#F4F4F9] font-mono">
                {activities.map((a, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-4 pr-4 font-sans font-medium text-xs max-w-xs truncate">
                      <Link href={`/market/${a.marketPubkey}`} className="hover:text-[#FFA500]">
                        {a.question}
                      </Link>
                    </td>
                    <td className="py-4 pr-4">
                      <span className={String(a.side).toUpperCase() === "YES" ? "text-[#4CAF50] font-bold text-xs" : "text-[#E4574A] font-bold text-xs"}>
                        {String(a.side).toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-right text-xs">
                      {((Number(a.lamportsIn) || 0) / 1e9).toFixed(3)} SOL
                    </td>
                    <td className="py-4 pr-4 text-right text-xs text-[#808495]">
                      {a.blockTime ? new Date(Number(a.blockTime) * 1000).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
