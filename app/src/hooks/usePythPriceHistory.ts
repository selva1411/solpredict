"use client";

import { useState, useEffect, useRef } from "react";

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
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    activeRef.current = true;
    if (!feedIdHex) return;
    const id = hexToId(feedIdHex);

    const fetchPrice = async () => {
      try {
        const res = await fetch(
          `https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=${id}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!activeRef.current) return;

        if (json.parsed?.[0]?.price) {
          const p = json.parsed[0].price;
          const price = Number(p.price) * Math.pow(10, p.expo);
          const now = Date.now();

          setCurrentPrice(price);
          setHistory((prev) => {
            const next = [...prev, { price, time: now }];
            return next.slice(-MAX_POINTS);
          });
          setError(null);
        }
      } catch (err: unknown) {
        if (activeRef.current) {
          setError(err instanceof Error ? err.message : "Fetch failed");
        }
      }
    };

    fetchPrice();
    timerRef.current = setInterval(fetchPrice, POLL_MS);

    return () => {
      activeRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [feedIdHex]);

  return { history, currentPrice, error };
}
