"use client";

import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useProgram } from "@/hooks/useProgram";
import { PublicKey } from "@solana/web3.js";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Crown, Filter } from "lucide-react";
import * as anchor from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { SplitFlapText } from "@/components/SplitFlapText";

interface TraderStats {
  owner: string;
  totalVolumeSol: number;
  positionsCount: number;
  settledCount: number;
  winsCount: number;
  claimedCount: number;
}

const CATEGORIES = ["Crypto", "Sports", "Politics", "Tech", "Other"];

function shortAddr(addr: string): string {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="w-9 h-9 rounded bg-[#FFA500]/20 border border-[#FFA500]/40 flex items-center justify-center text-[#FFA500]">
        <Crown className="w-4 h-4" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="w-9 h-9 rounded bg-slate-300/10 border border-slate-300/30 flex items-center justify-center text-slate-300">
        <Medal className="w-4 h-4" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="w-9 h-9 rounded bg-amber-700/15 border border-amber-700/30 flex items-center justify-center text-amber-500">
        <Medal className="w-4 h-4" />
      </div>
    );
  return (
    <div className="w-9 h-9 rounded bg-[#050608] border border-[#2D3142] flex items-center justify-center text-[#808495] text-xs font-mono font-bold">
      {rank}
    </div>
  );
}

function LeaderboardPage() {
  const { program } = useProgram();
  const wallet = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<"volume" | "wins" | "positions">("volume");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const [allPositions, allMarkets] = await Promise.all([
        program.account.userPosition.all() as Promise<any[]>,
        program.account.market.all() as Promise<any[]>,
      ]);
      setPositions(allPositions);
      setMarkets(allMarkets);
    } catch (err: any) {
      console.error("Error fetching leaderboard:", err);
      toast.error(`Failed to load leaderboard: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [program]);

  // Compute category-filtered rankings
  const leaderboardStats = useMemo(() => {
    const marketByKey = new Map<string, any>();
    markets.forEach((m) => marketByKey.set(m.publicKey.toBase58(), m.account));

    const statsByOwner = new Map<string, TraderStats>();

    for (const pos of positions) {
      const ownerKey = (pos.account.owner as PublicKey).toBase58();
      const marketKey = (pos.account.market as PublicKey).toBase58();
      const market = marketByKey.get(marketKey);

      // Category filter comparison
      if (market && selectedCategory !== "All") {
        const categoryName = CATEGORIES[market.category] || "Other";
        if (categoryName !== selectedCategory) continue;
      }

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

    const tradersArray = Array.from(statsByOwner.values());
    const sorted = tradersArray.sort((a, b) => {
      if (sortBy === "volume") return b.totalVolumeSol - a.totalVolumeSol;
      if (sortBy === "wins") return b.winsCount - a.winsCount;
      return b.positionsCount - a.positionsCount;
    });

    const totals = sorted.reduce(
      (acc, t) => {
        acc.volume += t.totalVolumeSol;
        acc.positions += t.positionsCount;
        return acc;
      },
      { volume: 0, positions: 0 }
    );

    return {
      traders: sorted,
      totals,
    };
  }, [positions, markets, selectedCategory, sortBy]);

  const myAddress = wallet.publicKey?.toBase58();
  const myRank = myAddress ? leaderboardStats.traders.findIndex((t) => t.owner === myAddress) + 1 : 0;
  const myStats = myAddress ? leaderboardStats.traders.find((t) => t.owner === myAddress) : null;

  return (
    <div className="space-y-10 font-sans">
      <div className="border-b border-[#2D3142] pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-[#F4F4F9] flex items-center gap-3">
            <Trophy className="w-7 h-7 text-[#FFA500]" />
            [■] TRADER RANKINGS
          </h1>
          <p className="text-[#808495] text-sm mt-1">
            Rankings compiled from confirmed on-chain activity logs across devnet.
          </p>
        </div>

        {myAddress && myRank > 0 && (
          <div className="board-panel px-4 py-2 flex items-center gap-3 bg-[#0C0D12]">
            <span className="text-xs text-[#808495] uppercase font-display font-semibold">Your Rank</span>
            <span className="text-lg font-mono font-bold text-[#FFA500]">#{myRank}</span>
          </div>
        )}
      </div>

      {/* Category Leaderboard Filter */}
      <div className="space-y-3">
        <div className="text-[10px] uppercase font-display tracking-widest text-[#808495] font-semibold">
          Compare Rankings by Category
        </div>
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setSelectedCategory("All")}
            className={`px-3 py-1.5 text-xs font-semibold rounded transition-all active:scale-95 ${
              selectedCategory === "All"
                ? "mechanical-switch-active"
                : "mechanical-switch-inactive"
            }`}
          >
            All Categories
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-all active:scale-95 ${
                selectedCategory === cat
                  ? "mechanical-switch-active"
                  : "mechanical-switch-inactive"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Personal Stats Section */}
      {myStats && (
        <motion.section
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="board-panel p-6 bg-[#0C0D12] border-2 border-[#2D3142]"
        >
          <h3 className="text-[10px] uppercase font-display tracking-wider text-[#808495] mb-4 font-semibold">Your Profile Stats ({selectedCategory})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-[9px] text-[#808495] uppercase tracking-wider font-display">Rank</div>
              <div className="text-xl font-mono font-bold text-[#FFA500]">#{myRank}</div>
            </div>
            <div>
              <div className="text-[9px] text-[#808495] uppercase tracking-wider font-display">Volume</div>
              <div className="text-xl font-mono font-bold">{myStats.totalVolumeSol.toFixed(2)} SOL</div>
            </div>
            <div>
              <div className="text-[9px] text-[#808495] uppercase tracking-wider font-display">Win Rate</div>
              <div className="text-xl font-mono font-bold text-[#235A34]">
                {myStats.settledCount > 0 ? `${Math.round((myStats.winsCount / myStats.settledCount) * 100)}%` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-[#808495] uppercase tracking-wider font-display">Positions</div>
              <div className="text-xl font-mono font-bold">{myStats.positionsCount}</div>
            </div>
          </div>
        </motion.section>
      )}

      {/* Aggregate stats summary row */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="board-panel p-5 flex flex-col justify-between h-28 bg-[#0C0D12]">
          <div className="text-[10px] uppercase font-display tracking-wider text-[#808495]">Total Volume ({selectedCategory})</div>
          <div className="flex items-end justify-between">
            <span className="text-xs font-mono text-[#808495]">SOL</span>
            <SplitFlapText text={`${leaderboardStats.totals.volume.toFixed(1)}`} charClassName="w-[20px] h-[30px] text-sm" />
          </div>
        </div>

        <div className="board-panel p-5 flex flex-col justify-between h-28 bg-[#0C0D12]">
          <div className="text-[10px] uppercase font-display tracking-wider text-[#808495]">Traders Count ({selectedCategory})</div>
          <div className="flex items-end justify-between">
            <span className="text-xs font-mono text-[#808495]">QTY</span>
            <SplitFlapText text={`${leaderboardStats.traders.length}`} charClassName="w-[20px] h-[30px] text-sm" />
          </div>
        </div>

        <div className="board-panel p-5 flex flex-col justify-between h-28 bg-[#0C0D12] col-span-2 md:col-span-1">
          <div className="text-[10px] uppercase font-display tracking-wider text-[#808495]">Positions Opened ({selectedCategory})</div>
          <div className="flex items-end justify-between">
            <span className="text-xs font-mono text-[#808495]">QTY</span>
            <SplitFlapText text={`${leaderboardStats.totals.positions}`} charClassName="w-[20px] h-[30px] text-sm" />
          </div>
        </div>
      </section>

      {/* Sort controls */}
      <div className="flex items-center space-x-2 border-b border-[#2D3142] pb-3">
        <Filter className="w-3.5 h-3.5 text-[#808495]" />
        {[
          { key: "volume", label: "By Volume" },
          { key: "wins", label: "By Wins" },
          { key: "positions", label: "By Positions" },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key as any)}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-all active:scale-95 ${
              sortBy === opt.key
                ? "mechanical-switch-active"
                : "mechanical-switch-inactive"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Rankings board list */}
      {loading ? (
        <section className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="board-panel p-5 h-16 skeleton-shimmer bg-[#0C0D12]/50" />
          ))}
        </section>
      ) : leaderboardStats.traders.length === 0 ? (
        <div className="board-panel py-16 text-center text-[#808495] flex flex-col items-center justify-center space-y-4">
          <Trophy className="w-10 h-10 opacity-30" />
          <div>
            <h3 className="text-base font-bold font-display text-[#F4F4F9]">BOARD IS VACANT</h3>
            <p className="text-xs mt-1">Be the first to trade and claim the lead position.</p>
          </div>
        </div>
      ) : (
        <section className="space-y-3">
          <AnimatePresence mode="popLayout">
            {leaderboardStats.traders.slice(0, 50).map((trader, index) => {
              const rank = index + 1;
              const isMe = myAddress === trader.owner;
              const winRate =
                trader.settledCount > 0 ? Math.round((trader.winsCount / trader.settledCount) * 100) : null;

              return (
                <motion.div
                  key={trader.owner}
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.2) }}
                  className={`board-panel p-4 flex items-center justify-between gap-4 ${
                    isMe ? "border-[#FFA500] bg-[#FFA500]/2" : ""
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <RankBadge rank={rank} />
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold text-[#F4F4F9] truncate flex items-center gap-2">
                        {shortAddr(trader.owner)}
                        {isMe && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#FFA500]/10 border border-[#FFA500]/30 text-[#FFA500]">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#808495] font-mono">
                        {trader.positionsCount} POSITION{trader.positionsCount !== 1 ? "S" : ""}
                        {winRate !== null && <span> &middot; {winRate}% WIN RATE</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 font-mono">
                    <div className="font-bold text-[#F4F4F9] text-sm">
                      {trader.totalVolumeSol.toFixed(2)} SOL
                    </div>
                    <div className="text-[9px] text-[#808495] uppercase tracking-wider font-display">Volume</div>
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
