"use client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { usePythPriceHistory } from "@/hooks/usePythPriceHistory";

interface Props {
  feedIdHex?: string;
  targetPrice?: number;
  height?: number;
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export default function PriceChart({ feedIdHex, targetPrice, height = 240 }: Props) {
  const { history, currentPrice, error } = usePythPriceHistory(
    feedIdHex ?? null
  );
  const loading = history.length === 0 && !error;

  if (loading) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-secondary)",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
        }}
      >
        Fetching live price...
      </div>
    );
  }

  if (error && history.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-no)",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
        }}
      >
        Price unavailable
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-secondary)",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
        }}
      >
        No price data
      </div>
    );
  }

  const min = Math.min(...history.map((p) => p.price)) * 0.998;
  const max = Math.max(...history.map((p) => p.price)) * 1.002;

  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "28px",
          fontWeight: 700,
          color: "var(--color-primary)",
          marginBottom: "8px",
        }}
      >
        ${currentPrice?.toFixed(2) ?? "—"}
        <span
          style={{
            fontSize: "13px",
            color: "var(--color-text-secondary)",
            marginLeft: "8px",
          }}
        >
          SOL/USD live
        </span>
      </div>

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={history}
          margin={{ top: 4, right: 8, bottom: 0, left: 8 }}
        >
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ffd89c" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#ffd89c" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            tick={{
              fill: "var(--color-text-secondary)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[min, max]}
            tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            tick={{
              fill: "var(--color-text-secondary)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip
            contentStyle={{
              background: "var(--color-surface-variant)",
              border: "1px solid var(--color-outline)",
              borderRadius: "6px",
              fontFamily: "var(--font-mono)",
              fontSize: "12px",
              color: "var(--color-text-primary)",
            }}
            formatter={(v: any) => [`$${(Number(v) ?? 0).toFixed(4)}`, "SOL/USD"]}
            labelFormatter={(label: any) => formatTime(Number(label) ?? 0)}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#ffd89c"
            strokeWidth={2}
            fill="url(#priceGrad)"
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {targetPrice && (
        <div
          style={{
            marginTop: "8px",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            color: "var(--color-text-secondary)",
          }}
        >
          Target: <span style={{ color: "var(--color-yes)" }}>${targetPrice.toFixed(2)}</span>
          {currentPrice && (
            <span style={{ marginLeft: "12px" }}>
              {currentPrice > targetPrice
                ? <span style={{ color: "var(--color-yes)" }}>YES winning</span>
                : <span style={{ color: "var(--color-no)" }}>NO winning</span>
              }
            </span>
          )}
        </div>
      )}
    </div>
  );
}