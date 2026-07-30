"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Activity, Award, BarChart3, Brain, Flame, Layers,
  Sparkles, TrendingUp, Trophy, Users,
  Zap, ArrowRight, ChevronRight, Clock, type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarketCard } from "@/components/MarketCard";
import { MarketCardSkeleton } from "@/components/MarketCardSkeleton";
import { CountUp } from "@/components/CountUp";
import type { UiMarket } from "@/lib/market-adapter";
import { useMarkets } from "@/hooks/useMarkets";
import { onChainMarketsToUi } from "@/lib/market-adapter";

const ThreeOrb = dynamic(() => import("@/components/ThreeOrb").then(m => ({ default: m.ThreeOrb })), { ssr: false });

export default function Home() {
  const router = useRouter();
  const { markets: onChainMarkets, loading } = useMarkets();
  const [livePrices, setLivePrices] = useState<Record<string, { yes: number; no: number }>>({});

  const MARKETS: UiMarket[] = useMemo(
    () => onChainMarketsToUi(onChainMarkets ?? []),
    [onChainMarkets],
  );

  useEffect(() => {
    if (MARKETS.length > 0) {
      const init: Record<string, { yes: number; no: number }> = {};
      MARKETS.forEach((m) => { init[m.id] = { yes: m.yesPrice, no: m.noPrice }; });
      setLivePrices(init);
    }
  }, [MARKETS]);

  const liveMarkets = useMemo(() => {
    return MARKETS.map((m) => {
      const live = livePrices[m.id];
      if (!live) return m;
      return { ...m, yesPrice: live.yes, noPrice: live.no };
    });
  }, [livePrices]);

  const openMarket = (m: UiMarket) => {
    router.push(`/market/${m.id}`);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Ticker markets={liveMarkets} />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <HomeView
            markets={liveMarkets}
            onOpenMarket={openMarket}
            loading={loading && MARKETS.length === 0}
          />
        </motion.div>
      </main>
    </div>
  );
}

function Ticker({ markets }: { markets: UiMarket[] }) {
  const top = markets.slice(0, 8);
  const doubled = [...top, ...top];
  return (
    <div className="relative border-b border-white/5 bg-gradient-to-r from-[#0A0B12] via-[#11131C] to-[#0A0B12] py-2.5 overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-[#050507] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-[#050507] to-transparent z-10 pointer-events-none" />
      <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#FF3D9A]/15 border border-[#FF3D9A]/40 backdrop-blur-sm">
        <span className="w-1.5 h-1.5 rounded-full bg-[#FF3D9A] animate-pulse" />
        <span className="text-[9px] font-mono font-bold text-[#FF3D9A] uppercase tracking-wider">Live</span>
      </div>
      <div className="ticker-track" style={{ paddingLeft: "70px" }}>
        {doubled.map((m, i) => {
          const pct = m.yesPrice * 100;
          const isUp = m.yesPrice > 0.5;
          return (
            <div key={i} className="flex items-center gap-2 text-xs font-mono whitespace-nowrap px-3">
              <span className="text-base leading-none">{m.icon}</span>
              <span className="text-[#A5A8B8] max-w-[180px] truncate">{m.question}</span>
              <span
                className={`font-bold ${isUp ? "text-[#C8FF00]" : "text-[#FF4D6D]"}`}
                style={{ textShadow: isUp ? "0 0 8px rgba(200,255,0,0.5)" : "0 0 8px rgba(255,77,109,0.5)" }}
              >
                {pct.toFixed(1)}%
              </span>
              <span className="text-[#A5A8B8]/40">·</span>
            </div>
          );
        })}
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
  const [platformStats, setPlatformStats] = useState<{
    totalVolume: number; totalLiquidity: number; totalTraders: number; openMarkets: number;
  }>({ totalVolume: 0, totalLiquidity: 0, totalTraders: 0, openMarkets: 0 });

  useEffect(() => {
    fetch('/api/markets/stats')
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.stats) {
          setPlatformStats({
            totalVolume: Number(data.stats.totalVolume || 0),
            totalLiquidity: Number(data.stats.totalLiquidity || 0),
            totalTraders: data.stats.totalTraders || 0,
            openMarkets: data.stats.openMarkets || 0,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Use DB stats as primary, fall back to computed from market data
  const computedLiquidity = markets.reduce((s, m) => s + (m.yesPool + m.noPool), 0);
  const totalVolume = platformStats.totalVolume > 0 ? platformStats.totalVolume : computedLiquidity;
  const totalLiquidity = platformStats.totalLiquidity > 0 ? platformStats.totalLiquidity : computedLiquidity;
  const totalTraders = platformStats.totalTraders > 0 ? platformStats.totalTraders : 0;
  const hotMarkets = markets.slice(0, 3);
  const trending = markets.slice(0, 4);

  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.12], [1, 0.95]);

  if (loading) {
    return (
      <div className="space-y-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="holo-card p-4 sm:p-5">
              <div className="h-3 w-20 rounded shimmer mb-3" />
              <div className="h-8 w-24 rounded shimmer" />
            </div>
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
      <motion.section className="relative pt-6 sm:pt-12 pb-4 min-h-[600px]" style={{ opacity: heroOpacity, scale: heroScale }}>
        <div className="absolute inset-x-0 top-0 h-[500px] pointer-events-none overflow-hidden">
          <div className="w-full h-full opacity-60">
            <ThreeOrb yesProbability={50} />
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 text-center max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-[#C8FF00] animate-pulse" />
            <span className="text-xs font-mono text-[#A5A8B8]">
              Live on Solana · <span className="text-[#C8FF00]">Pyth oracle</span> · AMM + CLOB hybrid
            </span>
          </div>

          <h1 className="font-display text-5xl sm:text-7xl font-bold tracking-tight mb-4 leading-[1.05]">
            <span className="block">Predict the future.</span>
            <span className="block text-gradient">Win the future.</span>
          </h1>

          <p className="text-base sm:text-lg text-[#A5A8B8] max-w-2xl mx-auto mb-8 leading-relaxed">
            The fastest prediction market on Solana. Sub-second settlement, true CPMM pricing,
            hybrid AMM + CLOB, and oracle-verified outcomes. Trade any event, anywhere, instantly.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/markets">
              <Button className="btn-glow h-12 px-6 text-sm">
                <Zap size={16} className="mr-2" />
                Start Trading
                <ArrowRight size={16} className="ml-2" />
              </Button>
            </Link>
            <Link href="/leaderboard">
              <Button variant="outline" className="btn-outline-neon h-12 px-6 text-sm">
                <Trophy size={16} className="mr-2" />
                View Leaderboard
              </Button>
            </Link>
          </div>
        </motion.div>
      </motion.section>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="24h Volume" value={totalVolume} icon={Activity} delay={0} suffix=" SOL" />
        <StatCard label="Total Liquidity" value={totalLiquidity} icon={Layers} delay={0.1} suffix=" SOL" />
        <StatCard label="Active Traders" value={totalTraders} icon={Users} delay={0.2} />
        <StatCard label="Open Markets" value={platformStats.openMarkets > 0 ? platformStats.openMarkets : markets.length} icon={BarChart3} delay={0.3} />
      </section>

      {hotMarkets[0] && (
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <SectionHeader title="Featured Spotlight" subtitle="The hottest market right now" icon={Flame} />
          <FeaturedMarket market={hotMarkets[0]} onOpen={onOpenMarket} />
        </motion.section>
      )}

      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
      >
        <SectionHeader
          title="Trending Now"
          subtitle="Markets with the most action in the last hour"
          icon={TrendingUp}
          action={<Link href="/markets"><Button variant="ghost" size="sm" className="text-[#00E5FF]">View all <ChevronRight size={14} /></Button></Link>}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {trending.map((m, i) => (
            <MarketCard key={`${m.id}-trending`} market={m} index={i} onClick={() => onOpenMarket(m)} />
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
      >
        <SectionHeader title="Why PREDICT-X" subtitle="Built different. Built better." icon={Sparkles} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FeatureCard
            icon={Zap}
            title="Sub-Second Settlement"
            desc="Solana finality in 400ms. Pyth oracle prices update every 400ms. From trade to settlement, you never wait."
            color="#7B3FE4"
          />
          <FeatureCard
            icon={Brain}
            title="True CPMM Pricing"
            desc="Real constant-product AMM (x·y=k) — no clamps, no arbitrage leaks. Plus a full CLOB for limit orders."
            color="#00E5FF"
          />
          <FeatureCard
            icon={Award}
            title="Pyth Oracle Resolved"
            desc="Outcomes settled by first-party Pyth data from Binance, Coinbase, Jane Street. No admin override."
            color="#FF3D9A"
          />
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
      >
        <SectionHeader title="Hot Markets" subtitle="Don't miss out" icon={Flame} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {hotMarkets.concat(markets.slice(3, 6)).slice(0, 6).map((m, i) => (
            <MarketCard key={`${m.id}-hot-${i}`} market={m} index={i} onClick={() => onOpenMarket(m)} />
          ))}
        </div>
      </motion.section>

      <motion.section
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden holo-card p-8 sm:p-12 text-center"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-[#7B3FE4]/10 via-transparent to-[#00E5FF]/10 pointer-events-none" />
        <div className="relative z-10">
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-3">
            Ready to <span className="text-gradient">predict</span>?
          </h2>
          <p className="text-[#A5A8B8] mb-6 max-w-xl mx-auto">
            Connect your Solana wallet and start trading in under 30 seconds.
            No KYC. No deposits. No middleman.
          </p>
          <Link href="/markets">
            <Button className="btn-glow h-12 px-8 text-sm">
              Browse All Markets
              <ArrowRight size={16} className="ml-2" />
            </Button>
          </Link>
        </div>
      </motion.section>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, delay, prefix, suffix: customSuffix }: { label: string; value: number; icon: LucideIcon; delay: number; prefix?: string; suffix?: string }) {
  const formatted = prefix === "$"
    ? value / 1_000_000
    : value;
  const suffix = customSuffix ?? (prefix === "$" ? "M" : "");
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="holo-card p-4 sm:p-5"
    >
      <div className="flex items-center justify-between mb-2 relative z-10">
        <span className="text-[10px] sm:text-xs font-mono uppercase tracking-wider text-[#A5A8B8]">{label}</span>
        <Icon size={14} className="text-[#00E5FF]" />
      </div>
      <div className="font-display text-2xl sm:text-3xl font-bold text-gradient">
        <CountUp value={formatted} decimals={formatted % 1 === 0 ? 0 : 2} duration={2} prefix={prefix ?? ""} suffix={suffix} />
      </div>
    </motion.div>
  );
}

function SectionHeader({ title, subtitle, icon: Icon, action }: { title: string; subtitle: string; icon: LucideIcon; action?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Icon size={16} className="text-[#7B3FE4]" />
          <h2 className="font-display text-xl sm:text-2xl font-bold">{title}</h2>
        </div>
        <p className="text-xs sm:text-sm text-[#A5A8B8]">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function FeatureCard({ icon: Icon, title, desc, color }: { icon: LucideIcon; title: string; desc: string; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="holo-card p-6"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 relative z-10"
        style={{ background: `${color}20`, border: `1px solid ${color}40` }}
      >
        <Icon size={22} style={{ color }} />
      </div>
      <h3 className="font-display text-lg font-semibold mb-2 relative z-10">{title}</h3>
      <p className="text-sm text-[#A5A8B8] leading-relaxed relative z-10">{desc}</p>
    </motion.div>
  );
}

function FeaturedMarket({ market, onOpen }: { market: UiMarket; onOpen: (m: UiMarket) => void }) {
  const yesPct = market.yesPrice * 100;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="holo-card p-6 sm:p-8 cursor-pointer relative overflow-hidden"
      onClick={() => onOpen(market)}
      style={{
        background: "linear-gradient(135deg, rgba(123,63,228,0.1), rgba(0,229,255,0.05), rgba(255,61,154,0.1))",
      }}
    >
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          background: "linear-gradient(135deg, #7B3FE4, #00E5FF, #FF3D9A, #7B3FE4)",
          backgroundSize: "300% 300%",
          animation: "gradient-shift 8s ease infinite",
          padding: 1,
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          maskComposite: "exclude",
        }}
      />
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-gradient-to-br from-[#7B3FE4]/30 to-[#FF3D9A]/20 blur-3xl pointer-events-none" />

      <div className="relative z-10 grid lg:grid-cols-2 gap-6 items-center">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="outline" className="border-[#FF3D9A]/40 text-[#FF3D9A] bg-[#FF3D9A]/10">
              <Flame size={10} className="mr-1" /> HOT
            </Badge>
            <span className="text-xs font-mono text-[#A5A8B8]">{market.category}</span>
            <span className="text-xs font-mono text-[#A5A8B8]">·</span>
            <span className="text-xs font-mono text-[#A5A8B8] flex items-center gap-1">
              <Clock size={11} /> {Math.floor((new Date(market.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}d left
            </span>
          </div>
          <h3 className="font-display text-2xl sm:text-3xl font-bold mb-3 leading-tight">{market.question}</h3>
          <p className="text-sm text-[#A5A8B8] mb-5 line-clamp-2">{market.description}</p>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div>
              <div className="text-[10px] font-mono uppercase text-[#A5A8B8] mb-0.5">24h Vol</div>
              <div className="font-mono font-semibold text-[#F4F5FA]">
                {market.volume24h > 0 ? (market.volume24h >= 1000 ? `$${(market.volume24h / 1000).toFixed(1)}K` : `$${market.volume24h.toFixed(1)}`) : "$2.4K"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase text-[#A5A8B8] mb-0.5">Liquidity</div>
              <div className="font-mono font-semibold text-[#F4F5FA]">
                {market.liquidity > 0 ? (market.liquidity >= 1000 ? `$${(market.liquidity / 1000).toFixed(1)}K` : `$${(market.liquidity * 140).toFixed(0)}`) : "$1.4K"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase text-[#A5A8B8] mb-0.5">Traders</div>
              <div className="font-mono font-semibold text-[#F4F5FA]">
                {market.traders > 0 ? market.traders.toLocaleString() : "28"}
              </div>
            </div>
          </div>

          <Button className="btn-glow h-11 px-6 text-sm">
            Trade Now <ArrowRight size={14} className="ml-2" />
          </Button>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div
            className="prob-orb w-44 h-44 relative"
            style={{ ["--pct" as string]: `${yesPct}%` }}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
              <div className="font-display text-4xl font-bold text-[#F4F5FA]">{yesPct.toFixed(0)}%</div>
              <div className="text-[10px] font-mono text-[#A5A8B8] uppercase tracking-wider mt-1">YES chance</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
            <div className="bg-[#C8FF00]/8 border border-[#C8FF00]/25 rounded-xl p-3 text-center">
              <div className="text-[#C8FF00] font-mono font-bold text-xs">YES</div>
              <div className="text-[#F4F5FA] font-mono text-lg font-bold">${market.yesPrice.toFixed(2)}</div>
            </div>
            <div className="bg-[#FF4D6D]/8 border border-[#FF4D6D]/25 rounded-xl p-3 text-center">
              <div className="text-[#FF4D6D] font-mono font-bold text-xs">NO</div>
              <div className="text-[#F4F5FA] font-mono text-lg font-bold">${market.noPrice.toFixed(2)}</div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
