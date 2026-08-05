"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  const [markets, setMarkets] = useState<UiMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/markets/cached?category=${encodeURIComponent(category)}&status=open&limit=8`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (cancelled) return;
        const rows: any[] = (data?.markets ?? []).filter(
          (m: any) => m.marketPubkey !== excludePubkey
        );
        setMarkets(rows.slice(0, 3).map((m) => cacheToUiMarket(m)));
      })
      .catch(() => {
        if (!cancelled) setMarkets([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [category, excludePubkey]);

  if (loading || markets.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider font-display text-[#00E5FF] flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          <span>Related Markets</span>
        </h3>
        <span className="text-[10px] font-mono text-[#A5A8B8]">{category} · you might also like</span>
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
