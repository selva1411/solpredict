"use client";

import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useProgram } from "@/hooks/useProgram";
import { PublicKey } from "@solana/web3.js";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Crown, Filter, Coins, Users, Briefcase } from "lucide-react";
import * as anchor from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { StatTile3D } from "@/components/dashboard/StatTile3D";
import { GlassPanel } from "@/components/GlassPanel";
import { fadeInUp } from "@/lib/motion-variants";
import { LoadingState, EmptyState } from "@/components/StatePanels";

interface MarketItem {
  publicKey: PublicKey;
  account: {
    marketId: anchor.BN;
    authority: PublicKey;
    question: string;
    description: string;
    category: number;
    oracleFeedId: number[];
    targetPrice: anchor.BN;
    targetExpo: number;
    comparison: number;
    endTs: anchor.BN;
    resolveTs: anchor.BN;
    status: { open?: Record<string, never>; settled?: Record<string, never>; cancelled?: Record<string, never> };
    winningOutcome: { unset?: Record<string, never>; yes?: Record<string, never>; no?: Record<string, never> };
    yesMint: PublicKey;
    noMint: PublicKey;
    yesPoolLamports: anchor.BN;
    noPoolLamports: anchor.BN;
    yesSupply: anchor.BN;
    noSupply: anchor.BN;
    totalPayoutPool: anchor.BN;
    sharePriceLamports: anchor.BN;
    feeCollected: anchor.BN;
    feeWithdrawn: boolean;
  };
}

interface UserPositionItem {
  publicKey: PublicKey;
  account: {
    owner: PublicKey;
    market: PublicKey;
    yesAmount: anchor.BN;
    noAmount: anchor.BN;
    totalSpentLamports: anchor.BN;
    claimed: boolean;
  };
}

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
  return `${addr.slice(0, 6)}...${addr.slice(-6)}`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <div className="w-9 h-9 rounded bg-[#ffd89c]/10 border border-[#ffd89c]/40 flex items-center justify-center text-[#ffd89c] shadow-[0_0_12px_rgba(255,216,156,0.15)]">
        <Crown className="w-4 h-4" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="w-9 h-9 rounded bg-white/5 border border-slate-300/30 flex items-center justify-center text-slate-300">
        <Medal className="w-4 h-4" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="w-9 h-9 rounded bg-[#9e8e78]/10 border border-[#9e8e78]/30 flex items-center justify-center text-[#ffd89c]/80">
        <Medal className="w-4 h-4" />
      </div>
    );
  return (
    <div className="w-9 h-9 rounded bg-[#0d0d0d] border border-[#9e8e78]/30 flex items-center justify-center text-[#d6c4ac] text-xs font-mono font-bold">
      {rank}
    </div>
  );
}

function LeaderboardPage() {
  const { program } = useProgram();
  const wallet = useWallet();
  const [positions, setPositions] = useState<UserPositionItem[]>([]);
  const [markets, setMarkets] = useState<MarketItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<"volume" | "wins" | "positions">("volume");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [leaderboardFallback, setLeaderboardFallback] = useState<any[]>([]);
  const [usingFallback, setUsingFallback] = useState(false);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const [allPositions, allMarkets] = await Promise.all([
        program.account.userPosition.all(),
        program.account.market.all(),
      ]);
      setPositions(allPositions);
      setMarkets(allMarkets);
    } catch (err: unknown) {
      console.error("Error fetching leaderboard:", err);
      try {
        const res = await fetch('/api/leaderboard');
        const data = await res.json();
        if (data.ok && data.leaderboard?.length > 0) {
          setLeaderboardFallback(data.leaderboard);
          setUsingFallback(true);
        }
      } catch {
        toast.error(`Failed to load leaderboard: ${getFriendlyErrorMessage(err)}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [program]);

  // Compute category-filtered rankings
  const leaderboardStats = useMemo(() => {
    const marketByKey = new Map<string, MarketItem["account"]>();
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
      <div className="border-b border-[#9e8e78]/30 pb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display text-[#e5e2e1] flex items-center gap-3">
            <Trophy className="w-7 h-7 text-[#ffd89c]" />
            [■] TRADER RANKINGS
          </h1>
          <p className="text-[#d6c4ac] text-sm mt-1">
            Rankings compiled from confirmed on-chain activity logs across devnet.
          </p>
        </div>

        {myAddress && myRank > 0 && (
          <div className="glass-panel px-4 py-2 flex items-center gap-3">
            <span className="text-xs text-[#d6c4ac] uppercase font-display font-semibold">Your Rank</span>
            <span className="text-lg font-mono font-bold text-[#ffd89c]">#{myRank}</span>
          </div>
        )}
      </div>

      {/* Category Leaderboard Filter */}
      <div className="space-y-3">
        <div className="text-[10px] uppercase font-display tracking-widest text-[#d6c4ac] font-bold">
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
          className="glass-panel p-6"
        >
          <h3 className="text-[10px] uppercase font-display tracking-wider text-[#d6c4ac] mb-4 font-bold">Your Profile Stats ({selectedCategory})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
            <div>
              <div className="text-[9px] text-[#d6c4ac] uppercase tracking-wider font-display">Rank</div>
              <div className="text-xl font-bold text-[#ffd89c]">#{myRank}</div>
            </div>
            <div>
              <div className="text-[9px] text-[#d6c4ac] uppercase tracking-wider font-display">Volume</div>
              <div className="text-xl font-bold">{myStats.totalVolumeSol.toFixed(2)} SOL</div>
            </div>
            <div>
              <div className="text-[9px] text-[#d6c4ac] uppercase tracking-wider font-display">Win Rate</div>
              <div className="text-xl font-bold text-[#a1d494]">
                {myStats.settledCount > 0 ? `${Math.round((myStats.winsCount / myStats.settledCount) * 100)}%` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[9px] text-[#d6c4ac] uppercase tracking-wider font-display">Positions</div>
              <div className="text-xl font-bold">{myStats.positionsCount}</div>
            </div>
          </div>
        </motion.section>
      )}

      {/* DB Fallback Notice */}
      {usingFallback && (
        <div className="glass-panel p-4 flex items-center justify-between">
          <div>
            <p className="text-[#ffd89c] text-xs font-mono font-bold">
              {leaderboardFallback.length} traders loaded from database cache
            </p>
            <p className="text-[#d6c4ac]/60 text-[10px] font-mono mt-1">
              On-chain data unavailable (validator may have been reset).
            </p>
          </div>
        </div>
      )}

      {/* Aggregate stats summary row */}
      {!usingFallback && (
      <section className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        <StatTile3D
          label={`Total Volume (${selectedCategory})`}
          value={leaderboardStats.totals.volume.toFixed(1)}
          unit="SOL"
          icon={Coins}
          delay={0}
        />
        <StatTile3D
          label={`Traders Count (${selectedCategory})`}
          value={String(leaderboardStats.traders.length)}
          unit="QTY"
          icon={Users}
          accent="green"
          delay={0.05}
        />
        <StatTile3D
          label={`Positions Opened (${selectedCategory})`}
          value={String(leaderboardStats.totals.positions)}
          unit="QTY"
          icon={Briefcase}
          accent="neutral"
          delay={0.1}
        />
      </section>)}

      {usingFallback && (
        <section className="space-y-3">
          <AnimatePresence mode="popLayout">
            {leaderboardFallback.map((trader: any, index: number) => {
              const rank = index + 1;
              return (
                <motion.div
                  key={trader.wallet}
                  layout
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.2) }}
                  className="glass-panel p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-4 hover-lift"
                >
                  <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                    <RankBadge rank={rank} />
                    <div className="min-w-0">
                      <div className="font-mono text-xs sm:text-sm font-bold text-[#e5e2e1] truncate flex items-center gap-2">
                        {trader.wallet.slice(0, 6)}...{trader.wallet.slice(-6)}
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#22c55e]/15 border border-[#22c55e]/30 text-[#22c55e] font-bold">
                          PAS: {trader.pasScore}
                        </span>
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-[#d6c4ac] font-mono">
                        {trader.marketsTraded} MARKET{trader.marketsTraded !== 1 ? "S" : ""} · {trader.winRate}% WIN RATE
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 font-mono">
                    <div className="font-bold text-[#e5e2e1] text-xs sm:text-sm">
                      {trader.totalWagered.toFixed(2)} SOL
                    </div>
                    <div className="text-[8px] sm:text-[9px] text-[#d6c4ac] uppercase tracking-wider font-display">Volume</div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </section>
      )}

      {/* Sort controls */}
      <div hidden={usingFallback} className="flex items-center space-x-2 border-b border-[#9e8e78]/20 pb-3">
        <Filter className="w-3.5 h-3.5 text-[#d6c4ac]" />
        {[
          { key: "volume", label: "By Volume" },
          { key: "wins", label: "By Wins" },
          { key: "positions", label: "By Positions" },
        ].map((opt) => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key as "volume" | "wins" | "positions")}
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
            <div key={i} className="glass-panel p-5 h-16 skeleton-shimmer" />
          ))}
        </section>
      ) : leaderboardStats.traders.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Board Is Vacant"
          description="Be the first to trade and claim the lead position."
        />
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
                  className={`glass-panel p-3 sm:p-4 flex items-center justify-between gap-2 sm:gap-4 hover-lift ${
                    isMe ? "border-[#ffd89c] bg-[#ffd89c]/2" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                    <RankBadge rank={rank} />
                    <div className="min-w-0">
                      <div className="font-mono text-xs sm:text-sm font-bold text-[#e5e2e1] truncate flex items-center gap-2">
                        {shortAddr(trader.owner)}
                        {isMe && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#ffd89c]/10 border border-[#ffd89c]/30 text-[#ffd89c] font-bold">
                            YOU
                          </span>
                        )}
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#22c55e]/15 border border-[#22c55e]/30 text-[#22c55e] font-bold" title="Prediction Accuracy Score">
                          PAS: {winRate !== null ? Math.min(99, Math.max(40, winRate + 20)) : 75}
                        </span>
                      </div>
                      <div className="text-[10px] sm:text-[11px] text-[#d6c4ac] font-mono">
                        {trader.positionsCount} POSITION{trader.positionsCount !== 1 ? "S" : ""}
                        {winRate !== null && <span className="hidden sm:inline"> &middot; {winRate}% WIN RATE</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 font-mono">
                    <div className="font-bold text-[#e5e2e1] text-xs sm:text-sm">
                      {trader.totalVolumeSol.toFixed(2)} SOL
                    </div>
                    <div className="text-[8px] sm:text-[9px] text-[#d6c4ac] uppercase tracking-wider font-display">Volume</div>
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
