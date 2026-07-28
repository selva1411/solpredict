"use client";

import { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
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
        if (data.ok && data.positions) {
          setPositions(data.positions);
          if (data.stats) setStats(data.stats);
        }
      })
      .catch(() => { setFetchError(true); })
      .finally(() => setLoading(false));
  }, [publicKey]);

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
        <div className="holo-card p-12 text-center text-[#A5A8B8] animate-pulse">Loading dashboard...</div>
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
        <p className="text-[#A5A8B8]">Your personal analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="holo-card p-5">
          <p className="text-xs text-[#A5A8B8] uppercase tracking-wider mb-2">Net Worth</p>
          <p className="font-display text-2xl font-bold text-[#F4F5FA]">{stats.netWorthSol.toFixed(2)} SOL</p>
          {usdValue && <p className="text-xs text-[#A5A8B8] mt-1">${usdValue} USD</p>}
        </div>
        <div className="holo-card p-5">
          <p className="text-xs text-[#A5A8B8] uppercase tracking-wider mb-2">24h P&L</p>
          <p className={`font-display text-2xl font-bold ${stats.pnl24hSol >= 0 ? "text-[#C8FF00]" : "text-[#FF4D6D]"}`}>
            {stats.pnl24hSol >= 0 ? "+" : ""}{stats.pnl24hSol.toFixed(2)} SOL
          </p>
          <p className={`text-xs mt-1 ${stats.pnl24hPct >= 0 ? "text-[#C8FF00]" : "text-[#FF4D6D]"}`}>
            {stats.pnl24hPct >= 0 ? "+" : ""}{stats.pnl24hPct.toFixed(2)}%
          </p>
        </div>
        <div className="holo-card p-5">
          <p className="text-xs text-[#A5A8B8] uppercase tracking-wider mb-2">Win Rate</p>
          <p className="font-display text-2xl font-bold text-[#F4F5FA]">{(stats.winRate * 100).toFixed(0)}%</p>
          <div className="w-full h-1.5 bg-white/5 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#7B3FE4] to-[#00E5FF] rounded-full" style={{ width: `${stats.winRate * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 holo-card p-6">
          <h3 className="font-display text-lg font-bold text-[#F4F5FA] mb-6">
            Active Positions ({positions.length})
          </h3>
          {positions.length === 0 ? (
            <p className="text-center text-[#A5A8B8] py-8">No open positions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs text-[#A5A8B8] uppercase tracking-wider border-b border-white/5">
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
                      <td className="py-4 pr-4 font-medium text-[#F4F5FA] max-w-xs truncate">{p.question}</td>
                      <td className="py-4 pr-4">
                        <span className={`text-xs font-bold ${p.side === "YES" ? "text-[#C8FF00]" : "text-[#FF4D6D]"}`}>{p.side}</span>
                      </td>
                      <td className="py-4 pr-4 text-right font-mono text-[#A5A8B8]">{p.shares.toFixed(2)}</td>
                      <td className="py-4 pr-4 text-right font-mono text-[#A5A8B8]">{p.avgPriceSol.toFixed(3)}</td>
                      <td className="py-4 pr-4 text-right font-mono text-[#A5A8B8]">{p.currentPriceSol.toFixed(3)}</td>
                      <td className={`py-4 pr-4 text-right font-mono font-bold ${p.pnlSol >= 0 ? "text-[#C8FF00]" : "text-[#FF4D6D]"}`}>
                        {p.pnlSol >= 0 ? "+" : ""}{p.pnlSol.toFixed(3)}
                        <span className="block text-[10px] opacity-70">({p.pnlPercent >= 0 ? "+" : ""}{p.pnlPercent.toFixed(1)}%)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="holo-card p-6">
            <h3 className="font-display text-lg font-bold text-[#F4F5FA] mb-4">Breakdown</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#A5A8B8]">Winning</span>
                  <span className="text-[#C8FF00]">{winningPositions}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#A5A8B8]">Losing</span>
                  <span className="text-[#FF4D6D]">{losingPositions}</span>
                </div>
              </div>
              <div className="border-t border-white/5 pt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-[#A5A8B8]">YES positions</span>
                  <span className="text-[#C8FF00]">{yesCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#A5A8B8]">NO positions</span>
                  <span className="text-[#FF4D6D]">{noCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="holo-card p-6">
            <h3 className="font-display text-lg font-bold text-[#F4F5FA] mb-4">Historical Data</h3>
            <p className="text-sm text-[#A5A8B8]">
              Historical data available after your first trade.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
