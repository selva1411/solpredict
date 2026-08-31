"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Search, Sparkles } from "lucide-react";
import { useMarkets } from "@/hooks/useMarkets";
import { onChainMarketsToUi } from "@/lib/market-adapter";
import type { UiMarket } from "@/lib/market-adapter";
import type { MarketCacheEntry } from "@/lib/db/markets-store";
import { LoadingState, EmptyState } from "@/components/StatePanels";
import { LabelLux } from "@/components/ui/label-lux";
import { FlashValue } from "@/components/ui/flash-value";

const CATEGORIES = ["All", "Crypto", "Sports", "Politics", "Tech", "Other"] as const;
const SORT_OPTIONS = [
  { key: "liquidity", label: "Volume" },
  { key: "newest", label: "Newest" },
  { key: "ending", label: "Ending Soon" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

/**
 * Client markets directory — the Odds Wall. Receives server-prefetched open-market
 * rows so the first paint shows the board without waiting on /api/markets/cached.
 * useMarkets still polls (10s) and applies on-chain enrichment in the background.
 */
export default function MarketsDirectory({ initialMarkets }: { initialMarkets: MarketCacheEntry[] }) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]>("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("liquidity");
  const { markets: onChainMarkets, loading } = useMarkets(10_000, initialMarkets);

  const markets: UiMarket[] = useMemo(
    () => onChainMarketsToUi(onChainMarkets ?? []),
    [onChainMarkets]
  );

  const filtered = useMemo(() => {
    let list = markets;
    if (activeCategory !== "All") {
      list = list.filter((m) => m.category === activeCategory);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.question.toLowerCase().includes(q) || m.description.toLowerCase().includes(q));
    }
    if (sortBy === "liquidity") {
      list = [...list].sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
    } else if (sortBy === "newest") {
      list = [...list].sort((a, b) => (b.marketId || 0) - (a.marketId || 0));
    } else if (sortBy === "ending") {
      list = [...list].sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
    }
    return list;
  }, [markets, activeCategory, search, sortBy]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-[1240px] px-6 py-14">
        <LoadingState title="Loading the board..." />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1240px] px-6 py-14">
      {/* Masthead */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 rise">
        <div>
          <LabelLux className="mb-3 !text-gold-lite">SOLPREDICT · {markets.length} live markets</LabelLux>
          <h1 className="text-[44px] sm:text-[56px] leading-[.95] text-ivory uppercase font-bold">
            The <span className="text-signal">Board</span>
          </h1>
        </div>
        <div className="flex flex-col items-start lg:items-end gap-4">
          <div className="w-full lg:w-80 surface flex items-center gap-2.5 px-3.5 py-2.5 rounded focus-within:border-gold/50 transition-colors">
            <Search className="w-3.5 h-3.5 text-ash-dim shrink-0" />
            <input
              type="text"
              placeholder="Search markets…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[13px] font-mono text-ivory placeholder:text-ash-dim focus:outline-none"
            />
            {search && (
              <button onClick={() => setSearch("")} className="text-ash-dim hover:text-ivory cursor-pointer text-xs" aria-label="Clear search">✕</button>
            )}
          </div>
          {/* Sort — pill toggle with animated gradient */}
          <div className="flex items-center gap-1 surface rounded p-1">
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`relative cursor-pointer inline-flex items-center min-h-[40px] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.12em] rounded transition-colors ${
                  sortBy === key ? "text-void" : "text-ash hover:text-ivory"
                }`}
              >
                {sortBy === key && (
                  <motion.span
                    layoutId="sort-pill"
                    className="absolute inset-0 bg-gradient-to-r from-gold to-gold-deep rounded"
                    style={{ boxShadow: "0 0 16px -4px color-mix(in oklab, var(--color-gold) 60%, transparent)" }}
                  />
                )}
                <span className="relative z-10">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-10">
        {/* Left rail — category filter */}
        <aside className="lg:col-span-3 lg:sticky lg:top-24 self-start min-w-0">
          <LabelLux className="mb-4">Categories</LabelLux>
          <nav className="flex flex-wrap lg:flex-col gap-x-6 gap-y-2 lg:gap-1">
            {CATEGORIES.map((cat) => {
              const count = cat === "All" ? markets.length : markets.filter((m) => m.category === cat).length;
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`lg:border-l lg:pl-4 lg:py-2.5 text-left font-mono text-[13px] transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                    active
                      ? "lg:border-gold text-gold-lite"
                      : "lg:border-hairline text-ash hover:text-ivory"
                  }`}
                >
                  <span>{cat}</span>
                  <span className={`text-[11px] tnum px-1.5 py-0.5 rounded ${active ? "bg-gold/15 text-gold-lite" : "text-ash-dim group-hover:bg-panel-2"}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Live hint card */}
          <div className="hidden lg:block mt-8 surface-feature p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber" />
              <span className="label-lux !text-amber">Pro tip</span>
            </div>
            <p className="text-[12.5px] text-ash leading-relaxed">
              Prices move with every trade. Watch a line flash <span className="text-verdigris">emerald</span> or{" "}
              <span className="text-bordeaux">rose</span> to feel where the crowd is running.
            </p>
          </div>
        </aside>

        {/* Board */}
        <section className="lg:col-span-9 min-w-0">
          <div className="hidden md:grid grid-cols-12 items-center gap-4 px-4 py-2 mb-2 border border-hairline border-b-0 rounded-t bg-obsidian/60">
            <span className="col-span-1 label-lux">#</span>
            <span className="col-span-6 label-lux">Market</span>
            <span className="col-span-2 label-lux text-right">Volume</span>
            <span className="col-span-3 label-lux text-right">YES / NO</span>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No Markets Found" description="No prediction markets match your current filter parameters." />
          ) : (
            <div className="board">
              {filtered.map((m, i) => {
                const yesPct = Math.round(m.yesPrice * 100);
                const vol = m.volume24h || m.liquidity || 0;
                return (
                  <motion.button
                    layout
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                    onClick={() => router.push(`/market/${m.id}`)}
                    whileHover={{ x: 4 }}
                    className="board-row group w-full grid grid-cols-12 items-center gap-4 px-4 py-4 text-left cursor-pointer edge-glow"
                  >
                    <span className="hidden md:block col-span-1 font-display font-bold text-[14px] text-ash-dim tnum group-hover:text-gold-lite transition-colors">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="col-span-12 md:col-span-6 min-w-0">
                      <span className="block font-display font-medium text-[16.5px] leading-tight text-ivory line-clamp-1 group-hover:text-gold-lite transition-colors">
                        {m.question}
                      </span>
                      <span className="label-lux mt-1 block">{m.category} · live</span>
                      {/* mobile odds + volume */}
                      <span className="md:hidden mt-2 flex items-center gap-3">
                        <FlashValue value={yesPct} suffix="%" className="font-display font-bold text-[16px] text-verdigris" />
                        <span className="text-ash-dim text-[11px]">YES</span>
                        <span className="text-ash-dim">·</span>
                        <FlashValue value={100 - yesPct} suffix="%" className="font-display font-bold text-[16px] text-bordeaux" />
                        <span className="text-ash-dim text-[11px]">NO</span>
                      </span>
                    </span>
                    <span className="hidden md:block col-span-2 font-mono tnum text-[13px] text-ash text-right">
                      {vol.toFixed(1)} ◎
                    </span>
                    <span className="hidden md:flex col-span-3 items-center justify-end gap-3 font-display font-bold text-[19px]">
                      <FlashValue value={yesPct} suffix="%" className="text-verdigris" />
                      <span className="text-ash-dim text-[11px] font-sans">/</span>
                      <FlashValue value={100 - yesPct} suffix="%" className="text-bordeaux" />
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
