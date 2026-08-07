"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, Award, BarChart3, AlertTriangle, Filter } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { useSolPrice } from "@/hooks/useSolPrice";
import { keys } from "@/lib/api/keys";

interface Position {
  marketPubkey: string;
  question: string;
  category: string;
  status: string;
  side: "YES" | "NO";
  shares: number;
  avgPriceSol: number;
  currentPriceSol: number;
  valueSol: number;
  pnlSol: number;
  pnlPercent: number;
}

interface LpPosition {
  id: number;
  marketPubkey: string;
  question: string;
  category: string;
  status: string;
  amountSol: number;
  lpTokens: number;
  estFeeEarnedSol: number;
  apy: string;
}

interface PortfolioStats {
  netWorthSol: number;
  pnl24hSol: number;
  pnl24hPct: number;
  winRate: number;
}

export default function PortfolioPage() {
  const { publicKey } = useWallet();
  const { solPrice } = useSolPrice();
  const [positions, setPositions] = useState<Position[]>([]);
  const [lpPositions, setLpPositions] = useState<LpPosition[]>([]);
  const [stats, setStats] = useState<PortfolioStats>({
    netWorthSol: 0, pnl24hSol: 0, pnl24hPct: 0, winRate: 0,
  });
  const [selectedCategory, setSelectedCategory] = useState("All");

  const walletStr = publicKey?.toBase58() ?? null;

  const { isLoading, isError } = useQuery({
    queryKey: keys.user.positions(walletStr ?? "none"),
    queryFn: async () => {
      const r = await fetch(`/api/user/positions?wallet=${walletStr}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (data?.ok) {
        if (data.positions) setPositions(data.positions);
        if (data.lpPositions) setLpPositions(data.lpPositions);
        if (data.stats) setStats(data.stats);
      }
      return data;
    },
    enabled: !!walletStr,
    staleTime: 15_000,
  });
  const loading = !!walletStr ? isLoading : false;
  const fetchError = !!walletStr ? isError : false;

  const categories = useMemo(() => {
    const set = new Set<string>(positions.map((p) => p.category).concat(lpPositions.map((lp) => lp.category)));
    return Array.from(set).filter(Boolean).sort();
  }, [positions, lpPositions]);

  const filteredPositions = useMemo(
    () => selectedCategory === "All" ? positions : positions.filter((p) => p.category === selectedCategory),
    [positions, selectedCategory],
  );
  const filteredLp = useMemo(
    () => selectedCategory === "All" ? lpPositions : lpPositions.filter((lp) => lp.category === selectedCategory),
    [lpPositions, selectedCategory],
  );

  const categoryMetrics = useMemo(() => {
    const invested = filteredPositions.reduce((s, p) => s + p.avgPriceSol * p.shares, 0);
    const pnl = filteredPositions.reduce((s, p) => s + p.pnlSol, 0);
    const wins = filteredPositions.filter((p) => p.pnlSol > 0).length;
    const winRate = filteredPositions.length > 0 ? (wins / filteredPositions.length) * 100 : 0;
    return { invested, pnl, winRate };
  }, [filteredPositions]);

  if (!publicKey) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="holo-card p-12 text-center max-w-md mx-auto">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-[#FFA500]" />
          <h2 className="font-display text-xl font-bold mb-2">Connect your wallet</h2>
          <p className="text-sm text-[#808495] mb-5">
            Connect a Solana wallet to view your positions and trade history.
          </p>
          <ClientWalletButton />
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="holo-card p-12 text-center">
          <div className="animate-pulse text-[#808495]">Loading your portfolio...</div>
        </div>
      </main>
    );
  }

  if (fetchError) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="holo-card py-16 text-center text-[#808495] flex flex-col items-center justify-center space-y-4">
          <AlertTriangle className="w-12 h-12 opacity-30 text-[#E4574A]" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#F4F4F9] uppercase">Data Feed Error</h3>
            <p className="text-xs max-w-sm mx-auto">Failed to load portfolio data from the server. Please try again.</p>
          </div>
        </div>
      </main>
    );
  }

  const usdValue = solPrice > 0 ? (stats.netWorthSol * solPrice).toFixed(2) : null;

  const statCards = [
    { label: "Net Worth", value: `${stats.netWorthSol.toFixed(2)} SOL`, sub: usdValue ? `$${usdValue} USD` : undefined, icon: Wallet, color: "#FFA500" },
    { label: "24h P&L", value: `${stats.pnl24hSol >= 0 ? "+" : ""}${stats.pnl24hSol.toFixed(2)} SOL`, sub: `${stats.pnl24hPct >= 0 ? "+" : ""}${stats.pnl24hPct.toFixed(2)}%`, icon: TrendingUp, color: stats.pnl24hSol >= 0 ? "#4CAF50" : "#E4574A" },
    { label: "Win Rate", value: `${(stats.winRate * 100).toFixed(0)}%`, icon: Award, color: "#FFA500" },
    { label: "Positions", value: `${positions.length}`, icon: BarChart3, color: "#FFA500" },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">
          <span className="text-gradient">Portfolio</span>
        </h1>
        <p className="text-[#808495]">Your positions and performance</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="holo-card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-[#808495] uppercase tracking-wider">{card.label}</p>
                <Icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
              <p className="font-display text-xl font-bold" style={{ color: card.color }}>
                {card.value}
              </p>
              {card.sub && <p className="text-xs text-[#808495] mt-1">{card.sub}</p>}
            </div>
          );
        })}
      </div>

      {categories.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="flex items-center gap-1.5 text-xs text-[#808495] uppercase tracking-wider mr-1">
              <Filter className="w-3.5 h-3.5" /> Compare:
            </span>
            <button onClick={() => setSelectedCategory("All")}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCategory === "All" ? "bg-[#FFA500] text-white" : "text-[#808495] border border-white/10 hover:border-[#FFA500]/50"}`}>
              All Categories
            </button>
            {categories.map((cat) => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${selectedCategory === cat ? "bg-[#FFA500] text-white" : "text-[#808495] border border-white/10 hover:border-[#FFA500]/50"}`}>
                {cat}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="holo-card p-4">
              <p className="text-xs text-[#808495] uppercase">Invested ({selectedCategory})</p>
              <p className="font-display text-lg font-bold text-gradient mt-1">{categoryMetrics.invested.toFixed(2)} SOL</p>
            </div>
            <div className="holo-card p-4">
              <p className="text-xs text-[#808495] uppercase">P&L ({selectedCategory})</p>
              <p className={`font-display text-lg font-bold mt-1 ${categoryMetrics.pnl >= 0 ? "text-[#4CAF50]" : "text-[#E4574A]"}`}>
                {categoryMetrics.pnl >= 0 ? "+" : ""}{categoryMetrics.pnl.toFixed(2)} SOL
              </p>
            </div>
            <div className="holo-card p-4">
              <p className="text-xs text-[#808495] uppercase">Win Rate ({selectedCategory})</p>
              <p className="font-display text-lg font-bold text-gradient mt-1">{categoryMetrics.winRate.toFixed(0)}%</p>
            </div>
          </div>
        </>
      )}

      <div className="holo-card p-6">
        <h3 className="font-display text-lg font-bold text-[#F4F4F9] mb-6">
          Active Positions ({filteredPositions.length})
        </h3>
        {filteredPositions.length === 0 ? (
          <p className="text-center text-[#808495] py-8">
            No open positions{selectedCategory !== "All" ? ` in ${selectedCategory}` : ""}. Browse markets to start trading.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-[#808495] uppercase tracking-wider border-b border-white/5">
                  <th className="pb-3 pr-4">Market</th>
                  <th className="pb-3 pr-4">Side</th>
                  <th className="pb-3 pr-4">Category</th>
                  <th className="pb-3 pr-4 text-right">Shares</th>
                  <th className="pb-3 pr-4 text-right">Avg Price</th>
                  <th className="pb-3 pr-4 text-right">Current</th>
                  <th className="pb-3 pr-4 text-right">P&L</th>
                </tr>
              </thead>
              <tbody>
                {filteredPositions.map((p, i) => (
                  <tr key={i} className="border-b border-white/5 text-sm hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 pr-4 font-medium text-[#F4F4F9] max-w-xs truncate">
                      {p.question}
                    </td>
                    <td className="py-4 pr-4">
                      <span className={`text-xs font-bold ${p.side === "YES" ? "text-[#4CAF50]" : "text-[#E4574A]"}`}>
                        {p.side}
                      </span>
                    </td>
                    <td className="py-4 pr-4">
                      <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-[#808495]">{p.category || "Other"}</span>
                    </td>
                    <td className="py-4 pr-4 text-right font-mono text-[#808495]">{p.shares.toFixed(2)}</td>
                    <td className="py-4 pr-4 text-right font-mono text-[#808495]">{p.avgPriceSol.toFixed(3)}</td>
                    <td className="py-4 pr-4 text-right font-mono text-[#808495]">{p.currentPriceSol.toFixed(3)}</td>
                    <td className={`py-4 pr-4 text-right font-mono font-bold ${p.pnlSol >= 0 ? "text-[#4CAF50]" : "text-[#E4574A]"}`}>
                      {p.pnlSol >= 0 ? "+" : ""}{p.pnlSol.toFixed(3)}
                      <span className="block text-[10px] opacity-70">
                        ({p.pnlPercent >= 0 ? "+" : ""}{p.pnlPercent.toFixed(1)}%)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LP Tokens & Liquidity Positions Section */}
      <div className="holo-card p-6 mt-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <BarChart3 className="w-5 h-5 text-[#FFA500]" />
            <h3 className="font-display text-lg font-bold text-[#F4F4F9]">
              Liquidity Positions & LP Tokens ({filteredLp.length})
            </h3>
          </div>
          <span className="text-xs bg-white/5 text-[#808495] px-2.5 py-1 rounded border border-white/10 font-mono font-normal">
            Fees tracked on-chain
          </span>
        </div>

        {filteredLp.length === 0 ? (
          <p className="text-center text-[#808495] py-8">
            No liquidity provided{selectedCategory !== "All" ? ` in ${selectedCategory}` : ""}. Visit any market&apos;s LP tab to deposit seed liquidity and earn trading fee yield.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-[#808495] uppercase tracking-wider border-b border-white/5">
                  <th className="pb-3 pr-4">Market</th>
                  <th className="pb-3 pr-4 text-right">Deposited SOL</th>
                  <th className="pb-3 pr-4 text-right">LP Tokens</th>
                  <th className="pb-3 pr-4 text-right">Est. Fee Yield</th>
                  <th className="pb-3 pr-4 text-right">APY</th>
                  <th className="pb-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLp.map((lp, i) => (
                  <tr key={i} className="border-b border-white/5 text-sm hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 pr-4 font-medium text-[#F4F4F9] max-w-xs truncate">{lp.question}</td>
                    <td className="py-4 pr-4 text-right font-mono text-[#F4F4F9] font-bold">{lp.amountSol.toFixed(2)} SOL</td>
                    <td className="py-4 pr-4 text-right font-mono text-[#FFA500] font-bold">{lp.lpTokens.toLocaleString()} LP</td>
                    <td className="py-4 pr-4 text-right font-mono text-[#4CAF50] font-bold">{lp.estFeeEarnedSol > 0 ? `+${lp.estFeeEarnedSol.toFixed(3)} SOL` : "\u2014"}</td>
                    <td className="py-4 pr-4 text-right font-mono text-[#FFA500]">{lp.apy}</td>
                    <td className="py-4 pr-4 text-right">
                      <a
                        href={`/market/${lp.marketPubkey}`}
                        className="inline-block px-3 py-1 bg-[#FFA500]/10 text-[#FFA500] hover:bg-[#FFA500]/20 text-xs font-bold rounded border border-[#FFA500]/40 transition-colors"
                      >
                        Manage LP
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
