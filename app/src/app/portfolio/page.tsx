"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { useSolPrice } from "@/hooks/useSolPrice";
import { keys } from "@/lib/api/keys";
import { LabelLux } from "@/components/ui/label-lux";
import { Stat } from "@/components/ui/stat";
import { Rule } from "@/components/ui/rule";

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
      // cache: "no-store" — never serve a stale cached positions response
      // (the previous fetch could race a just-landed trade and freeze at 0).
      const r = await fetch(`/api/user/positions?wallet=${walletStr}`, { cache: "no-store" });
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
    // Live-updating: poll every 12s so the portfolio revalues positions and
    // picks up new trades without a manual refresh. The detail page also
    // invalidates this key after every buy/sell/LP, so it refreshes instantly.
    refetchInterval: 12_000,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
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
      <main className="mx-auto w-full max-w-[1240px] px-6 py-24">
        <div className="max-w-md mx-auto text-center">
          <LabelLux className="mb-4">Portfolio</LabelLux>
          <h1 className="text-[34px] text-ivory mb-3">Connect your wallet</h1>
          <p className="text-[15px] text-ash mb-8">
            Connect a Solana wallet to view your positions and trade history.
          </p>
          <ClientWalletButton />
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-[1240px] px-6 py-24">
        <div className="space-y-10">
          <div className="w-48 h-3 bg-panel-2 skeleton-shimmer" />
          <div className="w-full h-28 bg-panel-2 skeleton-shimmer" />
          <div className="w-full h-64 bg-panel-2 skeleton-shimmer" />
        </div>
      </main>
    );
  }

  if (fetchError) {
    return (
      <main className="mx-auto w-full max-w-[1240px] px-6 py-24 text-center">
        <LabelLux className="mb-3">Data Feed Error</LabelLux>
        <p className="text-[15px] text-ash max-w-sm mx-auto">
          Failed to load portfolio data from the server. Please try again.
        </p>
      </main>
    );
  }

  const usdValue = solPrice > 0 ? (stats.netWorthSol * solPrice).toFixed(2) : null;
  const winRatePct = (stats.winRate * 100).toFixed(0);

  return (
    <main className="mx-auto w-full max-w-[1240px] px-6 py-14">
      <LabelLux className="mb-2">Portfolio</LabelLux>
      <h1 className="text-[44px] text-ivory mb-14">Position Ledger</h1>

      {/* Three large stats on one baseline, separated by vertical hairlines */}
      <section className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-hairline border-b border-hairline mb-14">
        <div className="py-10 pr-8">
          <Stat size="lg" label="Net Worth" value={`${stats.netWorthSol.toFixed(2)} SOL`} hint={usdValue ? `$${usdValue} USD` : undefined} />
        </div>
        <div className="py-10 px-8">
          <Stat size="lg" label="24h P&L" value={`${stats.pnl24hSol >= 0 ? "+" : ""}${stats.pnl24hSol.toFixed(2)} SOL`} hint={`${stats.pnl24hPct >= 0 ? "+" : ""}${stats.pnl24hPct.toFixed(2)}%`} />
        </div>
        <div className="py-10 pl-8">
          <Stat size="lg" label="Win Rate" value={`${winRatePct}%`} hint={`${positions.length} open positions`} />
        </div>
      </section>

      {categories.length > 1 && (
        <div className="flex items-center gap-5 mb-8 font-mono text-[10px] uppercase tracking-[.16em]">
          <span className="text-ash-dim">Compare</span>
          {["All", ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`cursor-pointer transition-colors ${
                selectedCategory === cat ? "text-gold-lite border-b border-gold" : "text-ash hover:text-ivory"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <Rule className="mb-8" />

      {/* ACTIVE POSITIONS table */}
      <section className="mb-14">
        <LabelLux className="mb-4">Active Positions ({filteredPositions.length})</LabelLux>
        {filteredPositions.length === 0 ? (
          <p className="text-[15px] text-ash-dim py-8">
            No open positions{selectedCategory !== "All" ? ` in ${selectedCategory}` : ""}. Browse markets to start trading.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="pb-3 pr-4 font-mono text-[10px] uppercase tracking-[.18em] text-ash-dim">Market</th>
                  <th className="pb-3 pr-4 font-mono text-[10px] uppercase tracking-[.18em] text-ash-dim">Side</th>
                  <th className="pb-3 pr-4 text-right font-mono text-[10px] uppercase tracking-[.18em] text-ash-dim">Shares</th>
                  <th className="pb-3 pr-4 text-right font-mono text-[10px] uppercase tracking-[.18em] text-ash-dim">Avg Price</th>
                  <th className="pb-3 pr-4 text-right font-mono text-[10px] uppercase tracking-[.18em] text-ash-dim">Current</th>
                  <th className="pb-3 text-right font-mono text-[10px] uppercase tracking-[.18em] text-ash-dim">P&L</th>
                </tr>
              </thead>
              <tbody>
                {filteredPositions.map((p, i) => (
                  <tr key={i} className="border-b border-hairline hover:bg-panel transition-colors">
                    <td className="py-4 pr-4 font-display text-[15px] text-ivory max-w-xs truncate">
                      {p.question}
                    </td>
                    <td className={`py-4 pr-4 font-mono text-[13px] ${p.side === "YES" ? "text-verdigris" : "text-bordeaux"}`}>
                      {p.side}
                    </td>
                    <td className="py-4 pr-4 text-right font-mono tnum text-[13px] text-ash">{p.shares.toFixed(2)}</td>
                    <td className="py-4 pr-4 text-right font-mono tnum text-[13px] text-ash">{p.avgPriceSol.toFixed(3)}</td>
                    <td className="py-4 pr-4 text-right font-mono tnum text-[13px] text-ivory">{p.currentPriceSol.toFixed(3)}</td>
                    <td className={`py-4 text-right font-mono tnum text-[13px] ${p.pnlSol >= 0 ? "text-verdigris" : "text-bordeaux"}`}>
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
      </section>

      {/* LIQUIDITY positions table */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <LabelLux>Liquidity Positions ({filteredLp.length})</LabelLux>
          <span className="font-mono text-[10px] text-ash-dim uppercase tracking-[.16em]">Fees tracked on-chain</span>
        </div>
        {filteredLp.length === 0 ? (
          <p className="text-[15px] text-ash-dim py-8">
            No liquidity provided{selectedCategory !== "All" ? ` in ${selectedCategory}` : ""}. Visit any market&apos;s LP tab to deposit seed liquidity and earn trading fee yield.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="pb-3 pr-4 font-mono text-[10px] uppercase tracking-[.18em] text-ash-dim">Market</th>
                  <th className="pb-3 pr-4 text-right font-mono text-[10px] uppercase tracking-[.18em] text-ash-dim">Deposited SOL</th>
                  <th className="pb-3 pr-4 text-right font-mono text-[10px] uppercase tracking-[.18em] text-ash-dim">LP Tokens</th>
                  <th className="pb-3 pr-4 text-right font-mono text-[10px] uppercase tracking-[.18em] text-ash-dim">Est. Fee Yield</th>
                  <th className="pb-3 pr-4 text-right font-mono text-[10px] uppercase tracking-[.18em] text-ash-dim">APY</th>
                  <th className="pb-3 text-right font-mono text-[10px] uppercase tracking-[.18em] text-ash-dim">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredLp.map((lp, i) => (
                  <tr key={i} className="border-b border-hairline hover:bg-panel transition-colors">
                    <td className="py-4 pr-4 font-display text-[15px] text-ivory max-w-xs truncate">{lp.question}</td>
                    <td className="py-4 pr-4 text-right font-mono tnum text-[13px] text-ivory">{lp.amountSol.toFixed(2)} SOL</td>
                    <td className="py-4 pr-4 text-right font-mono tnum text-[13px] text-gold-lite">{lp.lpTokens.toLocaleString()} LP</td>
                    <td className="py-4 pr-4 text-right font-mono tnum text-[13px] text-verdigris">{lp.estFeeEarnedSol > 0 ? `+${lp.estFeeEarnedSol.toFixed(3)} SOL` : "—"}</td>
                    <td className="py-4 pr-4 text-right font-mono tnum text-[13px] text-gold-lite">{lp.apy}</td>
                    <td className="py-4 text-right">
                      <a
                        href={`/market/${lp.marketPubkey}`}
                        className="inline-block px-3 py-1.5 rounded-[2px] border border-gold/40 text-gold-lite hover:bg-gold/10 font-mono text-[10px] uppercase tracking-[.16em] transition-colors"
                      >
                        Manage
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
