"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Users } from "lucide-react";
import { useMarkets } from "@/hooks/useMarkets";
import { onChainMarketsToUi } from "@/lib/market-adapter";
import { MarketCard } from "@/components/MarketCard";
import { keys } from "@/lib/api/keys";

interface TraderEntry {
  rank: number;
  wallet: string;
  username: string;
  avatarUrl: string;
  totalWagered: number;
  totalProfit: number;
  winRate: number;
  marketsTraded: number;
}

const DISCOVER_CATEGORIES = ["All", "Crypto", "Politics", "Sports", "Tech", "Other"];

export default function DiscoverPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const { markets: onChainMarkets, loading } = useMarkets();

  const { data: topTraders = [] } = useQuery({
    queryKey: [...keys.leaderboard.list("all", "profit"), { slice: 6 }],
    queryFn: async (): Promise<TraderEntry[]> => {
      const r = await fetch("/api/leaderboard");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (data?.ok && data.leaderboard) return data.leaderboard.slice(0, 6) as TraderEntry[];
      return [];
    },
    staleTime: 60_000,
  });

  const markets = onChainMarketsToUi(onChainMarkets ?? []);
  const categoryMarkets = activeCategory === "All"
    ? markets
    : markets.filter((m) => m.category === activeCategory);
  const trendingMarkets = categoryMarkets
    .filter((m) => m.liquidity > 0)
    .sort((a, b) => b.liquidity - a.liquidity)
    .slice(0, 8);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">
          <span className="text-gradient">Discover</span>
        </h1>
        <p className="text-[#808495]">Trending traders and markets</p>
      </div>

      <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar">
        {DISCOVER_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              activeCategory === cat
                ? "bg-[#FFA500] text-white"
                : "text-[#808495] border border-white/10 hover:border-[#FFA500]/50 hover:text-[#F4F4F9]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-[#D48800]" />
          <h2 className="font-display text-xl font-bold text-[#F4F4F9]">Trending Markets</h2>
        </div>
        {loading ? (
          <div className="holo-card p-12 text-center text-[#808495]">Loading...</div>
        ) : trendingMarkets.length === 0 ? (
          <div className="holo-card p-12 text-center text-[#808495]">
            No markets yet. <Link href="/create" className="text-[#FFA500]">Create one</Link>.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {trendingMarkets.map((m, i) => (
              <Link key={m.id} href={`/market/${m.id}`}>
                <MarketCard market={m} index={i} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-[#FFA500]" />
          <h2 className="font-display text-xl font-bold text-[#F4F4F9]">Top Traders</h2>
        </div>
        {topTraders.length === 0 ? (
          <div className="holo-card p-12 text-center text-[#808495]">No trader data yet.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topTraders.map((t) => (
              <Link key={t.wallet} href={`/profile/${t.wallet}`}>
                <div className="holo-card p-4 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-[#FFA500]/20 flex items-center justify-center text-lg font-bold text-[#FFA500]">
                    {(t.username || t.wallet)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[#F4F4F9] truncate">
                      @{t.username || t.wallet.slice(0, 6) + "..." + t.wallet.slice(-4)}
                    </div>
                    <div className="text-xs text-[#808495]">
                      Volume: {t.totalWagered.toFixed(1)} SOL · Win: {t.winRate.toFixed(0)}%
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
