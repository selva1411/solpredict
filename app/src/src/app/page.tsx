"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useProgram } from "@/hooks/useProgram";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { 
  TrendingUp, 
  Search, 
  Layers, 
  Clock, 
  Coins, 
  Activity, 
  ShieldAlert, 
  HelpCircle,
  Database,
  Star,
  ArrowUpDown,
  Flame
} from "lucide-react";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
import * as anchor from "@coral-xyz/anchor";
import { CountUp } from "@/components/CountUp";
import { getWatchlist, isWatched, toggleWatch } from "@/lib/watchlist";

interface Market {
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
    status: any; // { open: {} } | { settled: {} } | { cancelled: {} }
    winningOutcome: any; // { unset: {} } | { yes: {} } | { no: {} }
    yesMint: PublicKey;
    noMint: PublicKey;
    yesPoolLamports: anchor.BN;
    noPoolLamports: anchor.BN;
    yesSupply: anchor.BN;
    noSupply: anchor.BN;
    totalPayoutPool: anchor.BN;
    sharePriceLamports: anchor.BN;
  };
}

const CATEGORIES = ["Crypto", "Sports", "Politics", "Tech", "Other"];

function HomePage() {
  const { program, connection } = useProgram();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("Open");
  const [sortBy, setSortBy] = useState<"trending" | "ending" | "newest" | "volume">("trending");
  const [watchlistOnly, setWatchlistOnly] = useState<boolean>(false);
  const [watchedIds, setWatchedIds] = useState<string[]>([]);

  useEffect(() => {
    setWatchedIds(getWatchlist());
    const handler = () => setWatchedIds(getWatchlist());
    window.addEventListener("watchlist-change", handler);
    return () => window.removeEventListener("watchlist-change", handler);
  }, []);

  const handleToggleWatch = (marketId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleWatch(marketId);
    setWatchedIds(getWatchlist());
  };

  // Fetch all markets
  const fetchMarkets = async () => {
    try {
      setLoading(true);
      const allMarkets = await program.account.market.all() as any[];
      setMarkets(allMarkets);
    } catch (err: any) {
      console.error("Error fetching markets:", err);
      toast.error(`Failed to load markets: ${getFriendlyErrorMessage(err)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarkets();
    // Setup ws refresh on block change or log change
    const subscription = connection.onLogs(program.programId, () => {
      fetchMarkets();
    }, "confirmed");

    return () => {
      connection.removeOnLogsListener(subscription);
    };
  }, [program, connection]);

  // Helper to format BN target price based on exponent
  const formatTargetPrice = (price: anchor.BN, expo: number): string => {
    const raw = price.toNumber();
    const divider = Math.pow(10, Math.abs(expo));
    const normalized = raw / divider;
    return `$${normalized.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  };

  // Helper to get status string from program representation
  const getStatusString = (status: any): "Open" | "Settled" | "Cancelled" => {
    if (status.open) return "Open";
    if (status.settled) return "Settled";
    if (status.cancelled) return "Cancelled";
    return "Open";
  };

  // Helper to get category string
  const getCategoryString = (categoryIndex: number): string => {
    return CATEGORIES[categoryIndex] || "Other";
  };

  // Implied probability calculation
  const getImpliedProbability = (yesPool: anchor.BN, noPool: anchor.BN) => {
    const yes = yesPool.toNumber();
    const no = noPool.toNumber();
    const total = yes + no;
    if (total === 0) return { yes: 50, no: 50 };
    const yesProb = Math.round((yes / total) * 100);
    return { yes: yesProb, no: 100 - yesProb };
  };

  // Time remaining string helper
  const getTimeRemaining = (endTs: anchor.BN): string => {
    const now = Math.floor(Date.now() / 1000);
    const end = endTs.toNumber();
    const diff = end - now;
    if (diff <= 0) return "Trading ended";
    
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  };

  // Filters logic
  const filteredMarkets = markets
    .filter((m) => {
      const matchesSearch = 
        m.account.question.toLowerCase().includes(search.toLowerCase()) ||
        m.account.description.toLowerCase().includes(search.toLowerCase());
      
      const categoryName = getCategoryString(m.account.category);
      const matchesCategory = selectedCategory === "All" || categoryName === selectedCategory;

      const statusString = getStatusString(m.account.status);
      const matchesStatus = selectedStatus === "All" || statusString === selectedStatus;

      const matchesWatchlist = !watchlistOnly || watchedIds.includes(m.publicKey.toBase58());

      return matchesSearch && matchesCategory && matchesStatus && matchesWatchlist;
    })
    .sort((a, b) => {
      const volumeOf = (m: Market) =>
        m.account.yesPoolLamports.toNumber() + m.account.noPoolLamports.toNumber();

      if (sortBy === "volume") return volumeOf(b) - volumeOf(a);
      if (sortBy === "ending") return a.account.endTs.toNumber() - b.account.endTs.toNumber();
      if (sortBy === "newest") return b.account.marketId.toNumber() - a.account.marketId.toNumber();
      // "trending" — highest volume among markets closing soon-ish gets a boost
      return volumeOf(b) - volumeOf(a);
    });

  // Calculate platform statistics
  const stats = (() => {
    let totalVolumeLamports = 0;
    let openCount = 0;
    let settledCount = 0;
    
    markets.forEach((m) => {
      const status = getStatusString(m.account.status);
      totalVolumeLamports += m.account.yesPoolLamports.toNumber() + m.account.noPoolLamports.toNumber();
      if (status === "Open") openCount++;
      if (status === "Settled") settledCount++;
    });

    return {
      volume: (totalVolumeLamports / 1e9).toFixed(2),
      open: openCount,
      settled: settledCount,
      total: markets.length
    };
  })();

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Premium Obsidian Hero Banner */}
      <section className="relative overflow-hidden glass-panel px-6 py-10 sm:px-12 sm:py-16 text-center space-y-6">
        <div className="absolute inset-0 bg-radial-gradient from-violet-500/10 to-transparent -z-10" />
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight font-display bg-gradient-to-r from-violet-400 via-indigo-200 to-cyan-400 bg-clip-text text-transparent">
          Predict the Future. Own the Outcome.
        </h1>
        <p className="max-w-2xl mx-auto text-sm sm:text-base text-text-muted">
          Welcome to the future of forecasting. Own fractional positions on YES/NO contracts, backed by the speed of Solana and secured by real-time Pyth price oracles.
        </p>
      </section>

      {/* Platform Statistics */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-6 flex items-center space-x-4">
          <div className="p-3 bg-violet-500/10 rounded-xl text-violet-400">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-text-muted">Total Volume</div>
            <div className="text-xl font-mono font-bold">
              <CountUp value={Number(stats.volume)} decimals={2} suffix=" SOL" />
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center space-x-4">
          <div className="p-3 bg-[#10E58C]/10 rounded-xl text-[#10E58C]">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-text-muted">Open Markets</div>
            <div className="text-xl font-mono font-bold"><CountUp value={stats.open} /></div>
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center space-x-4">
          <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-text-muted">Settled Markets</div>
            <div className="text-xl font-mono font-bold"><CountUp value={stats.settled} /></div>
          </div>
        </div>

        <div className="glass-panel p-6 flex items-center space-x-4">
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-text-muted">Total Scaffolded</div>
            <div className="text-xl font-mono font-bold"><CountUp value={stats.total} /></div>
          </div>
        </div>
      </section>

      {/* Live Ticker Marquee */}
      {!loading && markets.length > 0 && (
        <section className="glass-panel py-3 overflow-hidden">
          <div className="ticker-track">
            {[...markets, ...markets].map((m, i) => {
              const prob = getImpliedProbability(m.account.yesPoolLamports, m.account.noPoolLamports);
              return (
                <Link
                  href={`/market/${m.publicKey.toBase58()}`}
                  key={`${m.publicKey.toBase58()}-${i}`}
                  className="flex items-center gap-2 px-6 border-r border-white/8 whitespace-nowrap text-xs hover:text-violet-400 transition-colors"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span className="text-text-primary font-medium">{m.account.question}</span>
                  <span className="text-[#10E58C] font-mono font-semibold">{prob.yes}%</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Markets Explorer Toolbar */}
      <section className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory("All")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                selectedCategory === "All"
                  ? "bg-white/10 text-text-primary border border-white/20"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              All Categories
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-white/10 text-text-primary border border-white/20"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Status Selectors */}
          <div className="flex items-center space-x-2">
            {["Open", "Settled", "Cancelled", "All"].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                  selectedStatus === status
                    ? "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                    : "text-text-muted hover:text-text-primary hover:bg-white/5"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar + Sort + Watchlist toggle */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              placeholder="Search markets by keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/3 border border-white/8 rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-violet-500/50 transition-all font-sans text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <ArrowUpDown className="absolute left-3 w-4 h-4 text-text-muted pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none pl-9 pr-4 py-3 bg-white/3 border border-white/8 rounded-xl text-text-primary text-xs font-semibold focus:outline-none focus:border-violet-500/50 transition-all cursor-pointer"
              >
                <option value="trending" className="bg-[#0B0B1E]">Trending</option>
                <option value="volume" className="bg-[#0B0B1E]">Highest Volume</option>
                <option value="ending" className="bg-[#0B0B1E]">Ending Soon</option>
                <option value="newest" className="bg-[#0B0B1E]">Newest</option>
              </select>
            </div>

            <button
              onClick={() => setWatchlistOnly((v) => !v)}
              className={`flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                watchlistOnly
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                  : "bg-white/3 border-white/8 text-text-muted hover:text-text-primary"
              }`}
            >
              <Star className={`w-4 h-4 ${watchlistOnly ? "fill-amber-400" : ""}`} />
              <span className="hidden sm:inline">Watchlist</span>
            </button>
          </div>
        </div>
      </section>

      {/* Markets Grid */}
      {loading ? (
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-panel p-6 h-64 skeleton-shimmer" />
          ))}
        </section>
      ) : filteredMarkets.length === 0 ? (
        <div className="glass-panel py-16 text-center text-text-muted flex flex-col items-center justify-center space-y-4">
          <HelpCircle className="w-12 h-12 opacity-50" />
          <div>
            <h3 className="text-lg font-bold text-text-primary">No Markets Found</h3>
            <p className="text-xs">Try selecting a different category or refining your search query.</p>
          </div>
        </div>
      ) : (
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMarkets.map((market) => {
            const status = getStatusString(market.account.status);
            const prob = getImpliedProbability(market.account.yesPoolLamports, market.account.noPoolLamports);
            const timeRemaining = getTimeRemaining(market.account.endTs);
            const category = getCategoryString(market.account.category);
            const volumeSol = (
              market.account.yesPoolLamports.toNumber() + 
              market.account.noPoolLamports.toNumber()
            ) / 1e9;

            return (
              <div key={market.publicKey.toBase58()} className="glass-panel glass-panel-hover p-6 flex flex-col h-full justify-between gap-6">
                {/* Card Top */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md bg-white/5 border border-white/8 text-violet-400">
                      {category}
                    </span>
                    
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${
                          status === "Open" ? "bg-[#10E58C] animate-pulse" : status === "Settled" ? "bg-text-muted" : "bg-[#FF4D6D]"
                        }`}></span>
                        <span className="text-[10px] font-mono text-text-muted uppercase tracking-wider">
                          {status}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleToggleWatch(market.publicKey.toBase58(), e)}
                        className="text-text-muted hover:text-amber-400 transition-colors cursor-pointer"
                        aria-label="Toggle watchlist"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            watchedIds.includes(market.publicKey.toBase58())
                              ? "fill-amber-400 text-amber-400 star-pop"
                              : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <Link href={`/market/${market.publicKey.toBase58()}`}>
                    <h3 className="text-base font-bold font-display hover:text-violet-400 transition-colors line-clamp-3">
                      {market.account.question}
                    </h3>
                  </Link>
                </div>

                {/* Card Probability Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#10E58C] font-semibold">YES: {prob.yes}%</span>
                    <span className="text-[#FF4D6D] font-semibold">NO: {prob.no}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden bg-[#FF4D6D]/20 flex">
                    <div className="h-full bg-[#10E58C]" style={{ width: `${prob.yes}%` }}></div>
                  </div>
                </div>

                {/* Card Bottom Meta */}
                <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5 text-xs text-text-muted">
                    <Clock className="w-4 h-4" />
                    <span className="font-mono text-[11px]">{timeRemaining}</span>
                  </div>

                  <div className="flex items-center space-x-1 text-xs text-text-muted">
                    <Coins className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-text-primary font-mono text-[11px]">
                      {volumeSol.toFixed(2)} SOL
                    </span>
                  </div>
                </div>

                <Link href={`/market/${market.publicKey.toBase58()}`} className="w-full">
                  <button className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-xs font-bold transition-all cursor-pointer text-center text-text-primary">
                    View Market Specs
                  </button>
                </Link>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

const Home = dynamic(() => Promise.resolve(HomePage), { ssr: false });
export default Home;