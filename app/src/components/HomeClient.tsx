"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { LabelLux } from "@/components/ui/label-lux";
import { Rule } from "@/components/ui/rule";
import { Stat } from "@/components/ui/stat";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { TimeLeft } from "@/components/ui/time-left";
import { MarketCard } from "@/components/MarketCard";
import { WatchlistExpiryChecker } from "@/components/WatchlistExpiryChecker";
import type { UiMarket } from "@/lib/market-adapter";
import { useMarkets } from "@/hooks/useMarkets";
import { usePlatformStats, type PlatformStats } from "@/hooks/usePlatformStats";
import { onChainMarketsToUi } from "@/lib/market-adapter";
import type { MarketCacheEntry } from "@/lib/db/markets-store";

export default function HomeClient({
  initialMarkets,
  initialStats,
}: {
  initialMarkets: MarketCacheEntry[];
  initialStats: PlatformStats | null;
}) {
  const router = useRouter();
  const { markets: onChainMarkets, loading } = useMarkets(10_000, initialMarkets);

  const MARKETS: UiMarket[] = useMemo(
    () => onChainMarketsToUi(onChainMarkets ?? []),
    [onChainMarkets],
  );

  const openMarket = (m: UiMarket) => {
    router.push(`/market/${m.id}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-void text-ivory">
      <WatchlistExpiryChecker markets={initialMarkets.map(m => ({
        marketPubkey: m.marketPubkey,
        marketId: m.marketId,
        question: m.question,
        status: m.status,
        endTs: m.endTs instanceof Date ? m.endTs.toISOString() : String(m.endTs),
      }))} />
      <HomeHero markets={MARKETS} onOpenMarket={openMarket} initialStats={initialStats} loading={loading && MARKETS.length === 0} />
      <main className="mx-auto w-full max-w-[1240px] px-6 pt-8 pb-16">
        <HomeSections
          markets={MARKETS}
          onOpenMarket={openMarket}
          loading={loading && MARKETS.length === 0}
          initialStats={initialStats}
        />
      </main>
    </div>
  );
}

function HomeHero(props: HeroProps) {
  const { loading } = props;
  if (loading) {
    return (
      <section className="py-16 md:py-20">
        <div className="mx-auto w-full max-w-[1240px] px-6">
          <div className="w-32 h-3 bg-panel-2 rounded shimmer" />
          <div className="mt-6 w-2/3 h-16 bg-panel-2 rounded shimmer" />
          <div className="mt-3 w-full max-w-[40ch] h-12 bg-panel-2 rounded shimmer" />
        </div>
      </section>
    );
  }
  return <HeroInnards {...props} />;
}

function HeroInnards({ markets, initialStats }: Pick<HeroProps, "markets" | "initialStats">) {
  const { data: stats } = usePlatformStats(initialStats);
  const volume24hNum = stats ? Number(stats.volume24h ?? 0) : 0;

  return (
    <section className="py-16 md:py-20">
      <div className="mx-auto w-full max-w-[1240px] px-6">
        <div className="max-w-[600px]">
          <div className="flex items-center gap-2 mb-4">
            <span className="live-dot" />
            <span className="font-mono text-[10px] tracking-wider uppercase text-ash-dim">Live on Solana</span>
          </div>

          <h1
            className="font-display font-bold text-ivory mb-4"
            style={{ fontSize: "clamp(2rem, 5vw, 3rem)", lineHeight: 1.1, letterSpacing: "-0.03em" }}
          >
            Trade the future.
          </h1>

          <p className="text-[15px] text-ash leading-relaxed mb-6 max-w-[48ch]">
            Prediction markets with constant-product pricing, Pyth oracle resolution,
            and on-chain payouts. Just conviction, priced.
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-8">
            <Link href="/markets" className="btn-royale">
              Browse Markets <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/create" className="btn-outline-royale">
              Propose a Market
            </Link>
          </div>

          {stats && (
            <div className="flex flex-wrap items-center gap-4">
              <div className="hero-stat">
                <span className="font-mono text-[9px] uppercase tracking-wider text-ash-dim mb-1">Markets</span>
                <AnimatedNumber
                  value={stats.openMarkets ?? 0}
                  className="font-display font-bold text-[22px] text-ivory leading-none"
                />
              </div>
              <div className="hero-stat">
                <span className="font-mono text-[9px] uppercase tracking-wider text-ash-dim mb-1">24h Volume</span>
                <AnimatedNumber
                  value={volume24hNum}
                  decimals={1}
                  suffix=" SOL"
                  className="font-display font-bold text-[22px] text-gold-lite leading-none"
                />
              </div>
              <div className="hero-stat">
                <span className="font-mono text-[9px] uppercase tracking-wider text-ash-dim mb-1">Traders</span>
                <AnimatedNumber
                  value={stats.totalTraders ?? 0}
                  className="font-display font-bold text-[22px] text-ivory leading-none"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

type HeroProps = {
  markets: UiMarket[];
  onOpenMarket: (m: UiMarket) => void;
  loading: boolean;
  initialStats?: PlatformStats | null;
};

function HomeSections({
  markets, onOpenMarket, loading, initialStats,
}: HeroProps) {
  const { data: stats } = usePlatformStats(initialStats);
  const liveMarkets = useMemo(() => markets.slice(0, 8), [markets]);

  return (
    <div>
      {/* Live Markets */}
      <section className="rise" style={{ animationDelay: ".1s" }}>
        <div className="flex items-end justify-between mb-5">
          <div>
            <LabelLux className="mb-1">Live Markets</LabelLux>
            <h2 className="font-display text-[22px] font-semibold text-ivory">Open Positions</h2>
          </div>
          <Link
            href="/markets"
            className="group flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-ash hover:text-gold-lite transition-colors"
          >
            View all
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        {liveMarkets.length === 0 ? (
          <div className="py-12 text-center font-mono text-[12px] text-ash-dim surface">
            No open markets yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {liveMarkets.map((m, i) => (
              <MarketCard
                key={m.id}
                market={m}
                index={i}
                onClick={() => onOpenMarket(m)}
              />
            ))}
          </div>
        )}
      </section>

      <Rule className="mt-12" />

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 divide-x divide-hairline border-b border-hairline">
        <div className="py-6 pr-4">
          <Stat size="sm" label="Volume" value={`${Number(stats?.totalVolume ?? 0).toFixed(1)} SOL`} />
        </div>
        <div className="py-6 px-4">
          <Stat size="sm" label="Liquidity" value={`${Number(stats?.totalLiquidity ?? 0).toFixed(1)} SOL`} />
        </div>
        <div className="py-6 px-4">
          <Stat size="sm" label="Traders" value={String(stats?.totalTraders ?? "—")} />
        </div>
        <div className="py-6 pl-4">
          <Stat size="sm" label="Resolved" value={String(stats?.settledMarkets ?? "—")} />
        </div>
      </section>

      {/* How it works */}
      <section className="py-14">
        <LabelLux className="mb-8">How It Works</LabelLux>
        <div className="grid md:grid-cols-3 gap-10">
          {[
            {
              title: "Constant-Product Pricing",
              body: "Every trade moves a CPMM curve. You see price impact before you commit — no hidden spreads, no order book to front-run.",
            },
            {
              title: "Oracle Resolution",
              body: "Crypto markets settle against Pyth pull feeds the moment they expire. No admin discretion, no waiting for a human to press a button.",
            },
            {
              title: "On-Chain Payout",
              body: "Winning shares redeem pro-rata from the treasury. Fees are capped and visible before your order lands. Your keys, your payout.",
            },
          ].map(({ title, body }, i) => (
            <div key={i}>
              <h3 className="font-display text-[17px] font-semibold text-ivory mb-2">{title}</h3>
              <p className="text-[14px] text-ash leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
