"use client";

import { useState, useEffect } from "react";

let cachedPrice: number | null = null;

async function fetchSolPrice(): Promise<number> {
  try {
    const res = await fetch("/api/market-data/sol-price", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const price = json?.price;
      if (price && price > 1) return price;
    }
  } catch {
    return cachedPrice ?? 0;
  }
  return cachedPrice ?? 0;
}

export function useSolPrice(): { solPrice: number; loading: boolean } {
  const [solPrice, setSolPrice] = useState(cachedPrice ?? 0);
  const [loading, setLoading] = useState(!cachedPrice);

  useEffect(() => {
    let cancelled = false;
    if (cachedPrice === null) {
      setLoading(true);
      fetchSolPrice()
        .then((price) => {
          if (cancelled) return;
          cachedPrice = price;
          setSolPrice(price);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }

    const interval = setInterval(() => {
      fetchSolPrice().then((price) => {
        if (cancelled) return;
        cachedPrice = price;
        setSolPrice(price);
      });
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { solPrice, loading };
}