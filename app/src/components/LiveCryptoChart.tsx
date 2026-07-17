"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import type { PricePoint } from "@/hooks/usePythPriceHistory";

function fmtPrice(p: number): string {
  if (p < 0.00001) return `$${p.toExponential(2)}`;
  if (p < 0.001) return `$${p.toFixed(6)}`;
  if (p < 0.01) return `$${p.toFixed(5)}`;
  if (p < 0.1) return `$${p.toFixed(4)}`;
  if (p < 1) return `$${p.toFixed(3)}`;
  if (p < 100) return `$${p.toFixed(2)}`;
  if (p < 10000) return `$${(p).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${(p / 1000).toFixed(1)}K`;
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

const PAD = { t: 12, r: 16, b: 32, l: 62 };
const CHART_H = 220;
const DEMO_PTS = 80;

function makeSeed(bp: number): PricePoint[] {
  const now = Date.now();
  const pts: PricePoint[] = [];
  let p = bp;
  for (let i = 0; i < DEMO_PTS; i++) {
    p = p + (Math.random() - 0.48) * bp * 0.003;
    if (p < bp * 0.93) p = bp * 0.93;
    if (p > bp * 1.07) p = bp * 1.07;
    pts.push({ price: Math.max(0.0001, p), time: now - (DEMO_PTS - 1 - i) * 300 });
  }
  return pts;
}

export function LiveCryptoChart({
  data,
  currentPrice,
  targetPrice,
  targetExpo,
  symbol = "",
}: {
  data: PricePoint[];
  currentPrice: number | null;
  targetPrice?: number;
  targetExpo?: number;
  symbol?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [frame, setFrame] = useState(0);
  const ptsRef = useRef<PricePoint[]>([]);
  const ivRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const basePrice = (currentPrice && currentPrice > 0)
    ? currentPrice
    : (targetPrice != null && targetExpo != null ? targetPrice / Math.pow(10, Math.abs(targetExpo)) : 100);

  const useLive = data.length >= 2;

  // Manage demo interval — keyed by useLive so it restarts when switching modes
  useEffect(() => {
    if (useLive) {
      ptsRef.current = [];
      return;
    }

    ptsRef.current = makeSeed(basePrice);
    setFrame((f) => f + 1);

    ivRef.current = setInterval(() => {
      const prev = ptsRef.current;
      const bp = basePrice > 0 ? basePrice : 100;
      const last = prev.length > 0 ? prev[prev.length - 1].price : bp;
      const drift = (Math.random() - 0.48) * bp * 0.003;
      let np = last + drift;
      if (np < bp * 0.93) np = bp * 0.93;
      if (np > bp * 1.07) np = bp * 1.07;
      ptsRef.current = [...prev.slice(-(DEMO_PTS - 1)), { price: Math.max(0.0001, np), time: Date.now() }];
      setFrame((f) => f + 1);
    }, 400);

    return () => {
      if (ivRef.current) clearInterval(ivRef.current);
      ivRef.current = null;
    };
  }, [useLive]);

  // Build chart SVG data directly — no useMemo, always fresh
  const chartData = useLive ? data : ptsRef.current;

  // Compute SVG
  const drawW = width - PAD.l - PAD.r;
  const drawH = (CHART_H - PAD.t - PAD.b);

  let yScale = (_v: number) => 0;
  let xScale = (_v: number) => 0;
  let yLabels: { val: number; y: number }[] = [];
  let xLabels: { time: number; x: number }[] = [];
  let linePoints = "";
  let targetY: number | null = null;
  let curY = 0;
  let priceChange = 0;
  let priceChangePct = 0;
  let lastPrice = basePrice;

  const targetNorm = (targetPrice != null && targetExpo != null)
    ? targetPrice / Math.pow(10, Math.abs(targetExpo))
    : null;

  if (chartData.length >= 2 && drawW > 0 && drawH > 0) {
    const prices = chartData.map((d) => d.price);
    let min = Math.min(...prices);
    let max = Math.max(...prices);
    let range = max - min || 1;
    min -= range * 0.12;
    max += range * 0.12;

    if (targetNorm != null) {
      if (targetNorm < min) min = targetNorm - range * 0.05;
      if (targetNorm > max) max = targetNorm + range * 0.05;
    }

    range = max - min || 1;
    yScale = (v: number) => PAD.t + drawH - ((v - min) / range) * drawH;
    const firstTime = chartData[0].time;
    const lastTime = chartData[chartData.length - 1].time;
    const timeRange = Math.max(lastTime - firstTime, 100);
    xScale = (v: number) => PAD.l + ((v - firstTime) / timeRange) * drawW;

    yLabels = [];
    for (let i = 0; i <= 4; i++) yLabels.push({ val: min + range * (i / 4), y: yScale(min + range * (i / 4)) });

    xLabels = [];
    for (let i = 0; i <= 4; i++) {
      const t = firstTime + timeRange * (i / 4);
      xLabels.push({ time: t, x: xScale(t) });
    }

    linePoints = chartData.map((d) => `${xScale(d.time)},${yScale(d.price)}`).join(" ");
    targetY = targetNorm != null ? yScale(targetNorm) : null;
    curY = yScale(chartData[chartData.length - 1].price);
    priceChange = chartData[chartData.length - 1].price - chartData[0].price;
    priceChangePct = chartData[0].price !== 0 ? (priceChange / chartData[0].price) * 100 : 0;
    lastPrice = chartData[chartData.length - 1].price;
  }

  const isPos = priceChange >= 0;
  const lineColor = isPos ? "#a1d494" : "#ffb4ab";

  // ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(e.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full select-none space-y-3">
      {/* Top bar */}
      <div className="flex items-baseline gap-3 px-1">
        {symbol && <span className="text-xs font-bold font-mono text-[#06b6d4] uppercase">{symbol}</span>}
        <span className="text-xl font-bold font-mono text-[#e5e2e1] tracking-tight transition-all duration-300">
          {fmtPrice(lastPrice)}
        </span>
        <span className={`text-[11px] font-mono font-semibold flex items-center gap-0.5 transition-all duration-300 ${lineColor}`}>
          {isPos ? "▲" : "▼"} {Math.abs(priceChangePct).toFixed(2)}%
        </span>
        {!useLive && (
          <span className="text-[9px] font-mono text-[#d6c4ac]/25 ml-auto animate-pulse">SIMULATED</span>
        )}
        {useLive && (
          <span className="text-[9px] font-mono text-[#d6c4ac]/30 ml-auto">{data.length} pts</span>
        )}
      </div>

      {/* Chart SVG */}
      {chartData.length < 2 ? (
        <div className="flex items-center justify-center h-[220px] text-[10px] font-mono text-[#d6c4ac]">
          <span className="animate-pulse opacity-40">Loading price data...</span>
        </div>
      ) : (
        <svg width={width} height={CHART_H} className="overflow-visible">
          {targetY != null && (
            <g>
              <line x1={PAD.l} y1={targetY} x2={width - PAD.r} y2={targetY} stroke="#ffd89c" strokeWidth="1.5" strokeDasharray="6 4" />
              <rect x={width - PAD.r - 82} y={targetY - 9} width={82} height={18} rx="3" fill="#1c1c1c" stroke="#ffd89c" strokeWidth="0.5" />
              <text x={width - PAD.r - 6} y={targetY + 4} textAnchor="end" fill="#ffd89c" fontSize="10" fontFamily="monospace" fontWeight="bold">Target {fmtPrice(targetNorm!)}</text>
            </g>
          )}

          {yLabels.map(({ val, y }) => (
            <g key={val.toFixed(4)}>
              <line x1={PAD.l} y1={y} x2={width - PAD.r} y2={y} stroke="#353534" strokeWidth="1" strokeDasharray="3 3" />
              <text x={PAD.l - 6} y={y + 3} textAnchor="end" fill="#d6c4ac" fontSize="10" fontFamily="monospace" opacity="0.7">{fmtPrice(val)}</text>
            </g>
          ))}

          {xLabels.map(({ time, x }) => (
            <text key={time} x={x} y={CHART_H - 6} textAnchor="middle" fill="#d6c4ac" fontSize="9" fontFamily="monospace" opacity="0.5">{fmtTime(time)}</text>
          ))}

          {linePoints && (
            <polyline fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={linePoints} />
          )}

          {curY > 0 && (
            <g>
              <line x1={PAD.l} y1={curY} x2={width - PAD.r} y2={curY} stroke={lineColor} strokeWidth="1" strokeDasharray="2 2" opacity="0.3" />
              <circle cx={xScale(chartData[chartData.length - 1].time)} cy={curY} r="4" fill="#131313" stroke={lineColor} strokeWidth="2" />
            </g>
          )}
        </svg>
      )}
    </div>
  );
}
