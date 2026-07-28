"use client";

import { useState, useEffect } from "react";

let cachedPrice: number | null = null;

async function fetchSolPrice(): Promise<number> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { cache: "no-store" }
    );
    if (res.ok) {
      const json = await res.json();
      const price = json?.solana?.usd;
      if (price && price > 1) return price;
    }
  } catch { /* fall through */ }

  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT", { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      const price = parseFloat(json?.price);
      if (price && price > 1) return price;
    }
  } catch { /* fall through */ }

  return cachedPrice ?? 0;
}

export function useSolPrice(): { solPrice: number; loading: boolean } {
  const [solPrice, setSolPrice] = useState(cachedPrice ?? 0);
  const [loading, setLoading] = useState(!cachedPrice);

  useEffect(() => {
    if (cachedPrice !== null) return;
    setLoading(true);
    fetchSolPrice().then((price) => {
      cachedPrice = price;
      setSolPrice(price);
    }).catch(() => {}).finally(() => setLoading(false));

    const interval = setInterval(() => {
      fetchSolPrice().then((price) => {
        cachedPrice = price;
        setSolPrice(price);
      }).catch(() => {});
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  return { solPrice, loading };
}
