"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { motion } from "framer-motion";
import { Crown, Medal } from "lucide-react";
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

const RANK_STYLES: Record<number, { glow: string; icon: React.ReactNode; text: string }> = {
  1: {
    glow: "from-amber-400/25",
    text: "text-amber",
    icon: <Crown className="w-4 h-4 text-amber" />,
  },
  2: {
    glow: "from-gold/20",
    text: "text-gold-lite",
    icon: <Medal className="w-4 h-4 text-gold-lite" />,
  },
  3: {
    glow: "from-gold-deep/25",
    text: "text-gold-lite",
    icon: <Medal className="w-4 h-4 text-gold-lite" />,
  },
};

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
      {/* Masthead */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 rise">
        <div>
          <LabelLux className="mb-1">Leaderboard</LabelLux>
          <h1 className="font-display text-[28px] font-semibold text-ivory">
            The Ranks
          </h1>
          <p className="mt-1 font-mono text-[10px] text-ash-dim uppercase tracking-wider">
            Live from on-chain user stats
          </p>
        </div>

        {/* Sort pills */}
        <div className="flex items-center gap-1 p-1 rounded-lg self-start" style={{ background: "var(--color-panel)", border: "1px solid var(--color-hairline)" }}>
          {[
            { key: "volume", label: "Volume" },
            { key: "profit", label: "Profit" },
            { key: "winRate", label: "Win Rate" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key as any)}
              className={`px-3 py-1.5 rounded font-mono text-[11px] font-medium tracking-wide transition-colors cursor-pointer ${
                sortBy === opt.key ? "bg-gold text-white" : "text-ash hover:text-ivory"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <Rule className="mb-8" />

      {/* Your rank banner */}
      {myStats && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface-feature p-5 mb-8 flex items-center justify-between"
        >
          <div className="flex items-baseline gap-4">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ash-dim">Your Rank</span>
            <span className="font-display text-[32px] font-bold text-gold-lite leading-none">
              #{myRankIndex + 1}
            </span>
            <span className="font-mono text-[13px] text-ivory">{shortAddr(myStats.wallet)}</span>
          </div>
          <div className="hidden sm:flex items-center gap-8 font-mono text-[12px] tnum">
            <span className="text-ash-dim">Volume <span className="text-ivory font-bold">{myStats.totalWagered.toFixed(2)} ◎</span></span>
            <span className="text-ash-dim">Win Rate <span className="text-gold-lite font-bold">{myStats.winRate !== null ? `${Math.round(myStats.winRate)}%` : "—"}</span></span>
            <span className="text-ash-dim">PnL <span className={`font-bold ${myStats.totalProfit >= 0 ? "text-verdigris" : "text-bordeaux"}`}>{myStats.totalProfit >= 0 ? "+" : ""}{myStats.totalProfit.toFixed(2)} ◎</span></span>
          </div>
        </motion.div>
      )}

      {/* Table */}
      {loading ? (
        <LoadingState title="Loading leaderboard..." />
      ) : error ? (
        <EmptyState title="Error Loading Leaderboard" description={error} />
      ) : traders.length === 0 ? (
        <EmptyState title="No Leaderboard Data" description="Be the first to trade and take the crown!" />
      ) : (
        <>
          <div className="hidden md:grid grid-cols-12 items-center gap-4 px-4 py-2 mb-2 border border-hairline border-b-0 rounded-t bg-obsidian/60">
            <span className="col-span-1 label-lux">#</span>
            <span className="col-span-5 label-lux">Trader</span>
            <span className="col-span-2 label-lux text-right">Volume</span>
            <span className="col-span-2 label-lux text-right">PnL</span>
            <span className="col-span-2 label-lux text-right">Win / Markets</span>
          </div>
          <div className="board">
            {traders.map((t, idx) => {
              const isMe = myAddress === t.wallet;
              const style = RANK_STYLES[idx + 1];
              const pnl = t.totalProfit;
              return (
                <motion.div
                  key={t.wallet}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.35) }}
                  className={`board-row group w-full grid grid-cols-12 items-center gap-4 px-4 py-4 edge-glow ${
                    isMe ? "!border-gold/50 bg-gold/[0.04]" : ""
                  }`}
                >
                  {/* Rank */}
                  <span className="col-span-2 md:col-span-1 flex items-center gap-2">
                    {style?.icon}
                    <span className={`font-display font-bold text-[26px] leading-none tnum ${style?.text ?? "text-ash-dim"} group-hover:text-gold-lite transition-colors`}>
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                  </span>
                  {/* Trader */}
                  <span className="col-span-10 md:col-span-5 min-w-0 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.avatarUrl}
                      alt=""
                      width={30}
                      height={30}
                      className="w-[30px] h-[30px] rounded-full border border-hairline shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block font-mono text-[13px] text-ivory truncate group-hover:text-gold-lite transition-colors">
                        {t.username || shortAddr(t.wallet)}
                      </span>
                      {isMe && <span className="label-lux mt-0.5 block !text-gold-lite">You</span>}
                    </span>
                  </span>
                  {/* Volume */}
                  <span className="hidden md:block col-span-2 font-mono tnum text-[13px] text-ash text-right">
                    {t.totalWagered.toFixed(2)} ◎
                  </span>
                  {/* PnL */}
                  <span className={`col-span-6 md:col-span-2 font-mono tnum text-[14px] font-bold text-right ${
                    pnl > 0 ? "text-verdigris" : pnl < 0 ? "text-bordeaux" : "text-ash"
                  }`}>
                    {pnl > 0 ? `+${pnl.toFixed(2)}` : pnl.toFixed(2)}
                  </span>
                  {/* Win rate */}
                  <span className="col-span-4 md:col-span-2 hidden md:flex flex-col items-end font-mono text-[11px] tnum text-ash-dim">
                    <span className={t.winRate !== null && t.winRate >= 50 ? "text-verdigris" : ""}>
                      {t.winRate !== null ? `${Math.round(t.winRate)}%` : "—"}
                    </span>
                    <span>{t.marketsTraded} markets</span>
                  </span>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}

export default LeaderboardPage;
