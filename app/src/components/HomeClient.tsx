"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { ArrowRight, ArrowUpRight, Flame } from "lucide-react";
import { LabelLux } from "@/components/ui/label-lux";
import { Rule } from "@/components/ui/rule";
import { Stat } from "@/components/ui/stat";
import { ButtonLux } from "@/components/ui/button-lux";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { FlashValue, MotionBoardRow } from "@/components/ui/flash-value";
import { TimeLeft } from "@/components/ui/time-left";
import { WatchlistExpiryChecker } from "@/components/WatchlistExpiryChecker";
import type { UiMarket } from "@/lib/market-adapter";
import { useMarkets } from "@/hooks/useMarkets";
import { usePlatformStats, type PlatformStats } from "@/hooks/usePlatformStats";
import { onChainMarketsToUi } from "@/lib/market-adapter";
import type { MarketCacheEntry } from "@/lib/db/markets-store";

/** Lazy client-only WebGL mount. */
const SignalOrb = dynamic(() => import("@/components/three/SignalOrb").then((mod) => mod.SignalOrb), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center" style={{ width: 260, height: 260 }}>
      <div className="h-32 w-32 rounded-full border border-hairline bg-[radial-gradient(circle_at_35%_30%,color-mix(in_oklab,var(--color-gold)_25%,transparent),transparent_65%)] animate-pulse" />
    </div>
  ),
});

/**
 * Client home view — the Odds Wall. Receives server-prefetched markets + stats so
 * the first paint shows the board without /api round trips; the hooks still poll.
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
      <main className="mx-auto w-full max-w-[1240px] px-6 py-12 md:py-16">
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

  const liveBook = useMemo(() => markets.slice(0, 8), [markets]);
  const featured = liveBook[0];

  if (loading) {
    return (
      <div className="grid md:grid-cols-12 gap-12">
        <div className="md:col-span-7 space-y-8">
          <div className="w-64 h-3 bg-panel-2 shimmer rounded" />
          <div className="w-3/4 h-24 bg-panel-2 shimmer rounded" />
          <div className="w-full max-w-[46ch] h-16 bg-panel-2 shimmer rounded" />
        </div>
        <div className="md:col-span-5 md:mt-24">
          <div className="surface-feature h-96 shimmer" />
        </div>
      </div>
    );
  }

  const volume24hNum = stats ? Number(stats.volume24h) : 0;

  return (
    <div>
      {/* ═══ HERO — headline left, live probability orb right ═══ */}
      <section className="relative grid md:grid-cols-12 gap-10 items-center mb-14 rise">
        <div className="md:col-span-7 min-w-0 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 surface px-3 py-1.5 mb-6"
          >
            <span className="live-dot" />
            <span className="label-lux !text-gold-lite">Live · Solana mainnet-grade speed</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="display-xl uppercase break-words"
          >
            <span className="text-signal">Trade the</span>
            <br />
            Future<span className="text-gold">.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
            className="max-w-[52ch] text-[15px] text-ash leading-relaxed mt-6"
          >
            Take a position on anything in seconds — constant-product pricing,
            Pyth oracle resolution, payouts wired on-chain. No order book queues,
            no discretion. Just conviction, priced.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.26 }}
            className="flex flex-wrap items-center gap-3 mt-8"
          >
            <Link href="/markets">
              <ButtonLux variant="gold" className="h-12 px-7 group">
                Explore Markets
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </ButtonLux>
            </Link>
            <Link href="/docs/help">
              <ButtonLux variant="quiet" className="h-12 px-7">How Settlement Works</ButtonLux>
            </Link>
          </motion.div>

          {/* inline proof stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.36 }}
            className="flex items-center gap-8 mt-10"
          >
            <div>
              <div className="num font-semibold text-[24px] text-ivory">
                <AnimatedNumber value={Number(stats?.totalVolume ?? 0)} decimals={1} suffix="" />{" "}
                <span className="text-[13px] text-ash-dim font-mono">SOL vol</span>
              </div>
            </div>
            <div className="w-px h-9 bg-hairline" />
            <div>
              <div className="num font-semibold text-[24px] text-ivory">
                <AnimatedNumber value={stats ? stats.totalTraders : 0} />{" "}
                <span className="text-[13px] text-ash-dim font-mono">traders</span>
              </div>
            </div>
            <div className="w-px h-9 bg-hairline" />
            <div>
              <div className="num font-semibold text-[24px] text-verdigris">
                <AnimatedNumber value={stats ? stats.openMarkets : 0} />{" "}
                <span className="text-[13px] text-ash-dim font-mono">open now</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Featured market + orb */}
        {featured && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.65, delay: 0.2 }}
            className="md:col-span-5 hidden md:flex flex-col items-center relative overflow-x-clip"
          >
            <div className="absolute -inset-8 bg-[radial-gradient(circle_at_50%_42%,color-mix(in_oklab,var(--color-gold)_9%,transparent),transparent_62%)] pointer-events-none" />
            <FeaturedOrb market={featured} onOpen={() => onOpenMarket(featured)} />
          </motion.div>
        )}
      </section>

      {/* ═══ THE ODDS WALL ═══ */}
      <section className="rise" style={{ animationDelay: ".15s" }}>
        <div className="flex items-end justify-between mb-4">
          <div>
            <LabelLux className="!text-gold-lite mb-2">01 — The Board</LabelLux>
            <h2 className="font-display text-[28px] font-semibold text-ivory">Live Lines</h2>
          </div>
          <Link
            href="/markets"
            className="group flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[.14em] text-ash hover:text-gold-lite transition-colors"
          >
            All markets
            <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </div>

        <div className="board">
          <MotionBoardRowHeader />
          {liveBook.length === 0 ? (
            <div className="py-14 text-center font-mono text-[12px] text-ash-dim surface">
              No open boards yet — propose the first one.
            </div>
          ) : (
            liveBook.map((m, i) => (
              <MotionBoardRow key={m.id} onClick={() => onOpenMarket(m)}>
                <BoardRowContent index={i} market={m} />
              </MotionBoardRow>
            ))
          )}
        </div>
      </section>

      {/* Full-width rule */}
      <Rule className="mt-16" />

      {/* ═══ STATS STRIP ═══ */}
      <section className="grid grid-cols-2 md:grid-cols-4 divide-x divide-hairline border-b border-hairline">
        <div className="py-8 pr-6">
          <Stat size="sm" label="Volume Total" value={`${Number(stats?.totalVolume ?? 0).toFixed(2)} SOL`} />
        </div>
        <div className="py-8 px-6">
          <Stat size="sm" label="Liquidity" value={`${Number(stats?.totalLiquidity ?? 0).toFixed(2)} SOL`} />
        </div>
        <div className="py-8 px-6">
          <Stat size="sm" label="Traders" value={String(stats?.totalTraders ?? "—")} />
        </div>
        <div className="py-8 pl-6">
          <Stat size="sm" label="Resolved" value={String(stats?.settledMarkets ?? "—")} />
        </div>
      </section>

      {/* ═══ MECHANICS ═══ */}
      <section className="py-20">
        <LabelLux className="mb-12 !text-gold-lite">02 — Why SOLPREDICT</LabelLux>
        <div className="grid md:grid-cols-3 gap-14">
          {[
            {
              n: "01",
              title: "Instant fills",
              body: "Constant-product reserves price every share and fill your trade in one atomic transaction. Order size moves the curve — you always see impact before you commit.",
            },
            {
              n: "02",
              title: "Oracle truth",
              body: "Price-backed boards settle against signed Pyth pull feeds the moment they expire. No admin discretion on crypto markets, no waiting for a human to press a button.",
            },
            {
              n: "03",
              title: "Self-custody payout",
              body: "Winning shares redeem pro-rata from the on-chain treasury at 0.01 SOL each. Fees are capped and always visible before an order lands. Your keys, your payout.",
            },
          ].map(({ n, title, body }, i) => (
            <motion.div
              key={n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              className="group"
            >
              <div className="font-display font-bold text-[40px] leading-none mb-4 bg-gradient-to-b from-gold/70 to-gold-deep/30 bg-clip-text text-transparent tnum select-none transition-transform duration-300 group-hover:-translate-y-1">
                {n}
              </div>
              <h2 className="font-display text-[22px] font-semibold text-ivory mb-3">{title}</h2>
              <p className="text-[14.5px] text-ash leading-relaxed">{body}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FeaturedOrb({ market, onOpen }: { market: UiMarket; onOpen: () => void }) {
  const yesPct = Math.round(market.yesPrice * 100);
  return (
    <button onClick={onOpen} className="relative flex flex-col items-center cursor-pointer group" aria-label={`Open ${market.question}`}>
      <SignalOrb yesProbability={market.yesPrice} className="-mb-6" />
      <div className="relative z-10 surface-feature px-5 py-4 max-w-[320px] -mt-10 edge-glow">
        <div className="flex items-center gap-1.5 mb-1.5 justify-center">
          <Flame className="w-3 h-3 text-amber" />
          <span className="label-lux !text-amber">Most traded line</span>
        </div>
        <div className="font-display text-[15px] font-medium text-ivory leading-snug line-clamp-2 text-center group-hover:text-gold-lite transition-colors">
          {market.question}
        </div>
        <div className="mt-3 flex items-center justify-center gap-4">
          <FlashValue value={yesPct} suffix="%" className="font-display font-bold text-[20px] text-verdigris" />
          <span className="text-ash-dim text-xs">YES</span>
          <span className="w-px h-4 bg-hairline" />
          <FlashValue value={100 - yesPct} suffix="%" className="font-display font-bold text-[20px] text-bordeaux" />
          <span className="text-ash-dim text-xs">NO</span>
        </div>
        {/* probability bar */}
        <div className="mt-3 h-1.5 w-full bg-panel-2 rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${yesPct}%` }}
            transition={{ type: "spring", stiffness: 90, damping: 22 }}
            className="h-full rounded-full bg-gradient-to-r from-verdigris to-gold"
            style={{ boxShadow: "0 0 10px color-mix(in oklab, var(--color-verdigris) 55%, transparent)" }}
          />
        </div>
      </div>
    </button>
  );
}

function MotionBoardRowHeader() {
  return (
    <div className="hidden md:grid grid-cols-12 items-center gap-4 px-6 py-2 border border-hairline border-b-0 rounded-t bg-obsidian/60">
      <span className="col-span-1 label-lux">#</span>
      <span className="col-span-6 label-lux">Market</span>
      <span className="col-span-2 label-lux text-right">24h Vol</span>
      <span className="col-span-2 label-lux text-right">YES / NO</span>
      <span className="col-span-1 label-lux text-right">Ends</span>
    </div>
  );
}

function BoardRowContent({ index, market: m }: { index: number; market: UiMarket }) {
  const yesPct = Math.round(m.yesPrice * 100);
  const vol = m.volume24h || m.liquidity || 0;


  return (
    <>
      <span className="hidden md:block col-span-1 font-display font-bold text-[15px] text-ash-dim tnum group-hover:text-gold-lite transition-colors">
        {String(index + 1).padStart(2, "0")}
      </span>
      <span className="col-span-12 md:col-span-6 min-w-0">
        <span className="block font-display font-medium text-[16px] leading-tight text-ivory line-clamp-1 group-hover:text-gold-lite transition-colors">
          {m.question}
        </span>
        <span className="mt-1 flex items-center gap-2">
          <span className="label-lux !text-gold/80">{m.category}</span>
          <span className="w-1 h-1 bg-ash-dim rounded-full" />
          <span className="label-lux">{m.status === "settled" ? "settled" : "live"}</span>
        </span>
        {/* mobile odds */}
        <span className="md:hidden mt-2 flex items-center gap-3">
          <FlashValue value={yesPct} suffix="%" className="font-display font-bold text-[17px] text-verdigris" />
          <span className="text-ash-dim text-[11px]">YES</span>
          <span className="text-ash-dim">·</span>
          <FlashValue value={100 - yesPct} suffix="%" className="font-display font-bold text-[17px] text-bordeaux" />
          <span className="text-ash-dim text-[11px]">NO</span>
        </span>
      </span>
      <span className="hidden md:block col-span-2 font-mono tnum text-[13px] text-ash text-right">{vol.toFixed(1)} ◎</span>
      <span className="hidden md:flex col-span-2 items-center justify-end gap-2.5 font-display font-bold text-[19px]">
        <FlashValue value={yesPct} suffix="%" className="text-verdigris text-[19px]" />
        <span className="text-ash-dim text-[11px] font-sans">/</span>
        <FlashValue value={100 - yesPct} suffix="%" className="text-bordeaux text-[19px]" />
      </span>
      <span className="hidden md:flex col-span-1 items-center justify-end pr-1">
        <TimeLeft endDate={m.endDate} />
      </span>
    </>
  );
}
