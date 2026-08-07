"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from "recharts";
import { usePythPriceHistory } from "@/hooks/usePythPriceHistory";
import type { UiMarket } from "@/lib/market-adapter";

interface PriceChartProps {
  market: UiMarket;
  yesPrice: number;
  height?: number;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export function PriceChart({ market, yesPrice, height = 260 }: PriceChartProps) {
  const { history: pythHistory, currentPrice } = usePythPriceHistory(market.oracleFeedId);

  const data = useMemo(() => {
    if (!pythHistory || pythHistory.length === 0) return [];
    return pythHistory.map((p) => ({
      time: p.time,
      price: p.price,
      volume: 0,
    }));
  }, [pythHistory]);

  const chartData = data.length > 0 ? data : [];

  return (
    <div className="holo-card p-5">
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div>
          <h3 className="font-display text-sm font-semibold">YES Price History</h3>
          <p className="text-[10px] font-mono text-[#808495]">Pyth oracle feed · real-time</p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-mono">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#FFA500]"></span> Price
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFA500" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#FFA500" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="3 3" />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            stroke="#808495"
            tick={{ fontSize: 10, fontFamily: "monospace" }}
            tickLine={false}
            axisLine={false}
            interval={10}
          />
          <YAxis
            domain={["auto", "auto"]}
            stroke="#808495"
            tick={{ fontSize: 10, fontFamily: "monospace" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(12,13,18,0.95)",
              border: "2px solid #2D3142",
              borderRadius: "4px",
              fontSize: "11px",
              fontFamily: "monospace",
              color: "#F4F4F9",
            }}
            labelFormatter={(label) => formatTime(Number(label))}
            formatter={(value: any) => [`$${Number(value).toFixed(3)}`, "Price"]}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#FFA500"
            strokeWidth={2}
            fill="url(#priceFill)"
            dot={false}
            activeDot={{ r: 4, fill: "#FFA500", stroke: "#fff", strokeWidth: 2 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}