"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Crown, Filter } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { EmptyState, LoadingState } from "@/components/StatePanels";

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

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="w-8 h-8 rounded-lg bg-[var(--warning)]/20 border border-[var(--warning)]/40 flex items-center justify-center">
        <Crown className="w-4 h-4 text-[var(--warning)]" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="w-8 h-8 rounded-lg bg-[var(--surface-1)] border border-[var(--color-gray-700)] flex items-center justify-center">
        <Medal className="w-4 h-4 text-[var(--color-gray-300)]" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 border border-[var(--accent)]/30 flex items-center justify-center">
        <Medal className="w-4 h-4 text-[var(--accent)]" />
      </div>
    );
  return (
    <div className="w-8 h-8 rounded-lg bg-[var(--surface-1)] border border-[var(--color-gray-800)] flex items-center justify-center text-[var(--color-gray-400)] text-xs font-mono font-bold">
      {rank}
    </div>
  );
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

  useEffect(() => {
    fetchLeaderboard();
  }, [sortBy]);

  const myAddress = wallet.publicKey?.toBase58();
  const myRankIndex = myAddress ? traders.findIndex((t) => t.wallet === myAddress) : -1;
  const myStats = myRankIndex >= 0 ? traders[myRankIndex] : null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-3 text-[var(--color-gray-100)]">
            <Trophy className="w-8 h-8 text-[var(--warning)]" />
            Trader Leaderboard
          </h1>
          <p className="text-xs font-mono text-[var(--color-gray-400)]">
            Official rankings calculated directly from indexed user_stats
          </p>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <Filter size={14} className="text-[var(--color-gray-400)]" />
          {[
            { key: "volume", label: "By Volume" },
            { key: "profit", label: "By Profit" },
            { key: "winRate", label: "By Win Rate" },
          ].map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSortBy(opt.key as any)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                sortBy === opt.key
                  ? "bg-[var(--accent)] text-[#0B0C0F]"
                  : "bg-[var(--surface-1)] text-[var(--color-gray-400)] border border-[var(--color-gray-800)] hover:text-[var(--color-gray-100)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Connected User Badge */}
      {myStats && (
        <div className="terminal-card p-4 flex items-center justify-between border-[var(--accent)]/40 bg-[var(--accent)]/5">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono uppercase text-[var(--color-gray-400)]">Your Rank</span>
            <span className="font-mono text-xl font-bold text-[var(--accent)]">#{myRankIndex + 1}</span>
            <span className="text-sm font-mono text-[var(--color-gray-200)]">{shortAddr(myStats.wallet)}</span>
          </div>
          <div className="flex items-center gap-6 font-mono text-xs">
            <div>
              <span className="text-[var(--color-gray-400)]">Volume: </span>
              <span className="font-bold text-[var(--color-gray-100)]">{myStats.totalWagered.toFixed(2)} SOL</span>
            </div>
            <div>
              <span className="text-[var(--color-gray-400)]">Win Rate: </span>
              <span className="font-bold text-[var(--accent)]">
                {myStats.winRate !== null ? `${Math.round(myStats.winRate)}%` : "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      {loading ? (
        <LoadingState title="Loading leaderboard..." />
      ) : error ? (
        <EmptyState title="Error Loading Leaderboard" description={error} />
      ) : traders.length === 0 ? (
        <EmptyState title="No Leaderboard Data" description="Be the first to trade on devnet and take the lead!" />
      ) : (
        <div className="terminal-card overflow-hidden">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[var(--surface-0)] text-[var(--color-gray-400)] border-b border-[var(--color-gray-800)] uppercase">
              <tr>
                <th className="p-3 w-16 text-center">Rank</th>
                <th className="p-3">Trader</th>
                <th className="p-3 text-right">Volume (SOL)</th>
                <th className="p-3 text-right">Realized PnL</th>
                <th className="p-3 text-right">Win Rate</th>
                <th className="p-3 text-right">Markets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-gray-800)]">
              <AnimatePresence mode="popLayout">
                {traders.map((t, idx) => {
                  const isMe = myAddress === t.wallet;
                  return (
                    <motion.tr
                      key={t.wallet}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`hover:bg-[var(--color-gray-800)]/50 transition-colors ${
                        isMe ? "bg-[var(--accent)]/10" : ""
                      }`}
                    >
                      <td className="p-3 text-center">
                        <div className="flex justify-center">
                          <RankBadge rank={idx + 1} />
                        </div>
                      </td>
                      <td className="p-3 font-bold text-[var(--color-gray-100)]">
                        <div className="flex items-center gap-2">
                          <span>{t.username || shortAddr(t.wallet)}</span>
                          {isMe && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)]">
                              YOU
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right font-semibold text-[var(--color-gray-100)]">
                        {t.totalWagered.toFixed(2)}
                      </td>
                      <td
                        className={`p-3 text-right font-semibold ${
                          t.totalProfit > 0
                            ? "text-[var(--accent)]"
                            : t.totalProfit < 0
                            ? "text-[var(--negative)]"
                            : "text-[var(--color-gray-400)]"
                        }`}
                      >
                        {t.totalProfit > 0 ? `+${t.totalProfit.toFixed(2)}` : t.totalProfit.toFixed(2)}
                      </td>
                      <td className="p-3 text-right text-[var(--color-gray-200)]">
                        {t.winRate !== null ? `${Math.round(t.winRate)}%` : "—"}
                      </td>
                      <td className="p-3 text-right text-[var(--color-gray-400)]">
                        {t.marketsTraded}
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

const Leaderboard = dynamic(() => Promise.resolve(LeaderboardPage), { ssr: false });
export default Leaderboard;
