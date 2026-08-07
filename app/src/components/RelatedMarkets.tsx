"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { MarketCard } from "./MarketCard";
import type { UiMarket } from "@/lib/market-adapter";
import { cacheToUiMarket } from "@/lib/market-adapter";

interface RelatedMarketsProps {
  category: string;
  excludePubkey: string;
}

export function RelatedMarkets({ category, excludePubkey }: RelatedMarketsProps) {
  const router = useRouter();

  const { data: markets = [], isLoading } = useQuery({
    queryKey: ["markets", "related", category, excludePubkey],
    queryFn: async (): Promise<UiMarket[]> => {
      const res = await fetch(`/api/markets/cached?category=${encodeURIComponent(category)}&status=open&limit=8`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rows: any[] = (data?.markets ?? []).filter(
        (m: any) => m.marketPubkey !== excludePubkey
      );
      return rows.slice(0, 3).map((m) => cacheToUiMarket(m));
    },
    staleTime: 30_000,
  });
  const loading = isLoading;

  if (loading || markets.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider font-display text-[#FFA500] flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          <span>Related Markets</span>
        </h3>
        <span className="text-[10px] font-mono text-[#808495]">{category} · you might also like</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {markets.map((m, i) => (
          <MarketCard
            key={m.id}
            market={m}
            index={i}
            onClick={() => router.push(`/market/${m.id}`)}
          />
        ))}
      </div>
    </section>
  );
}
