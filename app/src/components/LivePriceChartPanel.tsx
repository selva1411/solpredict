"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRealtime } from "@/hooks/useRealtime";
import { TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const SOL_FEED_ID = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const MAX_POINTS = 120;
const POLL_MS = 5000;

async function fetchSOLPrice(): Promise<number> {
  try {
    const res = await fetch(
      `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${SOL_FEED_ID}`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const json = await res.json();
      const p = json.parsed?.[0]?.price;
      if (p?.price && p?.expo !== undefined) {
        const price = Number(p.price) * Math.pow(10, Number(p.expo));
        if (price > 1 && price < 10000) return price;
      }
    }
  } catch { /* fall through */ }

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
    const res = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=SOLUSDT",
      { cache: "no-store" }
    );
    if (res.ok) {
      const json = await res.json();
      const price = parseFloat(json.price);
      if (price > 1) return price;
    }
  } catch { /* fall through */ }

  // No synthetic fallback: return 0 so the UI shows an explicit error state
  // instead of displaying fabricated LIVE prices.
  return 0;
}

export const LivePriceChartPanel = React.memo(function LivePriceChartPanel() {
  const [chartData, setChartData] = useState<{ time: number; price: number }[]>([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [prevPrice, setPrevPrice] = useState(0);
  const [priceStatus, setPriceStatus] = useState<"loading" | "live" | "error">("loading");

  const priceHistoryRef = useRef<{ time: number; price: number }[]>([]);
  const latestPriceRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  useRealtime("global:ticker", (payload: unknown) => {
    if (!mountedRef.current) return;
    const tick = payload as { solPrice: number };
    if (tick?.solPrice) appendPrice(tick.solPrice);
  });

  function appendPrice(newPrice: number) {
    setPrevPrice(latestPriceRef.current);
    setCurrentPrice(newPrice);
    latestPriceRef.current = newPrice;
    const newPoint = { time: Date.now(), price: newPrice };
    priceHistoryRef.current = [
      ...priceHistoryRef.current.slice(-(MAX_POINTS - 1)),
      newPoint,
    ];
    setChartData([...priceHistoryRef.current]);
  }

  useEffect(() => {
    let mounted = true;
    mountedRef.current = true;

    async function init() {
      setPriceStatus("loading");
      const realPrice = await fetchSOLPrice();
      if (!mounted) return;

      if (realPrice === 0) {
        setPriceStatus("error");
        return;
      }

      setPriceStatus("live");
      setCurrentPrice(realPrice);
      setPrevPrice(realPrice);
      latestPriceRef.current = realPrice;

      // Seed history from previously-published real ticks only (no synthetic
      // drift). If none exist, start with the single real price point.
      const now = Date.now();
      const existing = priceHistoryRef.current.slice(-60);
      const seed = existing.length > 0
        ? existing
        : [{ time: now, price: realPrice }];
      priceHistoryRef.current = seed;
      if (mounted) setChartData([...seed]);

      intervalRef.current = setInterval(async () => {
        if (!mounted) return;
        const newPrice = await fetchSOLPrice();
        if (newPrice === 0 || !mounted) return;
        appendPrice(newPrice);
      }, 30_000);
    }

    init();
    return () => {
      mounted = false;
      mountedRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="glass-panel p-6 sm:p-8 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider font-display text-[#d6c4ac] flex items-center space-x-2">
        <TrendingUp className="w-4 h-4 text-gold" />
        <span>Live Price Chart</span>
      </h3>

      {/* Header / Badge */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          {priceStatus === "live" && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-[2px] bg-gold-lite opacity-75" />
              <span className="relative inline-flex rounded-[2px] h-2 w-2 bg-gold-lite" />
            </span>
          )}
          {priceStatus === "loading" && (
            <span className="h-2 w-2 rounded-[2px] bg-ash animate-pulse" />
          )}
          {priceStatus === "error" && (
            <span className="h-2 w-2 rounded-[2px] bg-bordeaux" />
          )}
          <span className="text-xs font-mono text-ash">
            {priceStatus === "loading" && "Fetching price..."}
            {priceStatus === "live" && `LIVE · SOL/USD · every ${POLL_MS / 1000}s`}
            {priceStatus === "error" && "Price feed unavailable"}
          </span>
        </div>
        {currentPrice > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className={`text-[21px] font-bold font-mono ${currentPrice >= prevPrice ? "text-verdigris" : "text-bordeaux"}`}>
              ${currentPrice.toFixed(4)}
            </span>
            <span className={`text-xs font-mono ${currentPrice >= prevPrice ? "text-verdigris" : "text-bordeaux"}`}>
              {currentPrice >= prevPrice ? "▲" : "▼"} {Math.abs(currentPrice - prevPrice).toFixed(4)}
            </span>
          </div>
        )}
      </div>

      {priceStatus === "error" ? (
        <div className="flex items-center justify-center h-64 border border-[#353534] rounded font-mono text-[13px] text-ash">
          Could not connect to price feed.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ffd89c" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#ffd89c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#252525" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={(t: unknown) =>
                new Date(Number(t)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
              }
              stroke="#808495"
              tick={{ fill: "#808495", fontSize: 10, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            <YAxis
              domain={["auto", "auto"]}
              stroke="#808495"
              tick={{ fill: "#808495", fontSize: 10, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: unknown) => `$${Number(v).toFixed(2)}`}
              width={70}
            />
            <Tooltip
              contentStyle={{
                background: "#1a1a1a",
                border: "1px solid #808495",
                borderRadius: 2,
                fontFamily: "JetBrains Mono",
                fontSize: 11,
                color: "#F4F4F9",
                padding: "6px 10px",
              }}
              labelFormatter={(t: unknown) =>
                new Date(Number(t)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
              }
              formatter={(v: unknown) => [`$${Number(v).toFixed(4)}`, "SOL/USD"]}
              cursor={{ stroke: "#9e8e78", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke="#ffd89c"
              strokeWidth={1.5}
              fill="url(#priceGradient)"
              dot={false}
              activeDot={{ r: 3, fill: "#ffd89c", stroke: "#131313", strokeWidth: 1 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
});
