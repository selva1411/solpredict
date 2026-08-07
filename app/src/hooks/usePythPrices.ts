"use client";

import { useQuery } from "@tanstack/react-query";

export interface PythPriceData {
  price: number | null;
  confidence: number | null;
  publishTime: number | null;
  error: string | null;
}

const POLL_MS = 5_000;

function hexToId(hex: string): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return clean.toLowerCase();
}

function isValidPythHex(id: string): boolean {
  if (!id || /^0+$/.test(id)) return false;
  return /^[0-9a-f]{64}$/i.test(id);
}

const failedFeedIds = new Set<string>();

export function usePythPrices(feedIds: string[]): Record<string, PythPriceData> {
  const rawDeduped = [...new Set(feedIds.map(hexToId).filter(Boolean))];
  const validHermesFeeds = rawDeduped.filter((id) => isValidPythHex(id) && !failedFeedIds.has(id));
  const feedsKey = validHermesFeeds.sort().join(",");

  const { data } = useQuery({
    queryKey: ["pyth", "prices", feedsKey],
    queryFn: async (): Promise<Record<string, PythPriceData>> => {
      if (validHermesFeeds.length === 0) return {};
      const url = `https://hermes.pyth.network/v2/updates/price/latest?${validHermesFeeds.map((id) => `ids%5B%5D=${id}`).join("&")}`;
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 404) {
          validHermesFeeds.forEach((id) => failedFeedIds.add(id));
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as {
        parsed?: Array<{ id: string; price: { price: string; conf?: string; expo: number; publish_time?: number } }>;
      };
      const out: Record<string, PythPriceData> = {};
      for (const update of json.parsed ?? []) {
        const pid = update.id.toLowerCase();
        const p = update.price;
        if (p) {
          const price = Number(p.price) * Math.pow(10, p.expo);
          const conf = p.conf ? Number(p.conf) * Math.pow(10, p.expo) : null;
          out[pid] = {
            price,
            confidence: conf,
            publishTime: p.publish_time ?? Math.floor(Date.now() / 1000),
            error: null,
          };
        }
      }
      return out;
    },
    enabled: validHermesFeeds.length > 0,
    refetchInterval: POLL_MS,
    staleTime: 0,
    // Keep last known prices between polls so a transient failure never blanks
    // the UI with placeholder zeros.
    placeholderData: (prev) => prev,
  });

  const result: Record<string, PythPriceData> = {};
  for (const id of rawDeduped) {
    result[id] =
      data?.[id] ?? { price: null, confidence: null, publishTime: null, error: "Feed not loaded yet" };
  }
  return result;
}
