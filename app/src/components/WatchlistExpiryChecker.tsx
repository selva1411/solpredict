"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { getWatchlist } from "@/lib/watchlist";
import { keys } from "@/lib/api/keys";

interface CachedMarket {
  marketPubkey: string;
  marketId: number;
  question: string;
  status: string;
  endTs: string;
}

const EXPIRY_WINDOW_MS = 60 * 60 * 1000;
const POLL_INTERVAL_MS = 60 * 1000;

export function WatchlistExpiryChecker({ markets: prefetched }: { markets?: CachedMarket[] }) {
  const notified = useRef<Set<string>>(new Set());

  // Poll via React Query; the effect below only reacts to the cache, it never
  // fetches directly. When the parent page already fetched the open market
  // list server-side (home page prefetch), seed the query with it so no
  // second /api/markets/cached round trip happens on load.
  const { data: markets } = useQuery({
    queryKey: [...keys.markets.list(), { status: "open", limit: 200 }],
    queryFn: async (): Promise<CachedMarket[]> => {
      const res = await fetch("/api/markets/cached?status=open&limit=200");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.markets)) return [];
      return data.markets as CachedMarket[];
    },
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: 30_000,
    initialData: prefetched && prefetched.length > 0 ? prefetched : undefined,
  });

  useEffect(() => {
    if (!markets || markets.length === 0) return;
    const watchKeys = getWatchlist();
    if (watchKeys.length === 0) return;
    const now = Date.now();
    for (const m of markets) {
      const isWatched = watchKeys.includes(m.marketPubkey) || watchKeys.includes(String(m.marketId));
      if (!isWatched) continue;
      const endTs = new Date(m.endTs).getTime();
      const remaining = endTs - now;
      if (remaining > 0 && remaining <= EXPIRY_WINDOW_MS && !notified.current.has(m.marketPubkey)) {
        notified.current.add(m.marketPubkey);
        toast.warning("Market closing soon", {
          description: `${m.question} closes in under an hour.`,
          action: {
            label: "View",
            onClick: () => window.location.assign(`/market/${m.marketPubkey}`),
          },
        });
      }
    }
  }, [markets]);

  return null;
}
