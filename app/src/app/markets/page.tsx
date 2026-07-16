"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useProgram } from "@/hooks/useProgram";
import { PublicKey } from "@solana/web3.js";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Clock, Coins, Star, HelpCircle, ArrowRight } from "lucide-react";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
import * as anchor from "@coral-xyz/anchor";
import { FlipCountdown } from "@/components/FlipCountdown";
import { getWatchlist, toggleWatchlist } from "@/lib/watchlist";
import { getMarketStatusString } from "@/lib/events";

interface Market {
  publicKey: PublicKey;
  account: {
    marketId: anchor.BN;
    question: string;
    description: string;
    category: number;
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
        const volA = a.account.yesPoolLamports.toNumber() + a.account.noPoolLamports.toNumber();
        const volB = b.account.yesPoolLamports.toNumber() + b.account.noPoolLamports.toNumber();
        if (sortBy === "volume") return volB - volA;
        if (sortBy === "ends") return a.account.endTs.toNumber() - b.account.endTs.toNumber();
        if (sortBy === "newest") return b.account.marketId.toNumber() - a.account.marketId.toNumber();
        return volB - volA; // Default trending
      });
  }, [markets, search, selectedCategory, selectedStatus, watchlistOnly, watchlist, sortBy]);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
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

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#9e8e78]/20 pb-4">
        {/* Categories list */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setSelectedCategory("All")}
            className={`px-3 py-1.5 text-xs font-semibold rounded ${
              selectedCategory === "All" ? "mechanical-switch-active" : "mechanical-switch-inactive"
            }`}
          >
            ALL
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 text-xs font-semibold rounded ${
                selectedCategory === cat ? "mechanical-switch-active" : "mechanical-switch-inactive"
              }`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {/* Watchlist Toggle Switch */}
          <button
            onClick={() => setWatchlistOnly(!watchlistOnly)}
            className={`px-3 py-1.5 text-xs font-semibold rounded ${
              watchlistOnly ? "mechanical-switch-active" : "mechanical-switch-inactive"
            }`}
          >
            ⭐ WATCHLIST ONLY
          </button>

          {/* Status Selection */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="board-input text-xs bg-board-panel border-board-border py-1 px-3"
          >
            <option value="Open">OPEN</option>
            <option value="Settled">SETTLED</option>
            <option value="Cancelled">CANCELLED</option>
            <option value="All">ALL STATUS</option>
          </select>
        </div>
      </div>

      {/* Markets Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="board-panel skeleton-shimmer h-64 bg-board-panel" />
          ))}
        </div>
      ) : sortedAndFiltered.length === 0 ? (
        <div className="board-panel py-20 text-center text-[#d6c4ac] flex flex-col items-center justify-center space-y-4">
          <HelpCircle className="w-12 h-12 opacity-30 text-[#ffd89c]" />
          <div className="space-y-1">
            <h3 className="text-md font-bold font-display text-[#e5e2e1] uppercase">No matching boards</h3>
            <p className="text-xs">Adjust your search parameters or check the filter categories.</p>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedAndFiltered.map((market) => {
            const key = market.publicKey.toBase58();
            const status = getMarketStatusString(market.account.status);
            const isWatched = watchlist.includes(key);
            const yesPool = market.account.yesPoolLamports.toNumber() / 1e9;
            const noPool = market.account.noPoolLamports.toNumber() / 1e9;
            const totalVolume = yesPool + noPool;
            const yesPercent = totalVolume > 0 ? Math.round((yesPool / totalVolume) * 100) : 50;

            return (
              <motion.div 
                key={key} 
                variants={scaleIn}
                className="board-panel p-5 flex flex-col justify-between h-64 bg-board-panel board-panel-3d border-board-border/40"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <span className="px-2 py-0.5 text-[9px] font-bold font-mono rounded bg-white/5 border border-[#9e8e78]/30 text-[#d6c4ac]">
                        {CATEGORIES[market.account.category] || "Other"}
                      </span>
                      {market.account.category === 0 ? (
                        <span className="text-[9px] font-mono text-[#06b6d4] font-bold" title="Settled automatically via Pyth Network oracle feed">🔮 Oracle</span>
                      ) : (
                        <span className="text-[9px] font-mono text-[#ffd89c] font-bold" title="Settled manually by the platform admin signature">⚖️ Manual</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button onClick={() => handleToggleWatch(key)} className="text-[#d6c4ac] hover:text-[#ffd89c] cursor-pointer">
                        <Star className={`w-4 h-4 ${isWatched ? "text-[#ffd89c] fill-[#ffd89c]" : ""}`} />
                      </button>
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        status === "Open" ? "bg-[#a1d494]" : status === "Settled" ? "bg-[#9e8e78]" : "bg-[#ffb4ab]"
                      }`} />
                      <span className="text-[9px] font-mono font-bold uppercase">{status}</span>
                    </div>
                  </div>
                  <Link href={`/market/${key}`} className="block group">
                    <h3 className="text-sm font-bold font-display text-[#e5e2e1] group-hover:text-[#ffd89c] transition-colors line-clamp-2 leading-snug">
                      {market.account.question}
                    </h3>
                  </Link>
                </div>

                {/* YES/NO split bar layout */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono font-bold">
                    <span className="text-[#a1d494]">YES: {yesPercent}%</span>
                    <span className="text-[#ffb4ab]">NO: {100 - yesPercent}%</span>
                  </div>
                  <div className="w-full h-3 bg-[#ffb4ab]/30 flex border border-black overflow-hidden rounded">
                    <div className="h-full bg-[#a1d494]" style={{ width: `${yesPercent}%` }} />
                  </div>
                </div>

                <div className="pt-3 border-t border-[#9e8e78]/20 flex items-center justify-between text-[10px] font-mono">
                  <div className="flex items-center space-x-1.5 text-[#d6c4ac]">
                    <Clock className="w-3.5 h-3.5" />
                    <FlipCountdown endTs={market.account.endTs.toNumber()} compact />
                  </div>
                  <div className="flex items-center space-x-1 text-[#ffd89c] font-bold">
                    <Coins className="w-3.5 h-3.5" />
                    <span>{totalVolume.toFixed(2)} SOL</span>
                  </div>
                </div>

                <Link href={`/market/${key}`} className="w-full">
                  <button className="w-full py-2 bg-surface-variant hover:bg-surface-variant/80 border border-board-border/60 text-[10px] font-bold uppercase tracking-wider font-display rounded text-text-primary hover:border-mechanical-amber transition-all cursor-pointer">
                    Inspect Specs
                  </button>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
