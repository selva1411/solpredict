"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { keys } from "@/lib/api/keys";
export interface UserProfile {
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

export interface Position {
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

export interface ActivityEntry {
  signature: string;
  marketPubkey: string;
  trader: string;
  side: string;
  lamportsIn: string;
  tokensOut: string;
  blockTime: string;
  question: string;
}

export interface Achievement {
  key: string;
  title: string;
  desc: string;
  unlocked: boolean;
  progress: number;
}

export interface ProfileClientProps {
  wallet: string;
  initialProfile?: UserProfile | null;
  initialPositions?: Position[];
  initialActivities?: ActivityEntry[];
  initialAchievements?: Achievement[];
}

export default function ProfileClient({
  wallet,
  initialProfile,
  initialPositions,
  initialActivities,
  initialAchievements,
}: ProfileClientProps) {
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
    // Seeded from the server-rendered page so the first paint shows the real
    // profile without waiting on the API round trip. Refetches after staleTime.
    initialData: initialProfile ?? null,
    // Mark the prefetched data fresh from mount so the client first-paint
    // matches the server exactly (no hydration mismatch from an immediate
    // background refetch resolving before React hydrates).
    initialDataUpdatedAt: () => Date.now(),
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
    initialData: initialPositions ?? [],
    initialDataUpdatedAt: () => Date.now(),
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
    initialData: initialActivities ?? [],
    initialDataUpdatedAt: () => Date.now(),
  });

  const achievementsQuery = useQuery({
    queryKey: ["achievements", wallet ?? "none"],
    queryFn: async (): Promise<Achievement[]> => {
      if (!wallet) return [];
      const r = await fetch(`/api/user/achievements?wallet=${wallet}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return data?.ok ? (data.achievements as Achievement[]) : [];
    },
    enabled: !!wallet,
    staleTime: 30_000,
    initialData: initialAchievements ?? [],
    initialDataUpdatedAt: () => Date.now(),
  });

  const loading = profileQuery.isLoading || positionsQuery.isLoading || activityQuery.isLoading;

  const profile = profileQuery.data ?? null;
  const positions = positionsQuery.data ?? [];
  const activities = activityQuery.data ?? [];
  const achievements = achievementsQuery.data ?? [];
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const shortAddr = wallet ? `${wallet.slice(0, 4)}...${wallet.slice(-4)}` : "";
  const username = profile?.username || `@${shortAddr}`;
  const winRate = profile?.winRate ?? null;

  const stats = [
    { label: "Total Volume", value: profile?.totalWagered != null ? `${profile.totalWagered.toFixed(2)} SOL` : "\u2014" },
    { label: "Markets Traded", value: profile?.marketsTraded != null ? String(profile.marketsTraded) : (positions.length ? String(positions.length) : "\u2014") },
    { label: "Win Rate", value: winRate != null ? `${winRate.toFixed(0)}%` : "\u2014" },
    { label: "PAS Score", value: profile?.pasScore != null ? String(profile.pasScore) : "\u2014" },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="holo-card p-6 sm:p-8 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="w-20 h-20 rounded-[2px] bg-gradient-to-br from-gold to-gold-deep p-0.5 flex-shrink-0">
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt={username} className="w-full h-full rounded-[2px] object-cover" />
            ) : (
              <div className="w-full h-full rounded-[2px] bg-panel flex items-center justify-center font-bold text-2xl text-gold">
                {wallet.slice(0, 2)}
              </div>
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-ivory">
                {username}
              </h1>
              <span className="text-xs text-ash bg-panel-2 px-2 py-0.5 rounded-[2px] font-mono">
                {shortAddr}
              </span>
            </div>
            <p className="text-ash mb-3 text-[13px]">{profile?.bio || "Solana Prediction Market Trader"}</p>
            {profile?.twitterHandle && (
              <a href={`https://twitter.com/${profile.twitterHandle}`} target="_blank" rel="noreferrer" className="text-xs text-gold hover:underline flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" /> @{profile.twitterHandle}
              </a>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full sm:w-auto">
            {stats.map((s) => (
              <div key={s.label} className="text-center p-3 bg-panel-2 rounded-[2px] border border-hairline">
                <p className="font-display text-[21px] font-bold text-gradient">{s.value}</p>
                <p className="text-[10px] text-ash uppercase font-mono">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-hairline">
        {["positions", "activity", "achievements"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-[1px] ${
              activeTab === tab
                ? "text-gold border-gold"
                : "text-ash border-transparent hover:text-ivory"
            }`}
          >
            {tab} ({tab === "positions" ? positions.length : tab === "activity" ? activities.length : unlockedCount})
          </button>
        ))}
      </div>

      <div className="holo-card p-6">
        {loading ? (
          <div className="py-12 text-center text-ash animate-pulse">Loading profile data...</div>
        ) : activeTab === "positions" ? (
          positions.length === 0 ? (
            <div className="py-12 text-center text-ash">No active positions found for this trader.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-ash uppercase tracking-wider border-b border-hairline">
                    <th className="pb-3 pr-4">Market</th>
                    <th className="pb-3 pr-4">Side</th>
                    <th className="pb-3 pr-4 text-right">Shares</th>
                    <th className="pb-3 pr-4 text-right">Avg Price</th>
                    <th className="pb-3 pr-4 text-right">Current Value</th>
                    <th className="pb-3 pr-4 text-right">P&L</th>
                  </tr>
                </thead>
                <tbody className="text-[13px] text-ivory font-mono">
                  {positions.map((p, i) => (
                    <tr key={i} className="border-b border-hairline hover:bg-ivory/5 transition-colors">
                      <td className="py-4 pr-4 font-sans font-medium text-xs max-w-xs truncate">
                        <Link href={`/market/${p.marketPubkey}`} className="hover:text-gold">
                          {p.question}
                        </Link>
                      </td>
                      <td className="py-4 pr-4">
                        <span className={p.side === "YES" ? "text-verdigris font-bold text-xs" : "text-bordeaux font-bold text-xs"}>
                          {p.side}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-right text-xs">{p.shares.toFixed(2)}</td>
                      <td className="py-4 pr-4 text-right text-xs">{p.avgPriceSol.toFixed(2)} SOL</td>
                      <td className="py-4 pr-4 text-right text-xs">{p.valueSol.toFixed(2)} SOL</td>
                      <td className={`py-4 pr-4 text-right text-xs font-bold ${p.pnlSol >= 0 ? 'text-verdigris' : 'text-bordeaux'}`}>
                        {p.pnlSol >= 0 ? '+' : ''}{p.pnlSol.toFixed(3)} SOL ({p.pnlPercent.toFixed(1)}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : activeTab === "achievements" ? (
          achievements.length === 0 ? (
            <div className="py-12 text-center text-ash">No achievements available yet.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {achievements.map((a) => (
                <div
                  key={a.key}
                  className={`p-4 rounded-[2px] border transition-colors ${
                    a.unlocked
                      ? "border-gold/40 bg-gold/5"
                      : "border-hairline bg-panel opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[15px] ${a.unlocked ? "text-gold" : "text-ash-dim"}`}>
                      {a.unlocked ? "●" : "○"}
                    </span>
                    <div className="flex-1">
                      <div className="text-[13px] font-bold text-ivory">{a.title}</div>
                      <div className="text-[11px] text-ash leading-snug">{a.desc}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="h-1.5 bg-panel rounded-[2px] overflow-hidden">
                      <div
                        className={`h-full rounded-[2px] ${a.unlocked ? "bg-gold" : "bg-ash/50"}`}
                        style={{ width: `${Math.max(4, Math.min(100, a.progress))}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-ash mt-1 text-right font-mono">
                      {a.unlocked ? "UNLOCKED" : `${a.progress}%`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : activities.length === 0 ? (
          <div className="py-12 text-center text-ash">No trade activity recorded for this trader yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-ash uppercase tracking-wider border-b border-hairline">
                  <th className="pb-3 pr-4">Market</th>
                  <th className="pb-3 pr-4">Side</th>
                  <th className="pb-3 pr-4 text-right">Amount</th>
                  <th className="pb-3 pr-4 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="text-[13px] text-ivory font-mono">
                {activities.map((a, i) => (
                  <tr key={i} className="border-b border-hairline hover:bg-ivory/5 transition-colors">
                    <td className="py-4 pr-4 font-sans font-medium text-xs max-w-xs truncate">
                      <Link href={`/market/${a.marketPubkey}`} className="hover:text-gold">
                        {a.question}
                      </Link>
                    </td>
                    <td className="py-4 pr-4">
                      <span className={String(a.side).toUpperCase() === "YES" ? "text-verdigris font-bold text-xs" : "text-bordeaux font-bold text-xs"}>
                        {String(a.side).toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-right text-xs">
                      {((Number(a.lamportsIn) || 0) / 1e9).toFixed(3)} SOL
                    </td>
                    <td className="py-4 pr-4 text-right text-xs text-ash">
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
