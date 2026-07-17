"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";

interface Candle {
  time: number;
  price: number;
}

const MAX_CANDLES = 200;
const POLL_MS = 3000;

function fetchPythPrice(feedId: string): Promise<number | null> {
  const id = feedId.replace("0x", "");
  return fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=${id}`)
    .then((r) => r.json())
    .then((json) => {
      const p = json.parsed?.[0]?.price;
      if (!p) return null;
      return Number(p.price) * Math.pow(10, p.expo);
    })
    .catch(() => null);
}

interface LiveCryptoChartProps {
  feedHex?: string;
  targetPrice?: number;
  targetExpo?: number;
  symbol?: string;
}

export function LiveCryptoChart({
  feedHex,
  targetPrice,
  targetExpo,
  symbol = "",
}: LiveCryptoChartProps) {
  const [chartData, setChartData] = useState<Candle[]>(() => {
    const now = Date.now();
    const base = 150;
    return Array.from({ length: 60 }, (_, i) => ({
      time: now - (60 - i) * 3000,
      price: base + (Math.random() - 0.5) * base * 0.02,
    }));
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const id = feedHex ? feedHex.replace("0x", "") : null;

    const poll = async () => {
      if (!id) return;
      const price = await fetchPythPrice(feedHex!);
      if (price === null) return;
      setChartData((prev) => {
        const next = [...prev, { time: Date.now(), price }];
        return next.slice(-MAX_CANDLES);
      });
    };

    if (id) poll();
    intervalRef.current = setInterval(poll, POLL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [feedHex]);

  const targetNorm = (targetPrice != null && targetExpo != null)
    ? targetPrice / Math.pow(10, Math.abs(targetExpo))
    : null;

  const lastPrice = chartData.length > 0 ? chartData[chartData.length - 1].price : 0;
  const firstPrice = chartData.length > 0 ? chartData[0].price : 0;
  const priceChange = lastPrice - firstPrice;
  const isPos = priceChange >= 0;
  const lineColor = isPos ? "#ffd89c" : "#ffb4ab";
  const gradientId = "priceGradient";

  return (
    <div className="w-full select-none space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ffd89c] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ffd89c]" />
        </span>
        <span className="text-xs font-mono text-[#9e8e78]">
          LIVE{feedHex ? ` · ${symbol || 'SOL/USD'}` : ''} · updates every 3s
        </span>
        <span className="ml-auto flex items-baseline gap-2">
          <span className="text-sm font-mono text-[#e5e2e1] font-bold">
            ${lastPrice.toFixed(4)}
          </span>
          <span className={`text-[11px] font-mono font-semibold ${lineColor}`}>
            {isPos ? "▲" : "▼"} {Math.abs(priceChange).toFixed(4)}
          </span>
        </span>
      </div>

      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ffd89c" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ffd89c" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#353534" vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              stroke="#9e8e78"
              tick={{ fill: '#9e8e78', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={['auto', 'auto']}
              stroke="#9e8e78"
              tick={{ fill: '#9e8e78', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v.toFixed(1)}`}
              width={65}
            />
            <Tooltip
              contentStyle={{
                background: '#1a1a1a',
                border: '1px solid #9e8e78',
                borderRadius: 4,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
                color: '#e5e2e1',
              }}
              labelFormatter={(t: unknown) => new Date(Number(t)).toLocaleTimeString()}
              formatter={(v: unknown) => [`$${Number(v).toFixed(4)}`, symbol || 'SOL/USD']}
            />
            {targetNorm != null && (
              <ReferenceLine
                y={targetNorm}
                stroke="#ffd89c"
                strokeDasharray="6 3"
                label={{
                  value: `Target $${targetNorm.toFixed(2)}`,
                  fill: '#ffd89c',
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="price"
              stroke={lineColor}
              strokeWidth={1.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: '#ffd89c', stroke: '#131313' }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
