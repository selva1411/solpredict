"use client";

import React, { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useProgram } from "@/hooks/useProgram";
import { PublicKey } from "@solana/web3.js";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Crown, Filter, Coins, Users, Briefcase } from "lucide-react";
import * as anchor from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { fadeInUp } from "@/lib/motion-variants";
import { LoadingState, EmptyState } from "@/components/StatePanels";

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
      <div className="w-9 h-9 rounded-lg bg-[#7B3FE4]/20 border border-[#7B3FE4]/40 flex items-center justify-center">
        <Crown className="w-4 h-4 text-[#FF3D9A]" />
      </div>
    );
  if (rank === 2)
    return (
      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
        <Medal className="w-4 h-4 text-[#A5A8B8]" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
        <Medal className="w-4 h-4 text-[#7B3FE4]" />
      </div>
    );
  return (
    <div className="w-9 h-9 rounded-lg bg-[#0A0B12] border border-white/5 flex items-center justify-center text-[#A5A8B8] text-xs font-mono font-bold">
      {rank}
    </div>
  );
}

const PERIODS = [
  { key: "all", label: "All-Time" },
  { key: "monthly", label: "30d" },
  { key: "weekly", label: "7d" },
  { key: "daily", label: "24h" },
] as const;
type Period = (typeof PERIODS)[number]["key"];

function LeaderboardPage() {
  const { program } = useProgram();
  const wallet = useWallet();
  const [positions, setPositions] = useState<any[]>([]);
  const [markets, setMarkets] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<"volume" | "wins" | "positions">("volume");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("all");
  const [leaderboardFallback, setLeaderboardFallback] = useState<any[]>([]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      // DB is the primary source of truth with period filtering
      const apiRes = await fetch(`/api/leaderboard?period=${selectedPeriod}&sortBy=${sortBy}`).then(r => r.json()).catch(() => ({ ok: false, leaderboard: [] }));
      if (apiRes.ok && apiRes.leaderboard?.length > 0) {
        setLeaderboardFallback(apiRes.leaderboard);
      } else {
        setLeaderboardFallback([]);
      }
      // Try on-chain as enrichment only (may fail if validator is off)
      try {
        const [allPositions, allMarkets] = await Promise.all([
          program.account.userPosition.all(),
          program.account.market.all(),
        ]);
        setPositions(allPositions);
        setMarkets(allMarkets);
      } catch {
        // On-chain unavailable — DB data will be used
      }
    } catch (err: unknown) {
      console.error("Error fetching leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaderboard(); }, [program, selectedPeriod, sortBy]);

  const leaderboardStats = useMemo(() => {
    const marketByKey = new Map<string, any>();
    markets.forEach((m) => marketByKey.set(m.publicKey.toBase58(), m.account));
    const statsByOwner = new Map<string, TraderStats>();
    for (const pos of positions) {
      const ownerKey = (pos.account.owner as PublicKey).toBase58();
      const marketKey = (pos.account.market as PublicKey).toBase58();
      const market = marketByKey.get(marketKey);
      if (market && selectedCategory !== "All") {
        const categoryName = CATEGORIES[market.category] || "Other";
        if (categoryName !== selectedCategory) continue;
      }
      const existing: TraderStats = statsByOwner.get(ownerKey) || {
        owner: ownerKey, totalVolumeSol: 0, positionsCount: 0, settledCount: 0, winsCount: 0, claimedCount: 0,
      };
      existing.totalVolumeSol += (pos.account.totalSpentLamports as anchor.BN).toNumber() / 1e9;
      existing.positionsCount += 1;
      if (pos.account.claimed) existing.claimedCount += 1;
      if (market && market.status?.settled) {
        existing.settledCount += 1;
        const yesShares = (pos.account.yesAmount as anchor.BN).toNumber();
        const noShares = (pos.account.noAmount as anchor.BN).toNumber();
        const won = (market.winningOutcome?.yes && yesShares > 0) || (market.winningOutcome?.no && noShares > 0);
        if (won) existing.winsCount += 1;
      }
      statsByOwner.set(ownerKey, existing);
    }
    const onChainTraders = Array.from(statsByOwner.values());
    if (onChainTraders.length === 0 && leaderboardFallback.length > 0) {
      const dbTraders: TraderStats[] = leaderboardFallback.map((dbUser: any) => ({
        owner: dbUser.wallet, totalVolumeSol: dbUser.totalWagered || 0,
        positionsCount: dbUser.marketsTraded || 0, settledCount: 0,
        winsCount: 0, claimedCount: 0,
      }));
      const sorted = dbTraders.sort((a, b) => {
        if (sortBy === "volume") return b.totalVolumeSol - a.totalVolumeSol;
        if (sortBy === "wins") return b.winsCount - a.winsCount;
        return b.positionsCount - a.positionsCount;
      });
      return { traders: sorted, totals: sorted.reduce((acc, t) => { acc.volume += t.totalVolumeSol; acc.positions += t.positionsCount; return acc; }, { volume: 0, positions: 0 }) };
    }
    const sorted = onChainTraders.sort((a, b) => {
      if (sortBy === "volume") return b.totalVolumeSol - a.totalVolumeSol;
      if (sortBy === "wins") return b.winsCount - a.winsCount;
      return b.positionsCount - a.positionsCount;
    });
    return { traders: sorted, totals: sorted.reduce((acc, t) => { acc.volume += t.totalVolumeSol; acc.positions += t.positionsCount; return acc; }, { volume: 0, positions: 0 }) };
  }, [positions, markets, selectedCategory, sortBy, leaderboardFallback]);

  const myAddress = wallet.publicKey?.toBase58();
  const myRank = myAddress ? leaderboardStats.traders.findIndex((t) => t.owner === myAddress) + 1 : 0;
  const myStats = myAddress ? leaderboardStats.traders.find((t) => t.owner === myAddress) : null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2 flex items-center gap-3">
          <Trophy className="w-8 h-8 text-[#FF3D9A]" />
          <span className="text-gradient">Trader Rankings</span>
        </h1>
        <p className="text-[#A5A8B8]">
          Live rankings from on-chain activity and database records.
        </p>
      </div>

      {/* Period Tabs */}
      <div className="flex items-center gap-1 mb-4 p-1 bg-[#0A0B12] rounded-xl border border-white/5 w-fit">
        {PERIODS.map((p) => (
          <button key={p.key} onClick={() => setSelectedPeriod(p.key)}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
              selectedPeriod === p.key
                ? "bg-[#7B3FE4] text-white shadow-lg shadow-[#7B3FE4]/25"
                : "text-[#A5A8B8] hover:text-[#F4F5FA] hover:bg-white/5"
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {myAddress && myRank > 0 && (
        <div className="holo-card px-4 py-3 flex items-center gap-3 mb-6">
          <span className="text-xs text-[#A5A8B8] uppercase">Your Rank</span>
          <span className="font-display text-lg font-bold text-[#7B3FE4]">#{myRank}</span>
        </div>
      )}

      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        <button onClick={() => setSelectedCategory("All")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
            selectedCategory === "All" ? "bg-[#7B3FE4] text-white" : "text-[#A5A8B8] border border-white/10 hover:border-[#7B3FE4]/50"
          }`}>
          All Categories
        </button>
        {CATEGORIES.map((cat) => (
          <button key={cat} onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              selectedCategory === cat ? "bg-[#7B3FE4] text-white" : "text-[#A5A8B8] border border-white/10 hover:border-[#7B3FE4]/50"
            }`}>
            {cat}
          </button>
        ))}
      </div>

      {myStats && (
        <motion.section initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="holo-card p-6 mb-6">
          <h3 className="text-xs uppercase tracking-wider text-[#A5A8B8] mb-4">Your Profile Stats ({selectedCategory})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div><div className="text-xs text-[#A5A8B8] uppercase">Rank</div><div className="font-display text-xl font-bold text-[#7B3FE4]">#{myRank}</div></div>
            <div><div className="text-xs text-[#A5A8B8] uppercase">Volume</div><div className="font-display text-xl font-bold">{myStats.totalVolumeSol.toFixed(2)} SOL</div></div>
            <div><div className="text-xs text-[#A5A8B8] uppercase">Win Rate</div><div className="font-display text-xl font-bold text-[#C8FF00]">{myStats.settledCount > 0 ? `${Math.round((myStats.winsCount / myStats.settledCount) * 100)}%` : "\u2014"}</div></div>
            <div><div className="text-xs text-[#A5A8B8] uppercase">Positions</div><div className="font-display text-xl font-bold">{myStats.positionsCount}</div></div>
          </div>
        </motion.section>
      )}

      <section className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="holo-card p-4">
          <p className="text-xs text-[#A5A8B8] uppercase">Total Volume</p>
          <p className="font-display text-lg font-bold text-gradient">{leaderboardStats.totals.volume.toFixed(1)} SOL</p>
        </div>
        <div className="holo-card p-4">
          <p className="text-xs text-[#A5A8B8] uppercase">Traders</p>
          <p className="font-display text-lg font-bold text-gradient">{leaderboardStats.traders.length}</p>
        </div>
        <div className="holo-card p-4">
          <p className="text-xs text-[#A5A8B8] uppercase">Positions</p>
          <p className="font-display text-lg font-bold text-gradient">{leaderboardStats.totals.positions}</p>
        </div>
      </section>

      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-4 h-4 text-[#A5A8B8]" />
        {[{ key: "volume", label: "By Volume" }, { key: "wins", label: "By Wins" }, { key: "positions", label: "By Positions" }].map((opt) => (
          <button key={opt.key} onClick={() => setSortBy(opt.key as "volume" | "wins" | "positions")}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
              sortBy === opt.key ? "bg-[#7B3FE4]/20 text-[#7B3FE4] border border-[#7B3FE4]/30" : "text-[#A5A8B8] border border-white/10 hover:border-[#7B3FE4]/50"
            }`}>
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <section className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="holo-card p-5 h-16 shimmer" />)}
        </section>
      ) : leaderboardStats.traders.length === 0 ? (
        <EmptyState icon={Trophy} title="Board Is Vacant" description="Be the first to trade and claim the lead position." />
      ) : (
        <section className="space-y-3">
          <AnimatePresence mode="popLayout">
            {leaderboardStats.traders.slice(0, 50).map((trader, index) => {
              const rank = index + 1;
              const isMe = myAddress === trader.owner;
              const winRate = trader.settledCount > 0 ? Math.round((trader.winsCount / trader.settledCount) * 100) : null;
              return (
                <motion.div key={trader.owner} layout
                  initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.25, delay: Math.min(index * 0.02, 0.2) }}
                  className={`holo-card p-4 flex items-center justify-between gap-4 ${isMe ? "border-[#7B3FE4]/30" : ""}`}>
                  <div className="flex items-center gap-4 min-w-0">
                    <RankBadge rank={rank} />
                    <div className="min-w-0">
                      <div className="text-sm font-mono font-bold text-[#F4F5FA] truncate flex items-center gap-2">
                        {shortAddr(trader.owner)}
                        {isMe && <span className="text-xs px-1.5 py-0.5 rounded bg-[#7B3FE4]/20 border border-[#7B3FE4]/30 text-[#7B3FE4]">YOU</span>}
                      </div>
                      <div className="text-xs text-[#A5A8B8]">
                        {trader.positionsCount} POSITION{trader.positionsCount !== 1 ? "S" : ""}
                        {winRate !== null && <span> · {winRate}% WIN RATE</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-display font-bold text-[#F4F5FA]">{trader.totalVolumeSol.toFixed(2)} SOL</div>
                    <div className="text-xs text-[#A5A8B8] uppercase">Volume</div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </section>
      )}
    </main>
  );
}

const Leaderboard = dynamic(() => Promise.resolve(LeaderboardPage), { ssr: false });
export default Leaderboard;
