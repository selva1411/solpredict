"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Activity, BarChart3, ChevronRight, Layers,
  TrendingUp, Users, Zap, ArrowRight, Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarketCard } from "@/components/MarketCard";
import { MarketCardSkeleton } from "@/components/MarketCardSkeleton";
import { SplitFlapText } from "@/components/SplitFlapText";
import DualFillGauge from "@/components/DualFillGauge";
import { WatchlistExpiryChecker } from "@/components/WatchlistExpiryChecker";
import type { UiMarket } from "@/lib/market-adapter";
import { useMarkets } from "@/hooks/useMarkets";
import { usePlatformStats } from "@/hooks/usePlatformStats";
import { onChainMarketsToUi } from "@/lib/market-adapter";

export default function Home() {
  const router = useRouter();
  const { markets: onChainMarkets, loading } = useMarkets();

  const MARKETS: UiMarket[] = useMemo(
    () => onChainMarketsToUi(onChainMarkets ?? []),
    [onChainMarkets],
  );

  const openMarket = (m: UiMarket) => {
    router.push(`/market/${m.id}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface-0)] text-[var(--color-gray-100)]">
      <WatchlistExpiryChecker />
      <Ticker markets={MARKETS} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-12">
        <HomeView
          markets={MARKETS}
          onOpenMarket={openMarket}
          loading={loading && MARKETS.length === 0}
        />
      </main>
    </div>
  );
}

function Ticker({ markets }: { markets: UiMarket[] }) {
  const top = markets.slice(0, 8);
  if (top.length === 0) return null;
  const doubled = [...top, ...top];

  return (
    <div className="relative border-b border-[var(--color-gray-800)] bg-[var(--surface-1)] py-2.5 overflow-hidden">
      <div className="flex items-center gap-6 animate-none overflow-x-auto no-scrollbar px-4 font-mono text-xs">
        <div className="flex items-center gap-2 px-2 py-0.5 rounded bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] font-bold text-[10px] uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
          Terminal Ticker
        </div>
        <div className="flex items-center gap-8 whitespace-nowrap">
          {doubled.map((m, i) => {
            const pct = m.yesPrice * 100;
            const isUp = m.yesPrice >= 0.5;
            return (
              <div key={i} className="flex items-center gap-2 font-mono">
                <span className="text-[var(--color-gray-400)]">{m.question.slice(0, 30)}...</span>
                <span className={`font-bold ${isUp ? "text-[var(--accent)]" : "text-[var(--negative)]"}`}>
                  {pct.toFixed(1)}%
                </span>
                <span className="text-[var(--color-gray-700)]">|</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HomeView({
  markets, onOpenMarket, loading,
}: {
  markets: UiMarket[];
  onOpenMarket: (m: UiMarket) => void;
  loading: boolean;
}) {
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = usePlatformStats();

  const featured = markets[0];
  const trending = markets.slice(0, 4);

  if (loading) {
    return (
      <div className="space-y-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="terminal-card p-5 h-24 skeleton-box" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <MarketCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative pt-4 pb-8 text-center max-w-4xl mx-auto space-y-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface-1)] border border-[var(--accent)]/30 text-xs font-mono text-[var(--color-gray-300)] glow-gold">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
          Solana Localnet · Pyth Oracle · LMSR Pricing Engine
        </div>

        <div className="space-y-4">
          <h1 className="font-display text-4xl sm:text-6xl font-bold tracking-tight text-gradient-gold">
            Institutional Solana Prediction Terminal
          </h1>
          <p className="text-base sm:text-lg text-[var(--color-gray-400)] max-w-2xl mx-auto leading-relaxed">
            Sub-second finality, exact LMSR mathematical odds, and continuous liquidity routing.
          </p>
        </div>

        {/* Departure-Board Hardware centerpiece */}
        {featured && (
          <div className="terminal-card p-6 sm:p-8 max-w-2xl mx-auto space-y-6 text-left border-[var(--accent)]/25 glow-gold">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="border-[var(--accent)]/40 text-[var(--accent)] bg-[var(--accent)]/10 font-mono text-xs">
                SPOTLIGHT MARKET
              </Badge>
              <div className="text-xs font-mono text-[var(--color-gray-400)] flex items-center gap-1">
                <Clock size={12} /> {mTimeLeft(featured.endDate)}
              </div>
            </div>

            <h3 className="font-display text-xl sm:text-2xl font-bold text-[var(--color-gray-100)]">
              {featured.question}
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[var(--accent)] font-bold glow-gold-text">YES RATE</span>
                <div className="text-2xl font-bold font-mono text-[var(--color-gray-100)]">
                  <SplitFlapText text={`${(featured.yesPrice * 100).toFixed(0)}%`} />
                </div>
                <span className="text-[var(--negative)] font-bold">NO RATE</span>
              </div>
              <DualFillGauge yesPrice={featured.yesPrice} noPrice={featured.noPrice} />
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                onClick={() => onOpenMarket(featured)}
                className="btn-terminal-primary"
              >
                Trade Market <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link href="/markets">
            <Button className="btn-terminal-primary h-11 px-6">
              <Zap size={16} /> Browse All Markets
            </Button>
          </Link>
          <Link href="/leaderboard">
            <Button className="btn-terminal-secondary h-11 px-6">
              Leaderboard Rankings
            </Button>
          </Link>
        </div>
      </section>

      {/* Metric Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile label="24h Platform Volume" value={stats ? `${Number(stats.totalVolume).toFixed(2)} SOL` : statsError ? "—" : statsLoading ? "..." : "—"} icon={Activity} />
        <StatTile label="Total Liquidity" value={stats ? `${Number(stats.totalLiquidity).toFixed(2)} SOL` : statsError ? "—" : statsLoading ? "..." : "—"} icon={Layers} />
        <StatTile label="Active Traders" value={stats ? Number(stats.totalTraders).toLocaleString() : statsError ? "—" : statsLoading ? "..." : "—"} icon={Users} />
        <StatTile label="Open Markets" value={stats ? Number(stats.openMarkets).toLocaleString() : statsError ? "—" : statsLoading ? "..." : "—"} icon={BarChart3} />
      </section>

      {/* Trending Markets */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp size={18} className="text-[var(--accent)]" />
            <h2 className="font-display text-xl font-bold text-[var(--color-gray-100)]">Trending Markets</h2>
          </div>
          <Link href="/markets">
            <Button variant="ghost" size="sm" className="text-[var(--accent)] hover:bg-[var(--accent)]/10 font-mono text-xs">
              View All <ChevronRight size={14} />
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {trending.map((m, i) => (
            <MarketCard key={m.id} market={m} index={i} onClick={() => onOpenMarket(m)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="terminal-card holo-card p-5 space-y-2">
      <div className="flex items-center justify-between text-xs font-mono text-[var(--color-gray-400)] uppercase">
        <span>{label}</span>
        <Icon size={14} className="text-[var(--accent)]" />
      </div>
      <div className="font-mono text-2xl font-bold text-[var(--color-gray-100)]">
        {value}
      </div>
    </div>
  );
}

function mTimeLeft(endDateIso: string): string {
  try {
    const diff = new Date(endDateIso).getTime() - Date.now();
    if (diff <= 0) return "Ended";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h left`;
  } catch {
    return "—";
  }
}
