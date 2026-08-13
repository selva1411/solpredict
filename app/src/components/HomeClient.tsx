"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LabelLux } from "@/components/ui/label-lux";
import { Rule } from "@/components/ui/rule";
import { Stat } from "@/components/ui/stat";
import { Panel } from "@/components/ui/panel";
import { ButtonLux } from "@/components/ui/button-lux";
import { WatchlistExpiryChecker } from "@/components/WatchlistExpiryChecker";
import type { UiMarket } from "@/lib/market-adapter";
import { useMarkets } from "@/hooks/useMarkets";
import { usePlatformStats, type PlatformStats } from "@/hooks/usePlatformStats";
import { onChainMarketsToUi } from "@/lib/market-adapter";
import type { MarketCacheEntry } from "@/lib/db/markets-store";

/**
 * Client home view. Receives server-prefetched markets + stats so the first
 * paint shows real data without /api round trips; the hooks still poll.
 */
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
      <main className="mx-auto w-full max-w-[1240px] px-6 py-24 md:py-32">
        <HomeView
          markets={MARKETS}
          onOpenMarket={openMarket}
          loading={loading && MARKETS.length === 0}
          initialStats={initialStats}
        />
      </main>
    </div>
  );
}

function HomeView({
  markets, onOpenMarket, loading, initialStats,
}: {
  markets: UiMarket[];
  onOpenMarket: (m: UiMarket) => void;
  loading: boolean;
  initialStats?: PlatformStats | null;
}) {
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = usePlatformStats(initialStats);

  const liveBook = markets.slice(0, 3);

  if (loading) {
    return (
      <div className="grid md:grid-cols-12 gap-12">
        <div className="md:col-span-7 space-y-8">
          <div className="w-64 h-3 bg-panel-2 skeleton-shimmer" />
          <div className="w-3/4 h-24 bg-panel-2 skeleton-shimmer" />
          <div className="w-full max-w-[46ch] h-16 bg-panel-2 skeleton-shimmer" />
        </div>
        <div className="md:col-span-5 md:mt-24">
          <div className="surface-feature h-96 skeleton-shimmer" />
        </div>
      </div>
    );
  }

  const volume24h = stats ? `${Number(stats.volume24h).toFixed(2)} SOL` : "—";

  return (
    <div>
      {/* Asymmetric hero — 12-col, NOT centered */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-start">
        <section className="md:col-span-7 min-w-0 rise space-y-10">
          <LabelLux>Solana · On-Chain Prediction Markets</LabelLux>
          <h1 className="text-[44px] sm:text-[68px] md:text-[112px] leading-[.92] text-ivory break-words">
            Conviction,
            <span className="block italic text-gold-lite">priced.</span>
          </h1>
          <p className="max-w-[46ch] text-[15px] text-ash leading-relaxed">
            A private-bank trading terminal that settles on Solana. Constant-product
            pricing on every board, Pyth pull-oracle resolution, and payouts wired
            on-chain — no order book, no discretion.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/markets">
              <ButtonLux variant="gold" className="h-11 px-6">Enter Markets</ButtonLux>
            </Link>
            <Link href="/docs/help">
              <ButtonLux variant="quiet" className="h-11 px-6">How Settlement Works</ButtonLux>
            </Link>
          </div>
        </section>

        {/* LIVE BOOK feature panel — sits ~40px below the h1 baseline */}
        <section className="md:col-span-5 md:mt-24 min-w-0 rise">
          <Panel feature className="p-6">
            <div className="flex items-center justify-between mb-5">
              <LabelLux className="!text-ash">Live Book</LabelLux>
              <span className="font-mono text-[10px] text-ash-dim uppercase tracking-[.16em]">
                {markets.length} open
              </span>
            </div>
            <div className="divide-y divide-hairline">
              {liveBook.length === 0 ? (
                <div className="py-10 text-center font-mono text-[12px] text-ash-dim">
                  No open boards yet
                </div>
              ) : (
                liveBook.map((m, i) => {
                  const pct = (m.yesPrice * 100).toFixed(1);
                  const delta = m.yesPrice >= 0.5 ? "+" : "−";
                  return (
                    <button
                      key={m.id}
                      onClick={() => onOpenMarket(m)}
                      className="sheen group w-full flex items-baseline justify-between gap-4 py-4 text-left transition-colors hover:bg-ivory/5 px-1 -mx-1 cursor-pointer"
                    >
                      <span className="text-[15px] text-ivory truncate max-w-[60%] group-hover:text-gold-lite transition-colors">
                        {m.question}
                      </span>
                      <span className="font-mono tnum text-[15px] text-ivory">{pct}%</span>
                      <span className={`font-mono tnum text-[11px] ${m.yesPrice >= 0.5 ? "text-verdigris" : "text-bordeaux"}`}>
                        {delta} {i === 0 ? "YES" : "NO"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </Panel>
        </section>
      </div>

      {/* Full-width rule */}
      <Rule className="mt-24" />

      {/* Stats strip — four items, vertical hairlines, no cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 divide-x divide-hairline border-b border-hairline">
        <div className="py-8 pr-6">
          <Stat size="sm" label="Volume" value={volume24h} />
        </div>
        <div className="py-8 px-6">
          <Stat size="sm" label="Open Markets" value={stats ? Number(stats.openMarkets).toLocaleString() : "—"} />
        </div>
        <div className="py-8 px-6">
          <Stat size="sm" label="Traders" value={stats ? Number(stats.totalTraders).toLocaleString() : "—"} />
        </div>
        <div className="py-8 pl-6">
          <Stat size="sm" label="Resolved" value={stats ? Number(stats.settledMarkets).toLocaleString() : "—"} />
        </div>
      </section>

      {/* 02 — MECHANICS: numbered columns, no cards, no borders */}
      <section className="py-24">
        <LabelLux className="mb-14">02 — Mechanics</LabelLux>
        <div className="grid md:grid-cols-3 gap-16">
          <div>
            <div className="font-mono text-[13px] text-gold-deep mb-4">01</div>
            <h2 className="text-[21px] text-ivory mb-3">CPMM pricing</h2>
            <p className="text-[15px] text-ash leading-relaxed">
              Constant-product reserves price every share. Order size moves the
              curve; the first trade seeds the pool at baseline share price.
            </p>
          </div>
          <div>
            <div className="font-mono text-[13px] text-gold-deep mb-4">02</div>
            <h2 className="text-[21px] text-ivory mb-3">Oracle resolution</h2>
            <p className="text-[15px] text-ash leading-relaxed">
              Price-backed boards settle against signed Pyth pull feeds. No admin,
              no discretion, no waiting for a human to press a button.
            </p>
          </div>
          <div>
            <div className="font-mono text-[13px] text-gold-deep mb-4">03</div>
            <h2 className="text-[21px] text-ivory mb-3">On-chain payout</h2>
            <p className="text-[15px] text-ash leading-relaxed">
              Winning shares redeem at 0.01 SOL from the payout pool. Fees are
              capped at 10% and always visible before you place an order.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
