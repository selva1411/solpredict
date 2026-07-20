"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useProgram } from "@/hooks/useProgram";
import { PublicKey } from "@solana/web3.js";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Clock, Coins, Star, HelpCircle, ArrowRight } from "lucide-react";
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
import { GlassPanel } from "@/components/GlassPanel";
import { useDeviceCapability } from "@/hooks/useDeviceCapability";
import { cardHover, fadeInUp } from "@/lib/motion-variants";
import dynamic from "next/dynamic";

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

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" as const } },
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
      toast.error(`Failed to load Explorer: ${getFriendlyErrorMessage(err)}`);
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

  // Collect all feed IDs for live price fetching
  const allFeedHexes = useMemo(() => {
    const hexes: string[] = [];
    for (const m of sortedAndFiltered) {
      if (isOracleCategory(m.account.category) && m.account.oracleFeedId) {
        const hex = feedIdBytesToHex(m.account.oracleFeedId);
        if (lookupFeedEntry(hex)) {
          hexes.push(hex);
        }
      }
    }
    return hexes;
  }, [sortedAndFiltered]);

  const livePrices = usePythPrices(allFeedHexes);

  return (
    <div className="space-y-8 animate-fade-in font-sans">
      <div className="border-b border-[#9e8e78]/30 pb-4">
        <h1 className="text-3xl font-bold font-display text-[#e5e2e1] uppercase tracking-wide">
          [■] EXPLORER DEPARTURES
        </h1>
        <p className="text-xs text-[#d6c4ac]">
          Filter and query active prediction boards validated by trustless decentralized feeds.
        </p>
      </div>

      {/* Explorer Controls Form */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-end">
        <div className="md:col-span-2 space-y-2">
          <label className="text-[10px] uppercase font-mono font-bold text-[#d6c4ac]">Search Question</label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#d6c4ac]" />
            <input
              type="text"
              placeholder="SEARCH QUESTIONS..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-2.5 board-input text-xs tracking-wider border-board-border bg-board-panel"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase font-mono font-bold text-[#d6c4ac]">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "trending" | "volume" | "ends" | "newest")}
            className="w-full board-input text-xs bg-board-panel border-board-border h-[38px]"
          >
            <option value="trending">Trending Volume</option>
            <option value="volume">Highest Volume</option>
            <option value="ends">Ending Soon</option>
            <option value="newest">Newest Markets</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 border-b border-[#9e8e78]/20 pb-4">
        {/* Categories list */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedCategory("All")}
            className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-semibold rounded shrink-0 ${
              selectedCategory === "All" ? "mechanical-switch-active" : "mechanical-switch-inactive"
            }`}
          >
            ALL
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-semibold rounded shrink-0 ${
                selectedCategory === cat ? "mechanical-switch-active" : "mechanical-switch-inactive"
              }`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {/* Watchlist Toggle Switch */}
          <button
            onClick={() => setWatchlistOnly(!watchlistOnly)}
            className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-semibold rounded ${
              watchlistOnly ? "mechanical-switch-active" : "mechanical-switch-inactive"
            }`}
          >
            ⭐ WATCHLIST
          </button>

          {/* Status Selection */}
          <div className="flex items-center gap-1">
            {(["Open", "Settled", "Cancelled", "All"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSelectedStatus(s)}
                className={`px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-semibold rounded ${
                  selectedStatus === s ? "mechanical-switch-active" : "mechanical-switch-inactive"
                }`}
              >
                {s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Markets Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(6)].map((_, i) => <MarketCardSkeleton key={i} />)}
        </div>
      ) : sortedAndFiltered.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="No matching boards"
          description="Adjust your search parameters or check the filter categories."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {sortedAndFiltered.map((market) => {
            const key = market.publicKey.toBase58();
            const status = getMarketStatusString(market.account.status);
            const isWatched = watchlist.includes(key);
            const yesPool = lamportsToSol(market.account.yesPoolLamports);
            const noPool = lamportsToSol(market.account.noPoolLamports);
            const totalVolume = yesPool + noPool;
            const yesPercent = totalVolume > 0 ? Math.round((yesPool / totalVolume) * 100) : 50;

            return (
              <MarketCard
                key={key}
                market={market}
                marketKey={key}
                isWatched={isWatched}
                handleToggleWatch={handleToggleWatch}
                status={status}
                yesPercent={yesPercent}
                totalVolume={totalVolume}
                livePrices={livePrices}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface MarketCardProps {
  market: Market;
  marketKey: string;
  isWatched: boolean;
  handleToggleWatch: (key: string) => void;
  status: string;
  yesPercent: number;
  totalVolume: number;
  livePrices: Record<string, any>;
}

function MiniSparkline({ history }: { history: number[] }) {
  if (history.length < 2) return null;
  const width = 50;
  const height = 14;
  const min = Math.min(...history);
  const max = Math.max(...history);
  const range = max - min;

  const points = history
    .map((val, idx) => {
      const x = (idx / (history.length - 1)) * width;
      const y = range === 0 ? height / 2 : height - ((val - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const isUp = history[history.length - 1] >= history[0];
  const color = isUp ? "#a1d494" : "#ffb4ab";

  return (
    <svg width={width} height={height} className="overflow-visible select-none inline-block align-middle ml-1" style={{ minWidth: width }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function MarketCard({
  market,
  marketKey,
  isWatched,
  handleToggleWatch,
  status,
  yesPercent,
  totalVolume,
  livePrices,
}: MarketCardProps) {
  const { lowEndDevice, prefersReducedMotion } = useDeviceCapability();
  const feedHex = isOracleCategory(market.account.category) && market.account.oracleFeedId
    ? feedIdBytesToHex(market.account.oracleFeedId)
    : null;
  const feedEntry = feedHex ? lookupFeedEntry(feedHex) : null;
  const priceData = feedHex ? livePrices[feedHex.replace("0x", "")] : null;

  const [priceHistory, setPriceHistory] = useState<number[]>([]);

  useEffect(() => {
    if (priceData && priceData.price !== null) {
      setPriceHistory((prev) => {
        if (prev.length > 0 && prev[prev.length - 1] === priceData.price) {
          return prev;
        }
        const next = [...prev, priceData.price];
        if (next.length > 10) next.shift();
        return next;
      });
    }
  }, [priceData?.price]);

  const sparklineHistory = useMemo(() => {
    if (priceData && priceData.price !== null) {
      if (priceHistory.length >= 2) {
        return priceHistory;
      }
      const p = priceData.price;
      return [p * 0.998, p * 1.001, p * 0.999, p];
    }
    return [];
  }, [priceHistory, priceData?.price]);

  return (
    <motion.div
      variants={prefersReducedMotion ? {} : fadeInUp}
      {...(!prefersReducedMotion ? cardHover : {})}
      className="glass-panel glass-panel-interactive p-4 sm:p-5 flex flex-col justify-between h-76 border-[var(--glass-border)]"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="px-2 py-0.5 text-[9px] font-bold font-mono rounded bg-white/5 border border-[var(--glass-border)] text-[#d6c4ac]">
              {CATEGORIES[market.account.category] || "Other"}
            </span>
            {isOracleCategory(market.account.category) ? (
              <span className="text-[9px] font-mono text-[#06b6d4] font-bold" title="Oracle-settled via Pyth Network">🔮 Oracle</span>
            ) : (
              <span className="text-[9px] font-mono text-[#ffd89c] font-bold" title="Admin-manually settled">⚖️ Manual</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleToggleWatch(marketKey)}
              className="text-[#d6c4ac] hover:text-[#ffd89c] cursor-pointer bg-transparent border-0 p-1"
              aria-label={isWatched ? "Remove from watchlist" : "Add to watchlist"}
            >
              <Star className={`w-4 h-4 ${isWatched ? "text-[#ffd89c] fill-[#ffd89c]" : ""}`} />
            </button>
            <span className={`w-2.5 h-2.5 rounded-full ${
              status === "Open" ? "bg-[#a1d494]" : status === "Settled" ? "bg-[#9e8e78]" : "bg-[#ffb4ab]"
            }`} />
            <span className="text-[9px] font-mono font-bold uppercase text-[#e5e2e1]">{status}</span>
          </div>
        </div>

        <div className="flex items-center justify-between min-h-[22px]">
          {feedEntry && priceData ? (
            <div className="flex items-center gap-1.5">
              <LivePriceBar
                feedIdHex={feedHex!}
                category={market.account.category}
                livePrice={priceData.price}
                liveError={priceData.error}
                targetPrice={market.account.targetPrice.toNumber()}
                targetExpo={market.account.targetExpo}
                comparison={market.account.comparison}
                compact
              />
              <MiniSparkline history={sparklineHistory} />
            </div>
          ) : feedHex && feedEntry && !priceData ? (
            <span className="text-[10px] font-mono text-[#d6c4ac] skeleton-shimmer px-2 py-0.5 rounded">Loading price...</span>
          ) : (
            <span className="px-2 py-0.5 text-[9px] font-bold font-mono rounded bg-[#ffd89c]/10 border border-[#ffd89c]/20 text-[#ffd89c] inline-flex items-center gap-1">
              ⚖️ Manually resolved
            </span>
          )}
        </div>

        <Link href={`/market/${marketKey}`} className="block group">
          <h3 className="text-sm font-bold font-display text-[#e5e2e1] group-hover:text-[#ffd89c] transition-colors line-clamp-2 leading-snug">
            {market.account.question}
          </h3>
        </Link>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] font-mono font-bold">
          <span className="text-[#a1d494]">YES: {yesPercent}%</span>
          <span className="text-[#ffb4ab]">NO: {100 - yesPercent}%</span>
        </div>
        <div className="w-full h-3 bg-[#ffb4ab]/20 flex border border-black/40 overflow-hidden rounded-sm">
          <div className="h-full bg-[#a1d494] transition-all duration-500" style={{ width: `${yesPercent}%` }} />
        </div>
      </div>

      <div className="pt-3 border-t border-[var(--glass-border)] flex items-center justify-between text-[10px] font-mono">
        <div className="flex items-center space-x-1.5 text-[#d6c4ac]">
          <Clock className="w-3.5 h-3.5" />
          <FlipCountdown endTs={market.account.endTs.toNumber()} compact />
        </div>
        <div className="flex items-center space-x-1 text-[#ffd89c] font-bold">
          <Coins className="w-3.5 h-3.5" />
          <span>{totalVolume.toFixed(2)} SOL</span>
        </div>
      </div>

      <Link href={`/market/${marketKey}`} className="w-full pt-1">
        <button className="w-full py-2 bg-white/5 hover:bg-white/10 border border-[var(--glass-border)] text-[10px] font-bold uppercase tracking-wider font-display rounded text-[#e5e2e1] hover:border-[#ffd89c]/50 transition-all cursor-pointer">
          Inspect Specs
        </button>
      </Link>
    </motion.div>
  );
}
