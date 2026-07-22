"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useProgram } from "@/hooks/useProgram";
import { PublicKey } from "@solana/web3.js";
import { motion, type Variants } from "framer-motion";
import { Search, Clock, TrendingUp, Star, Flame, Zap, BarChart2 } from "lucide-react";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { lamportsToSol, bnToNum } from "@/lib/format";
import { toast } from "sonner";
import * as anchor from "@coral-xyz/anchor";
import { FlipCountdown } from "@/components/FlipCountdown";
import { getWatchlist, toggleWatchlist } from "@/lib/watchlist";
import { getMarketStatusString } from "@/lib/events";
import { usePythPrices } from "@/hooks/usePythPrices";
import { feedIdBytesToHex, lookupFeedEntry, isOracleCategory } from "@/lib/pyth-feeds";
import { LivePriceBar } from "@/components/LivePriceBar";
import { MarketCardSkeleton, EmptyState } from "@/components/StatePanels";
import { useDeviceCapability } from "@/hooks/useDeviceCapability";

interface Market {
  publicKey: PublicKey;
  account: {
    marketId: anchor.BN;
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
    yesPoolLamports: anchor.BN;
    noPoolLamports: anchor.BN;
  };
}

const CATEGORIES = ["Crypto", "Sports", "Politics", "Tech", "Other"];
const CATEGORY_ICONS: Record<string, string> = {
  Crypto: "₿",
  Sports: "⚽",
  Politics: "🗳",
  Tech: "💻",
  Other: "🌐",
};

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, delay: i * 0.04, ease: "easeOut" as const },
  }),
};

export default function MarketExplorer() {
  const { program, connection } = useProgram();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("Open");
  const [watchlistOnly, setWatchlistOnly] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"trending" | "volume" | "ends" | "newest">("trending");

  useEffect(() => {
    setWatchlist(getWatchlist());
  }, []);

  const fetchMarkets = async () => {
    try {
      setLoading(true);
      const allMarkets = (await program.account.market.all()) as Market[];
      setMarkets(allMarkets);
    } catch (err: unknown) {
      console.error(err);
      toast.error(`Failed to load markets: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
    const sub = connection.onLogs(program.programId, () => fetchMarkets(), "confirmed");
    return () => { connection.removeOnLogsListener(sub); };
  }, [program, connection]);

  const handleToggleWatch = (key: string) => {
    const next = toggleWatchlist(key);
    setWatchlist(next);
  };

  const sortedAndFiltered = useMemo(() => {
    return markets
      .filter((m) => {
        const matchesSearch =
          m.account.question.toLowerCase().includes(search.toLowerCase()) ||
          m.account.description.toLowerCase().includes(search.toLowerCase());
        const catName = CATEGORIES[m.account.category] || "Other";
        const matchesCat = selectedCategory === "All" || catName === selectedCategory;
        const statusStr = getMarketStatusString(m.account.status);
        const matchesStatus = selectedStatus === "All" || statusStr === selectedStatus;
        const matchesWatch = !watchlistOnly || watchlist.includes(m.publicKey.toBase58());
        return matchesSearch && matchesCat && matchesStatus && matchesWatch;
      })
      .sort((a, b) => {
        const volA = bnToNum(a.account.yesPoolLamports) + bnToNum(a.account.noPoolLamports);
        const volB = bnToNum(b.account.yesPoolLamports) + bnToNum(b.account.noPoolLamports);
        if (sortBy === "volume") return volB - volA;
        if (sortBy === "ends") return bnToNum(a.account.endTs) - bnToNum(b.account.endTs);
        if (sortBy === "newest") return bnToNum(b.account.marketId) - bnToNum(a.account.marketId);
        return volB - volA;
      });
  }, [markets, search, selectedCategory, selectedStatus, watchlistOnly, watchlist, sortBy]);

  const allFeedHexes = useMemo(() => {
    const hexes: string[] = [];
    for (const m of sortedAndFiltered) {
      if (isOracleCategory(m.account.category) && m.account.oracleFeedId) {
        const hex = feedIdBytesToHex(m.account.oracleFeedId);
        if (lookupFeedEntry(hex)) hexes.push(hex);
      }
    }
    return hexes;
  }, [sortedAndFiltered]);

  const livePrices = usePythPrices(allFeedHexes);

  // Stats banner
  const openCount = markets.filter(m => m.account.status && "open" in m.account.status).length;
  const totalVol = markets.reduce((acc, m) => acc + lamportsToSol(m.account.yesPoolLamports) + lamportsToSol(m.account.noPoolLamports), 0);

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-white/8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#e5e2e1] tracking-tight">
            Markets
          </h1>
          <p className="text-sm text-[#9e8e78] mt-1">
            Trade on real-world outcomes · Powered by Solana
          </p>
        </div>
        {/* Quick stats */}
        <div className="flex items-center gap-4 text-[11px] font-mono">
          <div className="text-center">
            <div className="font-bold text-[#e5e2e1] text-base">{openCount}</div>
            <div className="text-[#9e8e78]">Open markets</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="font-bold text-[#22c55e] text-base">{totalVol.toFixed(1)} SOL</div>
            <div className="text-[#9e8e78]">Total volume</div>
          </div>
        </div>
      </div>

      {/* Search + Sort Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9e8e78]" />
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0d0d0d] border border-[#9e8e78]/25 rounded-lg text-sm text-[#e5e2e1] placeholder-[#9e8e78]/60 focus:outline-none focus:border-[#ffd89c]/50 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {(["trending", "volume", "ends", "newest"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-2 rounded-lg text-[11px] font-semibold capitalize cursor-pointer transition-all border ${
                sortBy === s
                  ? "bg-[#ffd89c]/10 border-[#ffd89c]/40 text-[#ffd89c]"
                  : "bg-[#0d0d0d] border-[#9e8e78]/20 text-[#9e8e78] hover:text-[#e5e2e1] hover:border-[#9e8e78]/40"
              }`}
            >
              {s === "trending" ? <Flame className="w-3 h-3 inline mr-1" /> : null}
              {s === "volume" ? <BarChart2 className="w-3 h-3 inline mr-1" /> : null}
              {s === "ends" ? <Clock className="w-3 h-3 inline mr-1" /> : null}
              {s === "newest" ? <Zap className="w-3 h-3 inline mr-1" /> : null}
              {s === "trending" ? "Hot" : s === "ends" ? "Ending" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none border-b border-white/8">
        {["All", ...CATEGORIES].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all border ${
              selectedCategory === cat
                ? "bg-white text-[#131313] border-transparent font-bold"
                : "bg-transparent border-[#9e8e78]/20 text-[#9e8e78] hover:text-[#e5e2e1] hover:border-[#9e8e78]/40"
            }`}
          >
            {cat !== "All" && <span className="mr-1">{CATEGORY_ICONS[cat]}</span>}
            {cat}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setWatchlistOnly(!watchlistOnly)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
              watchlistOnly
                ? "bg-[#ffd89c]/10 border-[#ffd89c]/40 text-[#ffd89c]"
                : "bg-transparent border-[#9e8e78]/20 text-[#9e8e78] hover:text-[#e5e2e1]"
            }`}
          >
            <Star className={`w-3 h-3 ${watchlistOnly ? "fill-current" : ""}`} />
            Watchlist
          </button>
          {(["Open", "Settled", "All"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSelectedStatus(s)}
              className={`px-3 py-2 rounded-full text-xs font-semibold cursor-pointer transition-all border ${
                selectedStatus === s
                  ? s === "Open"
                    ? "bg-[#22c55e]/10 border-[#22c55e]/40 text-[#22c55e]"
                    : "bg-[#9e8e78]/10 border-[#9e8e78]/40 text-[#9e8e78]"
                  : "bg-transparent border-[#9e8e78]/20 text-[#9e8e78] hover:text-[#e5e2e1]"
              }`}
            >
              {s === "Open" && <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] inline-block mr-1.5" />}
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-[11px] text-[#9e8e78] font-mono">
          Showing {sortedAndFiltered.length} market{sortedAndFiltered.length !== 1 ? "s" : ""}
          {selectedCategory !== "All" ? ` in ${selectedCategory}` : ""}
        </p>
      )}

      {/* Markets Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <MarketCardSkeleton key={i} />)}
        </div>
      ) : sortedAndFiltered.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No markets found"
          description="Try adjusting your search or filters."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedAndFiltered.map((market, i) => {
            const key = market.publicKey.toBase58();
            const status = getMarketStatusString(market.account.status);
            const isWatched = watchlist.includes(key);
            const yesPool = lamportsToSol(market.account.yesPoolLamports);
            const noPool = lamportsToSol(market.account.noPoolLamports);
            const totalVolume = yesPool + noPool;
            const yesPercent = totalVolume > 0 ? Math.round((yesPool / totalVolume) * 100) : 50;
            const noPercent = 100 - yesPercent;
            const feedHex = isOracleCategory(market.account.category) && market.account.oracleFeedId
              ? feedIdBytesToHex(market.account.oracleFeedId)
              : null;
            const priceData = feedHex ? livePrices[feedHex.replace("0x", "")] : null;
            const catName = CATEGORIES[market.account.category] || "Other";
            const endTs = market.account.endTs.toNumber();
            const now = Math.floor(Date.now() / 1000);
            const isEndingSoon = endTs - now < 3600 && status === "Open";

            return (
              <motion.div
                key={key}
                custom={i}
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="group relative bg-[#111111] border border-white/8 rounded-xl overflow-hidden hover:border-white/18 transition-all duration-200 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col"
              >
                {/* Status ribbon */}
                {status === "Open" && (
                  <div className={`absolute top-0 left-0 right-0 h-0.5 ${
                    isEndingSoon ? "bg-gradient-to-r from-[#ef4444] to-[#f97316]" : "bg-gradient-to-r from-[#22c55e]/0 via-[#22c55e]/40 to-[#22c55e]/0"
                  }`} />
                )}

                <div className="p-4 flex flex-col gap-3 flex-1">
                  {/* Top row: category + status + watchlist */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/6 text-[#9e8e78] border border-white/8">
                        {CATEGORY_ICONS[catName]} {catName}
                      </span>
                      {isEndingSoon && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#ef4444]/10 text-[#ef4444] border border-[#ef4444]/20 animate-pulse">
                          Ending soon
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 text-[9px] font-bold ${
                        status === "Open" ? "text-[#22c55e]" : status === "Settled" ? "text-[#9e8e78]" : "text-[#ef4444]"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          status === "Open" ? "bg-[#22c55e] animate-pulse" : status === "Settled" ? "bg-[#9e8e78]" : "bg-[#ef4444]"
                        }`} />
                        {status}
                      </span>
                      <button
                        onClick={() => handleToggleWatch(key)}
                        className="text-[#9e8e78] hover:text-[#ffd89c] cursor-pointer transition-colors"
                      >
                        <Star className={`w-3.5 h-3.5 ${isWatched ? "text-[#ffd89c] fill-[#ffd89c]" : ""}`} />
                      </button>
                    </div>
                  </div>

                  {/* Live price if oracle */}
                  {priceData && feedHex && (
                    <div className="text-[10px]">
                      <LivePriceBar
                        feedIdHex={feedHex}
                        category={market.account.category}
                        livePrice={priceData.price}
                        liveError={priceData.error}
                        targetPrice={market.account.targetPrice.toNumber()}
                        targetExpo={market.account.targetExpo}
                        comparison={market.account.comparison}
                        compact
                      />
                    </div>
                  )}

                  {/* Question */}
                  <Link href={`/market/${key}`} className="flex-1">
                    <h3 className="text-sm font-semibold text-[#e5e2e1] group-hover:text-white transition-colors leading-snug line-clamp-3 cursor-pointer">
                      {market.account.question}
                    </h3>
                  </Link>

                  {/* Probability display — Polymarket style */}
                  <div className="space-y-2 mt-auto">
                    <div className="flex items-center justify-between text-[11px] font-bold font-mono">
                      <span className="text-[#22c55e]">Yes {yesPercent}%</span>
                      <span className="text-[#ef4444]">{noPercent}% No</span>
                    </div>
                    <div className="relative h-1.5 w-full bg-[#ef4444]/20 rounded-full overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full bg-[#22c55e] rounded-full transition-all duration-500"
                        style={{ width: `${yesPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-white/6 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[10px] font-mono text-[#9e8e78]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <FlipCountdown endTs={endTs} compact />
                    </span>
                    <span className="flex items-center gap-1 text-[#ffd89c]/80">
                      <TrendingUp className="w-3 h-3" />
                      {totalVolume.toFixed(2)} SOL
                    </span>
                  </div>

                  <Link href={`/market/${key}`}>
                    <button className={`px-3 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                      status === "Open"
                        ? "bg-white text-[#131313] hover:bg-white/90 shadow-sm"
                        : "bg-white/6 text-[#9e8e78] hover:bg-white/10 border border-white/10"
                    }`}>
                      {status === "Open" ? "Trade" : "View"}
                    </button>
                  </Link>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
