"use client";

import { useState, useMemo } from "react";
import { Search, ArrowUpDown, Clock, TrendingUp, Sparkles, LayoutGrid, Table } from "lucide-react";
import { useMarkets } from "@/hooks/useMarkets";
import { onChainMarketsToUi } from "@/lib/market-adapter";
import { MarketCard } from "@/components/MarketCard";
import type { UiMarket } from "@/lib/market-adapter";
import { LoadingState, EmptyState } from "@/components/StatePanels";
import Link from "next/link";
import { useRouter } from "next/navigation";

const CATEGORIES = ["All", "Crypto", "Sports", "Politics", "Tech", "Other"] as const;
const SORT_OPTIONS = [
  { key: "liquidity", label: "Volume", icon: TrendingUp },
  { key: "newest", label: "Newest", icon: Sparkles },
  { key: "ending", label: "Ending Soon", icon: Clock },
] as const;
type SortKey = (typeof SORT_OPTIONS)[number]["key"];

export default function MarketsPage() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<typeof CATEGORIES[number]>("All");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("liquidity");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const { markets: onChainMarkets, loading } = useMarkets();

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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <LoadingState title="Loading prediction markets..." />
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-gradient-gold">
            Market Directory
          </h1>
          <p className="text-xs font-mono text-[var(--color-gray-400)]">
            {markets.length} active markets{search ? ` · ${filtered.length} matching` : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-gray-400)]" />
            <input
              type="text"
              placeholder="Search markets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-56 bg-[var(--surface-1)] border border-[var(--color-gray-800)] rounded-lg pl-9 pr-3 py-2 text-xs font-mono text-[var(--color-gray-100)] placeholder:text-[var(--color-gray-500)] focus:outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="flex items-center bg-[var(--surface-1)] border border-[var(--color-gray-800)] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded ${viewMode === "grid" ? "bg-[var(--color-gray-800)] text-[var(--accent)]" : "text-[var(--color-gray-400)]"}`}
              title="Grid View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded ${viewMode === "table" ? "bg-[var(--color-gray-800)] text-[var(--accent)]" : "text-[var(--color-gray-400)]"}`}
              title="Table View"
            >
              <Table size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Category Tabs & Sort */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-2">
        <div className="flex items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-[var(--accent)] text-[#0B0C0F]"
                  : "bg-[var(--surface-1)] text-[var(--color-gray-400)] border border-[var(--color-gray-800)] hover:text-[var(--color-gray-100)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 font-mono text-xs">
          <ArrowUpDown size={12} className="text-[var(--color-gray-500)]" />
          {SORT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                sortBy === key
                  ? "text-[var(--accent)] font-bold bg-[var(--accent)]/10"
                  : "text-[var(--color-gray-400)] hover:text-[var(--color-gray-100)]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState title="No Markets Found" description="No prediction markets match your current filter parameters." />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m, i) => (
            <MarketCard key={m.id} market={m} index={i} onClick={() => router.push(`/market/${m.id}`)} />
          ))}
        </div>
      ) : (
        /* Dense Table View */
        <div className="terminal-card overflow-hidden">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[var(--surface-0)] text-[var(--color-gray-400)] border-b border-[var(--color-gray-800)] uppercase">
              <tr>
                <th className="p-3">Market</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">YES Rate</th>
                <th className="p-3 text-right">NO Rate</th>
                <th className="p-3 text-right">Volume</th>
                <th className="p-3 text-right">Traders</th>
                <th className="p-3 text-right">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-gray-800)]">
              {filtered.map((m) => {
                const yesPct = (m.yesPrice * 100).toFixed(0);
                const noPct = ((1 - m.yesPrice) * 100).toFixed(0);
                return (
                  <tr
                    key={m.id}
                    onClick={() => router.push(`/market/${m.id}`)}
                    className="hover:bg-[var(--color-gray-800)]/50 cursor-pointer transition-colors"
                  >
                    <td className="p-3 font-sans font-medium text-[var(--color-gray-100)] max-w-xs truncate">
                      {m.question}
                    </td>
                    <td className="p-3 text-[var(--color-gray-400)]">{m.category}</td>
                    <td className="p-3 text-right font-bold text-[var(--accent)]">{yesPct}%</td>
                    <td className="p-3 text-right font-bold text-[var(--negative)]">{noPct}%</td>
                    <td className="p-3 text-right text-[var(--color-gray-200)]">{(m.volume24h || m.liquidity).toFixed(1)} SOL</td>
                    <td className="p-3 text-right text-[var(--color-gray-400)]">{m.traders}</td>
                    <td className="p-3 text-right text-[var(--color-gray-400)]">
                      {new Date(m.endDate).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
