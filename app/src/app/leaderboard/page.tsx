"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useProgram } from "@/hooks/useProgram";
import { PublicKey } from "@solana/web3.js";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Crown, TrendingUp, Target, Users } from "lucide-react";
import * as anchor from "@coral-xyz/anchor";
import { CountUp } from "@/components/CountUp";
import { useWallet } from "@solana/wallet-adapter-react";

interface TraderStats {
  owner: string;
  totalVolumeSol: number;
  positionsCount: number;
  settledCount: number;
  winsCount: number;
  claimedCount: number;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="w-9 h-9 rounded-full bg-yellow-500/15 border border-yellow-500/40 flex items-center justify-center text-yellow-400">
        <Crown className="w-4 h-4" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="w-9 h-9 rounded-full bg-slate-300/15 border border-slate-300/40 flex items-center justify-center text-slate-300">
        <Medal className="w-4 h-4" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="w-9 h-9 rounded-full bg-amber-600/15 border border-amber-600/40 flex items-center justify-center text-amber-500">
        <Medal className="w-4 h-4" />
      </div>
    );
  return (
    <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-text-muted text-xs font-mono font-bold">
      {rank}
    </div>
  );
}

function LeaderboardPage() {
  const { program } = useProgram();
  const wallet = useWallet();
  const [traders, setTraders] = useState<TraderStats[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<"volume" | "wins" | "positions">("volume");

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const [allPositions, allMarkets] = await Promise.all([
        program.account.userPosition.all() as Promise<any[]>,
        program.account.market.all() as Promise<any[]>,
      ]);

      const marketByKey = new Map<string, any>();
      allMarkets.forEach((m) => marketByKey.set(m.publicKey.toBase58(), m.account));

      const statsByOwner = new Map<string, TraderStats>();

      for (const pos of allPositions) {
        const ownerKey = (pos.account.owner as PublicKey).toBase58();
        const marketKey = (pos.account.market as PublicKey).toBase58();
        const market = marketByKey.get(marketKey);

        const existing: TraderStats = statsByOwner.get(ownerKey) || {
          owner: ownerKey,
          totalVolumeSol: 0,
          positionsCount: 0,
          settledCount: 0,
          winsCount: 0,
          claimedCount: 0,
        };

        existing.totalVolumeSol += (pos.account.totalSpentLamports as anchor.BN).toNumber() / 1e9;
        existing.positionsCount += 1;
        if (pos.account.claimed) existing.claimedCount += 1;

        if (market && market.status?.settled) {
          existing.settledCount += 1;
          const yesShares = (pos.account.yesAmount as anchor.BN).toNumber();
          const noShares = (pos.account.noAmount as anchor.BN).toNumber();
          const won =
            (market.winningOutcome?.yes && yesShares > 0) ||
            (market.winningOutcome?.no && noShares > 0);
          if (won) existing.winsCount += 1;
        }

        statsByOwner.set(ownerKey, existing);
      }

      setTraders(Array.from(statsByOwner.values()));
    } catch (err: any) {
      console.error("Error fetching leaderboard:", err);
      toast.error(`Failed to load leaderboard: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program]);

  const sorted = [...traders].sort((a, b) => {
    if (sortBy === "volume") return b.totalVolumeSol - a.totalVolumeSol;
    if (sortBy === "wins") return b.winsCount - a.winsCount;
    return b.positionsCount - a.positionsCount;
  });

  const totals = traders.reduce(
    (acc, t) => {
      acc.volume += t.totalVolumeSol;
      acc.positions += t.positionsCount;
      return acc;
    },
    { volume: 0, positions: 0 }
  );

  const myAddress = wallet.publicKey?.toBase58();
  const myRank = myAddress ? sorted.findIndex((t) => t.owner === myAddress) + 1 : 0;
  const myStats = myAddress ? sorted.find((t) => t.owner === myAddress) : null;

  return (
    <div className="space-y-10 animate-fade-in">
      <div className="border-b border-white/5 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold font-display bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent flex items-center gap-3">
            <Trophy className="w-7 h-7 text-yellow-400" />
            Trader Leaderboard
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Ranked by on-chain activity across every SOLPredict market on devnet.
          </p>
        </div>

        {myAddress && myRank > 0 && (
          <div className="glass-panel premium-card px-4 py-2.5 flex items-center gap-3">
            <span className="text-xs text-text-muted">Your Rank</span>
            <span className="text-lg font-mono font-bold text-violet-400">#{myRank}</span>
          </div>
        )}
      </div>

      {/* Your Stats Panel */}
      {myStats && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel premium-card p-6 border-violet-500/20"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted mb-4">Your Stats</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Rank</div>
              <div className="text-xl font-mono font-bold text-violet-400">#{myRank}</div>
            </div>
            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Volume</div>
              <div className="text-xl font-mono font-bold">{myStats.totalVolumeSol.toFixed(2)} SOL</div>
            </div>
            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Win Rate</div>
              <div className="text-xl font-mono font-bold text-[#10E58C]">
                {myStats.settledCount > 0 ? `${Math.round((myStats.winsCount / myStats.settledCount) * 100)}%` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-text-muted uppercase tracking-wider">Positions</div>
              <div className="text-xl font-mono font-bold">{myStats.positionsCount}</div>
            </div>
          </div>
        </motion.section>
      )}

      {/* Aggregate stats */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="glass-panel premium-card p-6 flex items-center space-x-4">
          <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-text-muted">Total Volume Traded</div>
            <div className="text-xl font-mono font-bold">
              <CountUp value={totals.volume} decimals={2} suffix=" SOL" />
            </div>
          </div>
        </div>

        <div className="glass-panel premium-card p-6 flex items-center space-x-4">
          <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-text-muted">Active Traders</div>
            <div className="text-xl font-mono font-bold">
              <CountUp value={traders.length} />
            </div>
          </div>
        </div>

        <div className="glass-panel premium-card p-6 flex items-center space-x-4 col-span-2 md:col-span-1">
          <div className="p-3 bg-[#10E58C]/10 rounded-xl text-[#10E58C]">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-text-muted">Total Positions Opened</div>
            <div className="text-xl font-mono font-bold">
              <CountUp value={totals.positions} />
            </div>
          </div>
        </div>
      </section>

      {/* Sort controls */}
      <div className="flex items-center space-x-2">
        {[
          { key: "volume", label: "By Volume" },
          { key: "wins", label: "By Wins" },
          { key: "positions", label: "By Positions" },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key as any)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              sortBy === opt.key
                ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                : "text-text-muted hover:text-text-primary hover:bg-white/5 border border-transparent"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Leaderboard table */}
      {loading ? (
        <section className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass-panel p-5 h-16 skeleton-shimmer" />
          ))}
        </section>
      ) : sorted.length === 0 ? (
        <div className="glass-panel py-16 text-center text-text-muted flex flex-col items-center justify-center space-y-4">
          <Trophy className="w-12 h-12 opacity-50" />
          <div>
            <h3 className="text-lg font-bold text-text-primary">No Traders Yet</h3>
            <p className="text-xs">Be the first to open a position and top the leaderboard.</p>
          </div>
        </div>
      ) : (
        <section className="space-y-3">
          <AnimatePresence mode="popLayout">
            {sorted.slice(0, 50).map((trader, index) => {
              const rank = index + 1;
              const isMe = myAddress === trader.owner;
              const winRate =
                trader.settledCount > 0 ? Math.round((trader.winsCount / trader.settledCount) * 100) : null;

              return (
                <motion.div
                  key={trader.owner}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                  className={`glass-panel glass-panel-hover premium-card p-5 flex items-center justify-between gap-4 ${
                    rank === 1 ? "rank-glow-1" : rank === 2 ? "rank-glow-2" : rank === 3 ? "rank-glow-3" : ""
                  } ${isMe ? "border-violet-500/40" : ""}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <RankBadge rank={rank} />
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold text-text-primary truncate">
                        {shortAddr(trader.owner)}
                        {isMe && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 align-middle">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-text-muted font-mono">
                        {trader.positionsCount} position{trader.positionsCount !== 1 ? "s" : ""}
                        {winRate !== null && <span> &middot; {winRate}% win rate</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="font-mono font-bold text-text-primary text-sm">
                      {trader.totalVolumeSol.toFixed(2)} SOL
                    </div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">Volume</div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
}

const Leaderboard = dynamic(() => Promise.resolve(LeaderboardPage), { ssr: false });
export default Leaderboard;
