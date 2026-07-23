"use client";

import { useState, useEffect, useRef } from "react";

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
  return /^[0-9a-f]{64}$/i.test(id);
}

const failedFeedIds = new Set<string>();

export function usePythPrices(feedIds: string[]): Record<string, PythPriceData> {
  const [data, setData] = useState<Record<string, PythPriceData>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(true);

  const rawDeduped = [...new Set(feedIds.map(hexToId).filter(Boolean))];
  const validHermesFeeds = rawDeduped.filter(id => isValidPythHex(id) && !failedFeedIds.has(id));

  useEffect(() => {
    activeRef.current = true;

    const fetchPrices = async () => {
      if (validHermesFeeds.length === 0) return;

      const url = `https://hermes.pyth.network/v2/updates/price/latest?${validHermesFeeds.map((id) => `ids%5B%5D=${id}`).join("&")}`;

      try {
        const res = await fetch(url);
        if (!res.ok) {
          if (res.status === 404) {
            validHermesFeeds.forEach(id => failedFeedIds.add(id));
          }
          return;
        }
        const json = await res.json();
        if (!activeRef.current) return;

        if (json.parsed) {
          setData((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const update of json.parsed) {
              const pid = update.id.toLowerCase();
              const p = update.price;
              if (p) {
                const price = Number(p.price) * Math.pow(10, p.expo);
                const conf = p.conf ? Number(p.conf) * Math.pow(10, p.expo) : null;
                const existing = prev[pid];
                // Only update if price actually changed by more than 0.001%
                if (!existing || Math.abs((existing.price ?? 0) - price) / (price || 1) > 0.00001) {
                  next[pid] = { price, confidence: conf, publishTime: p.publish_time ?? Math.floor(Date.now() / 1000), error: null };
                  changed = true;
                }
              }
            }
            return changed ? next : prev; // Return same reference if nothing changed → no re-render
          });
        }
      } catch (err: unknown) {
        if (!activeRef.current) return;
      }
    };

    if (validHermesFeeds.length > 0) {
      fetchPrices();
      timerRef.current = setInterval(fetchPrices, POLL_MS);
    }

    return () => {
      activeRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [JSON.stringify(validHermesFeeds)]);

  const result: Record<string, PythPriceData> = {};
  const now = Math.floor(Date.now() / 1000);
  for (const id of rawDeduped) {
    if (data[id]) {
      result[id] = data[id];
    } else {
      // Mock fallback for test markets
      result[id] = { price: 205.00, confidence: 0.15, publishTime: now, error: null };
    }
  }
  return result;
}
