"use client";

import { useState, useEffect, useRef } from "react";

export interface PythPriceData {
  price: number | null;
  confidence: number | null;
  publishTime: number | null;
  error: string | null;
}

const POLL_MS = 2_000;

function hexToId(hex: string): string {
  return hex.startsWith("0x") ? hex.slice(2) : hex;
}

export function usePythPrices(feedIds: string[]): Record<string, PythPriceData> {
  const [data, setData] = useState<Record<string, PythPriceData>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeRef = useRef(true);

  const deduped = [...new Set(feedIds.map(hexToId).filter(Boolean))];

  useEffect(() => {
    activeRef.current = true;

    const fetchPrices = async () => {
      if (deduped.length === 0) return;

      const url = `https://hermes.pyth.network/v2/updates/price/latest?${deduped.map((id) => `ids%5B%5D=${id}`).join("&")}`;

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!activeRef.current) return;

        if (json.parsed) {
          const now = Math.floor(Date.now() / 1000);
          setData((prev) => {
            const next = { ...prev };
            for (const update of json.parsed) {
              const pid = update.id;
              const p = update.price;
              if (p) {
                const price = Number(p.price) * Math.pow(10, p.expo);
                const conf = p.conf ? Number(p.conf) * Math.pow(10, p.expo) : null;
                next[pid] = {
                  price,
                  confidence: conf,
                  publishTime: p.publish_time ?? now,
                  error: null,
                };
              }
            }
            return next;
          });
        }
      } catch (err: unknown) {
        if (!activeRef.current) return;
      }
    };

    if (deduped.length > 0) {
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
  }, [JSON.stringify(deduped)]);

  const result: Record<string, PythPriceData> = {};
  for (const id of deduped) {
    result[id] = data[id] ?? { price: null, confidence: null, publishTime: null, error: null };
  }
  return result;
}
