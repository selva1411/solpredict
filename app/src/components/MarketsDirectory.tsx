"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useMarkets } from "@/hooks/useMarkets";
import { onChainMarketsToUi } from "@/lib/market-adapter";
import type { UiMarket } from "@/lib/market-adapter";
import type { MarketCacheEntry } from "@/lib/db/markets-store";
import { LoadingState, EmptyState } from "@/components/StatePanels";
import { LabelLux } from "@/components/ui/label-lux";
import { MarketCard } from "@/components/MarketCard";

const CATEGORIES = [
  "All",
  "Crypto",
  "Sports",
  "Politics",
  "Tech",
  "Other",
] as const;
const SORT_OPTIONS = [
  { key: "liquidity", label: "Volume" },
  { key: "newest", label: "Newest" },
  { key: "ending", label: "Ending Soon" },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

export default function MarketsDirectory({
  initialMarkets,
}: {
  initialMarkets: MarketCacheEntry[];
}) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] =
    useState<(typeof CATEGORIES)[number]>("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("liquidity");
  const { markets: onChainMarkets, loading } = useMarkets(
    10_000,
    initialMarkets
  );

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
      list = list.filter(
        (m) =>
          m.question.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q)
      );
    }
    if (sortBy === "liquidity") {
      list = [...list].sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
    } else if (sortBy === "newest") {
      list = [...list].sort((a, b) => (b.marketId || 0) - (a.marketId || 0));
    } else if (sortBy === "ending") {
      list = [...list].sort(
        (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
      );
    }
    return list;
  }, [markets, activeCategory, search, sortBy]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-[1240px] px-6 py-12">
        <LoadingState title="Loading markets..." />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1240px] px-6 py-12">
      {/* Header */}
      <div className="mb-8 rise">
        <LabelLux className="mb-1">Markets</LabelLux>
        <h1 className="font-display text-[28px] font-semibold text-ivory mb-4">
          Browse
        </h1>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Search */}
          <div
            className="flex-1 max-w-md flex items-center gap-2 px-3 py-2 rounded-lg transition-colors focus-within:ring-1 focus-within:ring-gold"
            style={{
              background: "var(--color-panel)",
              border: "1px solid var(--color-hairline)",
            }}
          >
            <Search className="w-4 h-4 text-ash-dim shrink-0" />
            <input
              type="text"
              placeholder="Search markets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[13px] text-ivory placeholder:text-ash-dim focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-ash-dim hover:text-ivory cursor-pointer text-xs"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: "var(--color-panel)", border: "1px solid var(--color-hairline)" }}>
            {SORT_OPTIONS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`px-3 py-1.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                  sortBy === key
                    ? "bg-gold text-white"
                    : "text-ash hover:text-ivory"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Categories sidebar */}
        <aside className="lg:w-48 shrink-0">
          <LabelLux className="mb-3">Categories</LabelLux>
          <nav className="flex flex-wrap lg:flex-col gap-2">
            {CATEGORIES.map((cat) => {
              const count =
                cat === "All"
                  ? markets.length
                  : markets.filter((m) => m.category === cat).length;
              const active = activeCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded text-[13px] transition-colors cursor-pointer ${
                    active
                      ? "bg-gold/10 text-gold font-medium"
                      : "text-ash hover:text-ivory hover:bg-panel-2"
                  }`}
                >
                  <span>{cat}</span>
                  <span className="text-[11px] text-ash-dim">{count}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Market grid */}
        <section className="flex-1 min-w-0">
          {filtered.length === 0 ? (
            <EmptyState
              title="No Markets Found"
              description="No prediction markets match your current filters."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((m, i) => (
                <MarketCard
                  key={m.id}
                  market={m}
                  index={i}
                  onClick={() => router.push(`/market/${m.id}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
