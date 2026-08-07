"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { useSolPrice } from "@/hooks/useSolPrice";
import { keys } from "@/lib/api/keys";

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

export default function DashboardPage() {
  const { publicKey } = useWallet();
  const { solPrice } = useSolPrice();
  const [positions, setPositions] = useState<Position[]>([]);
  const [lpPositions, setLpPositions] = useState<LpPosition[]>([]);
  const [stats, setStats] = useState<PortfolioStats>({
    netWorthSol: 0, pnl24hSol: 0, pnl24hPct: 0, winRate: 0,
  });

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

  const winningPositions = positions.filter((p) => p.pnlSol > 0).length;
  const losingPositions = positions.filter((p) => p.pnlSol < 0).length;
  const yesCount = positions.filter((p) => p.side === "YES").length;
  const noCount = positions.filter((p) => p.side === "NO").length;

  if (!publicKey) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="holo-card p-12 text-center max-w-md mx-auto">
          <ClientWalletButton />
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="holo-card p-12 text-center text-[#808495] animate-pulse">Loading dashboard...</div>
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
            <p className="text-xs max-w-sm mx-auto">Failed to load dashboard data from the server. Please try again.</p>
          </div>
        </div>
      </main>
    );
  }

  const usdValue = solPrice > 0 ? (stats.netWorthSol * solPrice).toFixed(2) : null;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">
          <span className="text-gradient">Dashboard</span>
        </h1>
        <p className="text-[#808495]">Your personal analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="holo-card p-5">
          <p className="text-xs text-[#808495] uppercase tracking-wider mb-2">Net Worth</p>
          <p className="font-display text-2xl font-bold text-[#F4F4F9]">{stats.netWorthSol.toFixed(2)} SOL</p>
          {usdValue && <p className="text-xs text-[#808495] mt-1">${usdValue} USD</p>}
        </div>
        <div className="holo-card p-5">
          <p className="text-xs text-[#808495] uppercase tracking-wider mb-2">24h P&L</p>
          <p className={`font-display text-2xl font-bold ${stats.pnl24hSol >= 0 ? "text-[#4CAF50]" : "text-[#E4574A]"}`}>
            {stats.pnl24hSol >= 0 ? "+" : ""}{stats.pnl24hSol.toFixed(2)} SOL
          </p>
          <p className={`text-xs mt-1 ${stats.pnl24hPct >= 0 ? "text-[#4CAF50]" : "text-[#E4574A]"}`}>
            {stats.pnl24hPct >= 0 ? "+" : ""}{stats.pnl24hPct.toFixed(2)}%
          </p>
        </div>
        <div className="holo-card p-5">
          <p className="text-xs text-[#808495] uppercase tracking-wider mb-2">Win Rate</p>
          <p className="font-display text-2xl font-bold text-[#F4F4F9]">{(stats.winRate * 100).toFixed(0)}%</p>
          <div className="w-full h-1.5 bg-white/5 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#FFA500] to-[#FFA500] rounded-full" style={{ width: `${stats.winRate * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 holo-card p-6">
          <h3 className="font-display text-lg font-bold text-[#F4F4F9] mb-6">
            Active Positions ({positions.length})
          </h3>
          {positions.length === 0 ? (
            <p className="text-center text-[#808495] py-8">No open positions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-[#808495] uppercase tracking-wider border-b border-white/5">
                    <th className="pb-3 pr-4">Market</th>
                    <th className="pb-3 pr-4">Side</th>
                    <th className="pb-3 pr-4 text-right">Shares</th>
                    <th className="pb-3 pr-4 text-right">Avg Entry</th>
                    <th className="pb-3 pr-4 text-right">Current</th>
                    <th className="pb-3 pr-4 text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((p, i) => (
                    <tr key={i} className="border-b border-white/5 text-sm hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 pr-4 font-medium text-[#F4F4F9] max-w-xs truncate">{p.question}</td>
                      <td className="py-4 pr-4">
                        <span className={`text-xs font-bold ${p.side === "YES" ? "text-[#4CAF50]" : "text-[#E4574A]"}`}>{p.side}</span>
                      </td>
                      <td className="py-4 pr-4 text-right font-mono text-[#808495]">{p.shares.toFixed(2)}</td>
                      <td className="py-4 pr-4 text-right font-mono text-[#808495]">{p.avgPriceSol.toFixed(3)}</td>
                      <td className="py-4 pr-4 text-right font-mono text-[#808495]">{p.currentPriceSol.toFixed(3)}</td>
                      <td className={`py-4 pr-4 text-right font-mono font-bold ${p.pnlSol >= 0 ? "text-[#4CAF50]" : "text-[#E4574A]"}`}>
                        {p.pnlSol >= 0 ? "+" : ""}{p.pnlSol.toFixed(3)}
                        <span className="block text-[10px] opacity-70">({p.pnlPercent >= 0 ? "+" : ""}{p.pnlPercent.toFixed(1)}%)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* LP Tokens & Yield Section */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <h3 className="font-display text-lg font-bold text-[#F4F4F9] mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">💧 Liquidity Positions & LP Tokens</span>
              {lpPositions.some((lp) => lp.estFeeEarnedSol > 0) ? (
                <span className="text-xs bg-[#4CAF50]/10 text-[#4CAF50] px-2 py-0.5 rounded border border-[#4CAF50]/30 font-mono font-normal">
                  Earning LP Fees
                </span>
              ) : (
                <span className="text-xs bg-white/5 text-[#808495] px-2 py-0.5 rounded border border-white/10 font-mono font-normal">
                  Fees tracked on-chain
                </span>
              )}
            </h3>

            {lpPositions.length === 0 ? (
              <p className="text-sm text-[#808495]">No liquidity provided yet. Visit any market&apos;s LP tab to deposit reserves and earn trading fees.</p>
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
                    {lpPositions.map((lp, i) => (
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
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="holo-card p-6">
            <h3 className="font-display text-lg font-bold text-[#F4F4F9] mb-4">Breakdown</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#808495]">Winning</span>
                  <span className="text-[#4CAF50]">{winningPositions}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#808495]">Losing</span>
                  <span className="text-[#E4574A]">{losingPositions}</span>
                </div>
              </div>
              <div className="border-t border-white/5 pt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#808495]">YES positions</span>
                  <span className="text-[#4CAF50]">{yesCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#808495]">NO positions</span>
                  <span className="text-[#E4574A]">{noCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="holo-card p-6">
            <h3 className="font-display text-lg font-bold text-[#F4F4F9] mb-4">Historical Data</h3>
            <p className="text-sm text-[#808495]">
              Historical data available after your first trade.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
