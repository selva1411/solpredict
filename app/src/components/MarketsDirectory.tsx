"use client";

import { useState, useMemo } from "react";
import { useMarkets } from "@/hooks/useMarkets";
import { onChainMarketsToUi } from "@/lib/market-adapter";
import type { UiMarket } from "@/lib/market-adapter";
import type { MarketCacheEntry } from "@/lib/db/markets-store";
import { LoadingState, EmptyState } from "@/components/StatePanels";
import { LabelLux } from "@/components/ui/label-lux";
import { Rule } from "@/components/ui/rule";
import { useRouter } from "next/navigation";

const CATEGORIES = ["All", "Crypto", "Sports", "Politics", "Tech", "Other"] as const;
const SORT_OPTIONS = [
  { key: "liquidity", label: "Volume" },
  { key: "newest", label: "Newest" },
  { key: "ending", label: "Ending Soon" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

/**
 * Client markets directory. Receives server-prefetched open-market rows so the
 * first paint shows the directory without waiting on /api/markets/cached.
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
        <LoadingState title="Loading prediction markets..." />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1240px] px-6 py-14">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div>
          <LabelLux className="mb-2">Explorer · {markets.length} live boards</LabelLux>
          <h1 className="text-[34px] text-ivory">Market Directory</h1>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-3">
          <div className="w-full sm:w-72 border-b border-hairline pb-1 flex items-center gap-2">
            <span className="font-mono text-[10px] text-ash-dim uppercase tracking-[.16em]">Search</span>
            <input
              type="text"
              placeholder="question, description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[13px] font-mono text-ivory placeholder:text-ash-dim focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-[.16em]">
            <span className="text-ash-dim">Sort</span>
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`cursor-pointer transition-colors ${
                  sortBy === key ? "text-gold-lite border-b border-gold" : "text-ash hover:text-ivory"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Rule className="mb-10" />

      <div className="grid lg:grid-cols-12 gap-12">
        {/* Left rail — FILTER, plain text rows, gold left-bar on active */}
        <aside className="lg:col-span-3 lg:sticky lg:top-24 self-start min-w-0">
          <LabelLux className="mb-4">Filter</LabelLux>
          <nav className="flex flex-wrap lg:flex-col gap-x-6 gap-y-2 lg:gap-0">
            {CATEGORIES.map((cat) => {
              const count = cat === "All" ? markets.length : markets.filter((m) => m.category === cat).length;
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`lg:border-l lg:pl-4 lg:py-2.5 text-left font-mono text-[13px] transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                    active
                      ? "lg:border-gold text-gold-lite"
                      : "lg:border-hairline text-ash hover:text-ivory"
                  }`}
                >
                  <span>{cat}</span>
                  <span className="text-[11px] text-ash-dim tnum">{count}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Right — market rows as a table-like list, hairline between rows */}
        <section className="lg:col-span-9">
          {filtered.length === 0 ? (
            <EmptyState title="No Markets Found" description="No prediction markets match your current filter parameters." />
          ) : (
            <div className="divide-y divide-hairline border-t border-hairline">
              {filtered.map((m) => {
                const yesPct = (m.yesPrice * 100).toFixed(0);
                const noPct = (100 - m.yesPrice * 100).toFixed(0);
                const vol = ((m.volume24h || m.liquidity || 0)).toFixed(1);
                const trend = [40, 45, 38, 52, 48, 61, 57].slice(0, 7);
                return (
                  <button
                    key={m.id}
                    onClick={() => router.push(`/market/${m.id}`)}
                    className="sheen group w-full grid grid-cols-12 items-center gap-4 py-5 text-left transition-colors hover:bg-panel px-3 -mx-3 cursor-pointer"
                  >
                    <span className="col-span-12 md:col-span-6 min-w-0">
                      <span className="block font-display text-[21px] text-ivory truncate group-hover:text-gold-lite transition-colors">
                        {m.question}
                      </span>
                      <span className="label-lux mt-1 block">{m.category}</span>
                    </span>
                    <span className="col-span-4 md:col-span-2 font-mono tnum text-[13px] text-ash-dim">
                      {vol} SOL
                    </span>
                    <span className="col-span-4 md:col-span-2 flex items-center gap-3 font-mono tnum text-[13px]">
                      <span className="text-verdigris">{yesPct}%</span>
                      <span className="text-ash-dim">/</span>
                      <span className="text-bordeaux">{noPct}%</span>
                    </span>
                    <span className="col-span-4 md:col-span-2 flex items-center gap-1.5 justify-end">
                      {trend.map((v, i) => (
                        <span key={i} className="w-[2px] bg-gold-deep group-hover:bg-gold transition-colors" style={{ height: `${(v / 70) * 22}px` }} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
