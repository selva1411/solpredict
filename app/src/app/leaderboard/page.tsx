"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRealtime } from "@/hooks/useRealtime";
import { EmptyState, LoadingState } from "@/components/StatePanels";
import { LabelLux } from "@/components/ui/label-lux";
import { Rule } from "@/components/ui/rule";

interface LeaderboardItem {
  rank: number;
  wallet: string;
  username: string;
  avatarUrl: string;
  bio: string;
  totalWagered: number;
  totalProfit: number;
  winRate: number | null;
  winRateBps: number | null;
  marketsTraded: number;
  tradeCount: number;
  wins: number;
  losses: number;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function LeaderboardPage() {
  const wallet = useWallet();
  const [traders, setTraders] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"volume" | "profit" | "winRate">("volume");

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/leaderboard?sortBy=${sortBy}`);
      if (!res.ok) throw new Error("Failed to load leaderboard");
      const data = await res.json();
      if (data.ok && Array.isArray(data.leaderboard)) {
        setTraders(data.leaderboard);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const realtimeFetch = useCallback(() => {
    fetch(`/api/leaderboard?sortBy=${sortBy}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok && Array.isArray(data.leaderboard)) setTraders(data.leaderboard);
      })
      .catch(() => {});
  }, [sortBy]);

  const rt = useRealtime("leaderboard");
  useEffect(() => {
    const unsub = rt.on("update", () => realtimeFetch());
    return () => unsub?.();
  }, [rt, realtimeFetch]);

  useEffect(() => {
    fetchLeaderboard();
  }, [sortBy]);

  const myAddress = wallet.publicKey?.toBase58();
  const myRankIndex = myAddress ? traders.findIndex((t) => t.wallet === myAddress) : -1;
  const myStats = myRankIndex >= 0 ? traders[myRankIndex] : null;

  return (
    <main className="mx-auto w-full max-w-[1240px] px-6 py-14">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-10">
        <div>
          <LabelLux className="mb-2">Leaderboard</LabelLux>
          <h1 className="text-[44px] text-ivory">Trader Rankings</h1>
          <p className="mt-2 font-mono text-[10px] text-ash-dim uppercase tracking-[.16em]">
            Indexed from on-chain user_stats
          </p>
        </div>

        {/* Sort — mono text rows, gold underline active */}
        <div className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-[.16em]">
          <span className="text-ash-dim">Sort</span>
          {[
            { key: "volume", label: "Volume" },
            { key: "profit", label: "Profit" },
            { key: "winRate", label: "Win Rate" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key as any)}
              className={`cursor-pointer transition-colors ${
                sortBy === opt.key ? "text-gold-lite border-b border-gold" : "text-ash hover:text-ivory"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Rule className="mb-10" />

      {/* Connected User Badge */}
      {myStats && (
        <div className="surface p-4 mb-8 flex items-center justify-between border-l border-gold">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[.16em] text-ash-dim">Your Rank</span>
            <span className="font-display text-[34px] text-gold-lite leading-none">#{myRankIndex + 1}</span>
            <span className="font-mono text-[13px] text-ivory">{shortAddr(myStats.wallet)}</span>
          </div>
          <div className="hidden sm:flex items-center gap-8 font-mono text-[12px] tnum">
            <span className="text-ash-dim">Volume <span className="text-ivory">{myStats.totalWagered.toFixed(2)} SOL</span></span>
            <span className="text-ash-dim">Win Rate <span className="text-gold-lite">{myStats.winRate !== null ? `${Math.round(myStats.winRate)}%` : "—"}</span></span>
          </div>
        </div>
      )}

      {/* Leaderboard table */}
      {loading ? (
        <LoadingState title="Loading leaderboard..." />
      ) : error ? (
        <EmptyState title="Error Loading Leaderboard" description={error} />
      ) : traders.length === 0 ? (
        <EmptyState title="No Leaderboard Data" description="Be the first to trade on devnet and take the lead!" />
      ) : (
        <div className="divide-y divide-hairline border-t border-hairline">
          {traders.map((t, idx) => {
            const isMe = myAddress === t.wallet;
            const topThree = idx < 3;
            const pnl = t.totalProfit;
            return (
              <div
                key={t.wallet}
                className={`grid grid-cols-12 items-center gap-4 py-5 transition-colors hover:bg-panel px-3 -mx-3 ${
                  topThree ? "border-l border-gold pl-4 -ml-1" : ""
                } ${isMe ? "bg-gold/5" : ""}`}
              >
                {/* Rank — serif, gold-deep */}
                <span className="col-span-2 md:col-span-1 font-display text-[34px] leading-none text-gold-deep tnum">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                {/* Trader */}
                <span className="col-span-6 md:col-span-4 min-w-0">
                  <span className="block font-mono text-[13px] text-ivory truncate">
                    {t.username || shortAddr(t.wallet)}
                  </span>
                  {isMe && <span className="label-lux mt-0.5 block">You</span>}
                </span>
                {/* Volume */}
                <span className="col-span-2 md:col-span-2 font-mono tnum text-[13px] text-ash text-right">
                  {t.totalWagered.toFixed(2)}
                </span>
                {/* PnL */}
                <span className={`col-span-2 font-mono tnum text-[13px] text-right ${
                  pnl > 0 ? "text-verdigris" : pnl < 0 ? "text-bordeaux" : "text-ash"
                }`}>
                  {pnl > 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2)}
                </span>
                {/* Win Rate + Markets */}
                <span className="col-span-2 hidden md:flex flex-col items-end font-mono text-[11px] tnum text-ash-dim">
                  <span>{t.winRate !== null ? `${Math.round(t.winRate)}%` : "—"}</span>
                  <span>{t.marketsTraded} markets</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default LeaderboardPage;
