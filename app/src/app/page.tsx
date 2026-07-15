"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useProgram } from "@/hooks/useProgram";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { motion } from "framer-motion";
import { 
  Search, 
  Clock, 
  Coins, 
  HelpCircle,
  Star,
  Activity,
  Calendar,
  Filter
} from "lucide-react";
import { getFriendlyErrorMessage } from "@/lib/error-map";
import { toast } from "sonner";
import * as anchor from "@coral-xyz/anchor";
import { SplitFlapText } from "@/components/SplitFlapText";
import { FlipCountdown } from "@/components/FlipCountdown";
import { HowItWorks } from "@/components/HowItWorks";

const SplitFlapBoard = dynamic(() => import("@/components/SplitFlapBoard"), { ssr: false });

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
    status: any;
    winningOutcome: any;
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

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" as const } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "easeOut" as const } },
};

function HomePage() {
  const { program, connection } = useProgram();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("Open");
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());

  // Load watchlist
  useEffect(() => {
    try {
      const saved = localStorage.getItem("solpredict-watchlist");
      if (saved) setWatchlist(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  const toggleWatchlist = (key: string) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      localStorage.setItem("solpredict-watchlist", JSON.stringify([...next]));
      return next;
    });
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
    const subscription = connection.onLogs(program.programId, () => {
      fetchMarkets();
    }, "confirmed");

    return () => {
      connection.removeOnLogsListener(subscription);
    };
  }, [program, connection]);

  // Watchlist expiration check (Trigger Alert Toast if < 1 Hour left)
  useEffect(() => {
    if (markets.length === 0 || watchlist.size === 0) return;
    const now = Math.floor(Date.now() / 1000);
    const alertedKeys = new Set<string>(JSON.parse(sessionStorage.getItem("expiring-alerts") || "[]"));
    let updated = false;

    markets.forEach((m) => {
      const key = m.publicKey.toBase58();
      const status = getStatusString(m.account.status);
      if (watchlist.has(key) && status === "Open") {
        const timeDiff = m.account.endTs.toNumber() - now;
        if (timeDiff > 0 && timeDiff < 3600 && !alertedKeys.has(key)) {
          toast.warning(`Expiring Prediction Market Alert: "${m.account.question}" closes in ${Math.round(timeDiff / 60)} minutes!`, {
            duration: 12000,
          });
          alertedKeys.add(key);
          updated = true;
        }
      }
    });

    if (updated) {
      sessionStorage.setItem("expiring-alerts", JSON.stringify([...alertedKeys]));
    }
  }, [markets, watchlist]);

  const getStatusString = (status: any): "Open" | "Settled" | "Cancelled" => {
    if (status.open) return "Open";
    if (status.settled) return "Settled";
    if (status.cancelled) return "Cancelled";
    return "Open";
  };

  const getCategoryString = (categoryIndex: number): string => {
    return CATEGORIES[categoryIndex] || "Other";
  };

  const getImpliedProbability = (yesPool: anchor.BN, noPool: anchor.BN) => {
    const yes = yesPool.toNumber();
    const no = noPool.toNumber();
    const total = yes + no;
    if (total === 0) return { yes: 50, no: 50 };
    const yesProb = Math.round((yes / total) * 100);
    return { yes: yesProb, no: 100 - yesProb };
  };

  const getTimeRemaining = (endTs: anchor.BN): string => {
    const now = Math.floor(Date.now() / 1000);
    const end = endTs.toNumber();
    const diff = end - now;
    if (diff <= 0) return "RESOLVED";
    
    const days = Math.floor(diff / 86400);
    const hours = Math.floor((diff % 86400) / 3600);
    const minutes = Math.floor((diff % 3600) / 60);

    if (days > 0) return `${days}D ${hours}H LEFT`;
    if (hours > 0) return `${hours}H ${minutes}M LEFT`;
    return `${minutes}M LEFT`;
  };

  const filteredMarkets = markets.filter((m) => {
    const matchesSearch = 
      m.account.question.toLowerCase().includes(search.toLowerCase()) ||
      m.account.description.toLowerCase().includes(search.toLowerCase());
    
    const categoryName = getCategoryString(m.account.category);
    const matchesCategory = selectedCategory === "All" || categoryName === selectedCategory;

    const statusString = getStatusString(m.account.status);
    const matchesStatus = selectedStatus === "All" || statusString === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

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
      volume: totalVolumeLamports / 1e9,
      open: openCount,
      settled: settledCount,
      total: markets.length
    };
  })();

  const featuredMarket = markets
    .filter((m) => getStatusString(m.account.status) === "Open")
    .sort((a, b) => {
      const volA = a.account.yesPoolLamports.toNumber() + a.account.noPoolLamports.toNumber();
      const volB = b.account.yesPoolLamports.toNumber() + b.account.noPoolLamports.toNumber();
      return volB - volA;
    })[0];

  return (
    <div className="space-y-10 font-sans">
      {/* 1. 3D Departure Board Hero Header */}
      <section className="board-panel overflow-hidden bg-[#0C0D12] border-2 border-[#2D3142] space-y-2">
        <div className="p-4 flex items-center justify-between border-b border-[#2D3142]">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#FFA500] animate-pulse" />
            <span className="text-[10px] font-mono tracking-widest text-[#FFA500] uppercase font-bold">
              SOLPREDICT MECHANICAL HUD // CYCLING ON-CHAIN CONTRACTS
            </span>
          </div>
          <span className="text-[10px] font-mono text-[#808495] hidden sm:inline">BOARD COMPILER ONLINE //</span>
        </div>
        
        {/* Suspense boundary for 3D R3F canvas loading */}
        <SplitFlapBoard marketsList={markets.filter(m => getStatusString(m.account.status) === "Open").map(m => m.account.question)} />
        
        <div className="p-4 bg-[#050608]/50 border-t border-[#2D3142]">
          <p className="text-xs text-[#808495] leading-relaxed font-sans max-w-3xl">
            Mechanical split-flap terminal cycling active devnet prediction contracts. Settle positions using decentralized oracle validation backed by Pyth Network real-time price feeds.
          </p>
        </div>
      </section>

      {/* 2. Featured Market board row */}
      {featuredMarket && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Link href={`/market/${featuredMarket.publicKey.toBase58()}`} className="block">
            <div className="board-panel board-panel-interactive p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
              <div className="flex-1 space-y-2 text-center sm:text-left">
                <div className="flex items-center justify-center sm:justify-start space-x-2">
                  <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest rounded bg-[#FFA500]/10 border border-[#FFA500]/30 text-[#FFA500] font-bold">
                    FEATURED CONTRACT
                  </span>
                  <span className="px-2 py-0.5 text-[9px] font-mono uppercase tracking-widest rounded bg-[#2D3142]/40 border border-[#2D3142] text-[#808495]">
                    {getCategoryString(featuredMarket.account.category)}
                  </span>
                </div>
                <h3 className="text-xl font-bold font-display text-[#F4F4F9]">
                  {featuredMarket.account.question}
                </h3>
                <div className="flex items-center justify-center sm:justify-start space-x-4 text-xs font-mono text-[#808495]">
                  <span className="text-[#235A34] font-bold">
                    YES: {getImpliedProbability(featuredMarket.account.yesPoolLamports, featuredMarket.account.noPoolLamports).yes}%
                  </span>
                  <span>•</span>
                  <span>
                    {((featuredMarket.account.yesPoolLamports.toNumber() + featuredMarket.account.noPoolLamports.toNumber()) / 1e9).toFixed(2)} SOL VOLUME
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0">
                <FlipCountdown endTs={featuredMarket.account.endTs.toNumber()} compact />
              </div>
            </div>
          </Link>
        </motion.section>
      )}

      {/* 3. Platform Statistics with Split-Flap numbers */}
      <motion.section
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeInUp} className="board-panel p-5 flex flex-col justify-between h-28 bg-[#0C0D12]">
          <div className="text-[10px] uppercase font-display tracking-wider text-[#808495] font-bold">Total Volume</div>
          <div className="flex items-end justify-between">
            <SplitFlapText text={loading ? " --- " : `${stats.volume.toFixed(1)} SOL`} charClassName="w-[20px] h-[30px] text-xs font-bold" />
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="board-panel p-5 flex flex-col justify-between h-28 bg-[#0C0D12]">
          <div className="text-[10px] uppercase font-display tracking-wider text-[#808495] font-bold">Open Markets</div>
          <div className="flex items-end justify-between">
            <SplitFlapText text={loading ? " -- " : `${stats.open} OPEN`} charClassName="w-[20px] h-[30px] text-xs font-bold" />
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="board-panel p-5 flex flex-col justify-between h-28 bg-[#0C0D12]">
          <div className="text-[10px] uppercase font-display tracking-wider text-[#808495] font-bold">Settled Board</div>
          <div className="flex items-end justify-between">
            <SplitFlapText text={loading ? " -- " : `${stats.settled} DONE`} charClassName="w-[20px] h-[30px] text-xs font-bold" />
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="board-panel p-5 flex flex-col justify-between h-28 bg-[#0C0D12]">
          <div className="text-[10px] uppercase font-display tracking-wider text-[#808495] font-bold">Total Deployments</div>
          <div className="flex items-end justify-between">
            <SplitFlapText text={loading ? " -- " : `${stats.total} TOTAL`} charClassName="w-[20px] h-[30px] text-xs font-bold" />
          </div>
        </motion.div>
      </motion.section>

      {/* 4. Explorer Toolbar */}
      <motion.section
        className="space-y-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="space-y-1">
          <h2 className="text-xl font-bold font-display text-[#F4F4F9] uppercase tracking-wide">
            [■] EXPLORER DEPARTURES
          </h2>
          <p className="text-xs text-[#808495] font-medium leading-relaxed">
            Active prediction boards currently tracking on-chain pool configurations.
          </p>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2D3142] pb-4">
          {/* Category Tabs */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedCategory("All")}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-all active:scale-95 ${
                selectedCategory === "All"
                  ? "mechanical-switch-active"
                  : "mechanical-switch-inactive"
              }`}
            >
              All
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

          {/* Status filter selection */}
          <div className="flex items-center space-x-2">
            <Filter className="w-3.5 h-3.5 text-[#808495]" />
            {["Open", "Settled", "Cancelled", "All"].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition-all active:scale-95 ${
                  selectedStatus === status
                    ? "mechanical-switch-active"
                    : "mechanical-switch-inactive"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808495]" />
          <input
            type="text"
            placeholder="FILTER DEPARTURES / QUESTIONS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 board-input text-xs tracking-wider"
          />
        </div>
      </motion.section>

      {/* 5. Flight Board Grid */}
      {loading ? (
        <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="board-panel p-6 h-64 skeleton-shimmer bg-[#0C0D12]/50" />
          ))}
        </section>
      ) : filteredMarkets.length === 0 ? (
        <div className="board-panel py-16 text-center text-[#808495] flex flex-col items-center justify-center space-y-4">
          <HelpCircle className="w-10 h-10 opacity-30" />
          <div>
            <h3 className="text-base font-bold font-display text-[#F4F4F9]">NO CONTRACTS RECORDED</h3>
            <p className="text-xs">Adjust filters or check connection parameters.</p>
          </div>
        </div>
      ) : (
        <motion.section
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {filteredMarkets.map((market) => {
            const status = getStatusString(market.account.status);
            const prob = getImpliedProbability(market.account.yesPoolLamports, market.account.noPoolLamports);
            const timeRemaining = getTimeRemaining(market.account.endTs);
            const category = getCategoryString(market.account.category);
            const volumeSol = (
              market.account.yesPoolLamports.toNumber() + 
              market.account.noPoolLamports.toNumber()
            ) / 1e9;
            const key = market.publicKey.toBase58();
            const isWatched = watchlist.has(key);

            return (
              <motion.div
                key={key}
                variants={scaleIn}
                className="board-panel board-panel-interactive p-5 flex flex-col h-full justify-between gap-5"
              >
                {/* Top Metas */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 text-[9px] font-bold font-mono uppercase tracking-wider rounded bg-[#2D3142]/40 border border-[#2D3142] text-[#808495]">
                      {category}
                    </span>
                    
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => { e.preventDefault(); toggleWatchlist(key); }}
                        className="cursor-pointer p-0.5 hover:bg-white/5 rounded text-[#808495] hover:text-[#FFA500]"
                      >
                        <Star
                          className={`w-3.5 h-3.5 ${isWatched ? "text-[#FFA500] fill-[#FFA500] star-pop" : ""}`}
                        />
                      </button>
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        status === "Open" ? "bg-[#235A34]" : status === "Settled" ? "bg-[#808495]" : "bg-[#8E2424]"
                      }`}></span>
                      <span className="text-[9px] font-mono text-[#808495] uppercase font-bold">
                        {status}
                      </span>
                    </div>
                  </div>

                  <Link href={`/market/${key}`}>
                    <h3 className="text-sm font-bold font-display hover:text-[#FFA500] transition-colors leading-snug line-clamp-3">
                      {market.account.question}
                    </h3>
                  </Link>
                </div>

                {/* Segmented Weight display */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                    <span className="text-[#235A34]">YES: {prob.yes}%</span>
                    <span className="text-[#8E2424]">NO: {prob.no}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-[#8E2424] rounded overflow-hidden flex border border-[#050608]">
                    <div className="h-full bg-[#235A34]" style={{ width: `${prob.yes}%` }}></div>
                  </div>
                </div>

                {/* Meta details footer */}
                <div className="pt-3 border-t border-[#2D3142] flex items-center justify-between gap-2 text-[10px] font-mono text-[#808495]">
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#808495]" />
                    <span>{timeRemaining}</span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <Coins className="w-3.5 h-3.5 text-[#FFA500]" />
                    <span className="font-bold text-[#F4F4F9]">{volumeSol.toFixed(1)} SOL</span>
                  </div>
                </div>

                <Link href={`/market/${key}`} className="w-full">
                  <button className="w-full py-2 bg-[#050608] hover:bg-[#0C0D12] border border-[#2D3142] text-[10px] font-bold uppercase tracking-wider font-display rounded text-[#F4F4F9] hover:border-[#FFA500] transition-all cursor-pointer">
                    Inspect Specs
                  </button>
                </Link>
              </motion.div>
            );
          })}
        </motion.section>
      )}

      {/* 6. Static How It Works section */}
      <HowItWorks />
    </div>
  );
}

const Home = dynamic(() => Promise.resolve(HomePage), { ssr: false });
export default Home;
