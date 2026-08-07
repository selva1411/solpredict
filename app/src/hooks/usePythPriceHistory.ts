"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

export interface PricePoint {
  price: number;
  time: number;
}

const MAX_POINTS = 120;
const POLL_MS = 2_000;

function hexToId(hex: string): string {
  return hex.startsWith("0x") ? hex.slice(2) : hex;
}

export function usePythPriceHistory(feedIdHex: string | null) {
  const [history, setHistory] = useState<PricePoint[]>([]);
  const id = feedIdHex ? hexToId(feedIdHex) : null;

  const { data, error } = useQuery({
    queryKey: ["pyth", "price", id ?? "none"],
    queryFn: async (): Promise<{ price: number; publishTime: number } | null> => {
      if (!id) return null;
      const res = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        parsed?: Array<{ price: { price: string; expo: number; publish_time?: number } }>;
      };
      const p = json.parsed?.[0]?.price;
      if (!p) return null;
      return {
        price: Number(p.price) * Math.pow(10, p.expo),
        publishTime: p.publish_time ?? Math.floor(Date.now() / 1000),
      };
    },
    enabled: !!id,
    refetchInterval: POLL_MS,
    staleTime: 0,
  });

  // Append each successful tick to the rolling buffer. No fetch lives here —
  // data comes from the React Query cache above.
  useEffect(() => {
    if (data && data.price != null) {
      setHistory((prev) => [...prev, { price: data.price, time: Date.now() }].slice(-MAX_POINTS));
    }
  }, [data]);

  return {
    history,
    currentPrice: data?.price ?? null,
    error: error ? (error instanceof Error ? error.message : "Fetch failed") : null,
  };
}
