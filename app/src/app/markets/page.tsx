"use client";

import { useState, useMemo } from "react";
import { Search, ArrowUpDown, Clock, TrendingUp, Sparkles } from "lucide-react";
import { useMarkets } from "@/hooks/useMarkets";
import { onChainMarketsToUi } from "@/lib/market-adapter";
import { MarketCard } from "@/components/MarketCard";
import type { UiMarket } from "@/lib/market-adapter";
import { LoadingState, EmptyState } from "@/components/StatePanels";
import Link from "next/link";

const CATEGORIES = ["All", "Crypto", "Sports", "Politics", "Tech", "Other"] as const;
const SORT_OPTIONS = [
  { key: "liquidity", label: "Volume", icon: TrendingUp },
  { key: "newest", label: "Newest", icon: Sparkles },
  { key: "ending", label: "Ending Soon", icon: Clock },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

export default function MarketsPage() {
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]>("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("liquidity");
  const { markets: onChainMarkets, loading, error } = useMarkets();

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
      list = list.filter((m) => m.question.toLowerCase().includes(q));
    }
    if (sortBy === "liquidity") {
      list = [...list].sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
    } else     if (sortBy === "newest") {
      list = [...list].sort((a, b) => Number(b.id) - Number(a.id));
    } else if (sortBy === "ending") {
      list = [...list].sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime());
    }
    return list;
  }, [markets, activeCategory, search, sortBy]);

  if (loading) return <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10"><LoadingState title="Loading markets..." /></main>;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2 text-[#F4F5FA]">
            Browse Markets
          </h1>
          <p className="text-sm text-[#A5A8B8]">
            {markets.length} live markets{search ? ` · ${filtered.length} shown` : ""}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A5A8B8]" />
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 bg-[#0A0B12] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-[#F4F5FA] placeholder:text-[#A5A8B8] focus:outline-none focus:border-[#7B3FE4] transition-colors"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-8 overflow-x-auto no-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              activeCategory === cat
                ? "bg-[#7B3FE4] text-white"
                : "text-[#A5A8B8] border border-white/10 hover:border-[#7B3FE4]/50 hover:text-[#F4F5FA]"
            }`}
          >
            {cat}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1 border-l border-white/5 pl-3">
          <ArrowUpDown className="w-3.5 h-3.5 text-[#A5A8B8]" />
          {SORT_OPTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                sortBy === key
                  ? "text-[#00E5FF] bg-[#00E5FF]/10 border border-[#00E5FF]/20"
                  : "text-[#A5A8B8] hover:text-[#F4F5FA]"
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <EmptyState title="Error" description={error} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? "No matches" : "No markets yet"}
          description={search ? "Try a different search or category." : "Be the first to propose a market."}
          action={!search ? { label: "Create Market", href: "/create" } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m, i) => (
            <Link key={m.id} href={`/market/${m.id}`}>
              <MarketCard market={m} index={i} />
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
