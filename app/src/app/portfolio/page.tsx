"use client";

import { useState, useEffect } from "react";
import { Wallet, TrendingUp, Award, BarChart3, AlertTriangle } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { useSolPrice } from "@/hooks/useSolPrice";

interface Position {
  marketPubkey: string;
  question: string;
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
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (!publicKey) { setLoading(false); return; }
    setLoading(true);
    setFetchError(false);
    fetch(`/api/user/positions?wallet=${publicKey.toBase58()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          if (data.positions) setPositions(data.positions);
          if (data.lpPositions) setLpPositions(data.lpPositions);
          if (data.stats) setStats(data.stats);
        }
      })
      .catch(() => { setFetchError(true); })
      .finally(() => setLoading(false));
  }, [publicKey]);

  if (!publicKey) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="holo-card p-12 text-center max-w-md mx-auto">
          <Wallet className="w-12 h-12 mx-auto mb-4 text-[#7B3FE4]" />
          <h2 className="font-display text-xl font-bold mb-2">Connect your wallet</h2>
          <p className="text-sm text-[#A5A8B8] mb-5">
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
          <div className="animate-pulse text-[#A5A8B8]">Loading your portfolio...</div>
        </div>
      </main>
    );
  }

  if (fetchError) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="holo-card py-16 text-center text-[#A5A8B8] flex flex-col items-center justify-center space-y-4">
          <AlertTriangle className="w-12 h-12 opacity-30 text-[#FF4D6D]" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#F4F5FA] uppercase">Data Feed Error</h3>
            <p className="text-xs max-w-sm mx-auto">Failed to load portfolio data from the server. Please try again.</p>
          </div>
        </div>
      </main>
    );
  }

  const usdValue = solPrice > 0 ? (stats.netWorthSol * solPrice).toFixed(2) : null;

  const statCards = [
    { label: "Net Worth", value: `${stats.netWorthSol.toFixed(2)} SOL`, sub: usdValue ? `$${usdValue} USD` : undefined, icon: Wallet, color: "#00E5FF" },
    { label: "24h P&L", value: `${stats.pnl24hSol >= 0 ? "+" : ""}${stats.pnl24hSol.toFixed(2)} SOL`, sub: `${stats.pnl24hPct >= 0 ? "+" : ""}${stats.pnl24hPct.toFixed(2)}%`, icon: TrendingUp, color: stats.pnl24hSol >= 0 ? "#C8FF00" : "#FF4D6D" },
    { label: "Win Rate", value: `${(stats.winRate * 100).toFixed(0)}%`, icon: Award, color: "#7B3FE4" },
    { label: "Positions", value: `${positions.length}`, icon: BarChart3, color: "#00E5FF" },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">
          <span className="text-gradient">Portfolio</span>
        </h1>
        <p className="text-[#A5A8B8]">Your positions and performance</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="holo-card p-5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-[#A5A8B8] uppercase tracking-wider">{card.label}</p>
                <Icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
              <p className="font-display text-xl font-bold" style={{ color: card.color }}>
                {card.value}
              </p>
              {card.sub && <p className="text-xs text-[#A5A8B8] mt-1">{card.sub}</p>}
            </div>
          );
        })}
      </div>

      <div className="holo-card p-6">
        <h3 className="font-display text-lg font-bold text-[#F4F5FA] mb-6">
          Active Positions ({positions.length})
        </h3>
        {positions.length === 0 ? (
          <p className="text-center text-[#A5A8B8] py-8">
            No open positions. Browse markets to start trading.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-[#A5A8B8] uppercase tracking-wider border-b border-white/5">
                  <th className="pb-3 pr-4">Market</th>
                  <th className="pb-3 pr-4">Side</th>
                  <th className="pb-3 pr-4 text-right">Shares</th>
                  <th className="pb-3 pr-4 text-right">Avg Price</th>
                  <th className="pb-3 pr-4 text-right">Current</th>
                  <th className="pb-3 pr-4 text-right">P&L</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p, i) => (
                  <tr key={i} className="border-b border-white/5 text-sm hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 pr-4 font-medium text-[#F4F5FA] max-w-xs truncate">
                      {p.question}
                    </td>
                    <td className="py-4 pr-4">
                      <span className={`text-xs font-bold ${p.side === "YES" ? "text-[#C8FF00]" : "text-[#FF4D6D]"}`}>
                        {p.side}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-right font-mono text-[#A5A8B8]">{p.shares.toFixed(2)}</td>
                    <td className="py-4 pr-4 text-right font-mono text-[#A5A8B8]">{p.avgPriceSol.toFixed(3)}</td>
                    <td className="py-4 pr-4 text-right font-mono text-[#A5A8B8]">{p.currentPriceSol.toFixed(3)}</td>
                    <td className={`py-4 pr-4 text-right font-mono font-bold ${p.pnlSol >= 0 ? "text-[#C8FF00]" : "text-[#FF4D6D]"}`}>
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
            <BarChart3 className="w-5 h-5 text-[#00E5FF]" />
            <h3 className="font-display text-lg font-bold text-[#F4F5FA]">
              Liquidity Positions & LP Tokens ({lpPositions.length})
            </h3>
          </div>
          <span className="text-xs bg-[#00E5FF]/10 text-[#00E5FF] px-2.5 py-1 rounded border border-[#00E5FF]/30 font-mono font-normal">
            Earning 2% Trade Fees
          </span>
        </div>

        {lpPositions.length === 0 ? (
          <p className="text-center text-[#A5A8B8] py-8">
            No liquidity provided yet. Visit any market&apos;s LP tab to deposit seed liquidity and earn trading fee yield.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-[#A5A8B8] uppercase tracking-wider border-b border-white/5">
                  <th className="pb-3 pr-4">Market</th>
                  <th className="pb-3 pr-4 text-right">Deposited SOL</th>
                  <th className="pb-3 pr-4 text-right">LP Tokens</th>
                  <th className="pb-3 pr-4 text-right">Est. Fee Yield</th>
                  <th className="pb-3 pr-4 text-right">APY</th>
                  <th className="pb-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {lpPositions.map((lp, i) => (
                  <tr key={i} className="border-b border-white/5 text-sm hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 pr-4 font-medium text-[#F4F5FA] max-w-xs truncate">{lp.question}</td>
                    <td className="py-4 pr-4 text-right font-mono text-[#F4F5FA] font-bold">{lp.amountSol.toFixed(2)} SOL</td>
                    <td className="py-4 pr-4 text-right font-mono text-[#00E5FF] font-bold">{lp.lpTokens.toLocaleString()} LP</td>
                    <td className="py-4 pr-4 text-right font-mono text-[#C8FF00] font-bold">+{lp.estFeeEarnedSol.toFixed(3)} SOL</td>
                    <td className="py-4 pr-4 text-right font-mono text-[#00E5FF]">{lp.apy}</td>
                    <td className="py-4 pr-4 text-right">
                      <a
                        href={`/market/${lp.marketPubkey}`}
                        className="inline-block px-3 py-1 bg-[#00E5FF]/10 text-[#00E5FF] hover:bg-[#00E5FF]/20 text-xs font-bold rounded border border-[#00E5FF]/40 transition-colors"
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
