"use client";

import React from "react";
import { PYTH_FEED_REGISTRY } from "@/lib/pyth-feeds";
import { usePythPrices } from "@/hooks/usePythPrices";

export interface LivePriceBarProps {
  feedIdHex: string;
  category: number;
  targetPrice: number;
  targetExpo: number;
  comparison: number;
  compact?: boolean;
}

function formatPrice(price: number): string {
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  if (price < 10000) return `$${price.toFixed(2)}`;
  return `$${(price / 1000).toFixed(1)}K`;
}

function formatTarget(price: number, expo: number): string {
  const raw = price;
  const divider = Math.pow(10, Math.abs(expo));
  const normalized = raw / divider;
  return `$${normalized.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function LivePriceBar({
  feedIdHex,
  category,
  targetPrice,
  targetExpo,
  comparison,
  compact = false,
}: LivePriceBarProps) {
  const isOracleCat = category === 0 || category === 3 || category === 4;

  // ── Own the Pyth price fetch internally so it doesn't cause parent re-renders ──
  const feedIds = isOracleCat && feedIdHex ? [feedIdHex] : [];
  const livePrices = usePythPrices(feedIds);
  const cleanId = feedIdHex?.replace("0x", "") ?? "";
  const priceData = cleanId ? livePrices[cleanId] : null;

  if (!isOracleCat) {
    return (
      <span className="px-2 py-0.5 text-[9px] font-bold font-mono rounded bg-[#7B3FE4]/10 border border-[#7B3FE4]/30 text-[#7B3FE4] inline-flex items-center gap-1">
        ⚖️ Manually resolved
      </span>
    );
  }

  const lookupKey = Object.entries(PYTH_FEED_REGISTRY).find(([, entry]) =>
    feedIdHex.toLowerCase().includes(entry.feedIdHex.slice(2).toLowerCase()) ||
    entry.feedIdHex.toLowerCase().includes(feedIdHex.toLowerCase())
  );
  const entry = lookupKey ? lookupKey[1] : null;

  const livePrice = priceData?.price ?? null;
  const liveError = priceData?.error ?? null;
  const liveLoading = !priceData;

  if (liveLoading) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#d6c4ac] animate-pulse">
        <span className="w-3 h-3 rounded-full border border-[#d6c4ac]/40 border-t-transparent animate-spin" />
        Loading price...
      </span>
    );
  }

  if (liveError || livePrice === null) {
    return (
      <span className="text-[10px] font-mono text-[#ffb4ab]">
        {entry ? `${entry.symbol}: —` : "Feed unavailable"}
      </span>
    );
  }

  const targetNormalized = targetPrice / Math.pow(10, Math.abs(targetExpo));
  const delta = livePrice - targetNormalized;
  const deltaPct = targetNormalized !== 0 ? (delta / targetNormalized) * 100 : 0;

  const yesWinning = comparison === 0 ? delta > 0 : delta < 0;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-mono">
        <span className="text-[#06b6d4] font-bold">{entry?.symbol ?? feedIdHex.slice(0, 8)}</span>
        <span className="text-[#F4F5FA]">{formatPrice(livePrice)}</span>
        <span className={yesWinning ? "text-[#a1d494]" : "text-[#ffb4ab]"}>
          {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct).toFixed(1)}%
        </span>
      </span>
    );
  }

  const barPct = Math.min(Math.max(((livePrice - targetNormalized * 0.8) / (targetNormalized * 0.4)) * 50 + 50, 0), 100);

  return (
    <div className="space-y-1.5 font-mono">
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-[#d6c4ac] text-[10px] uppercase tracking-wider font-display font-bold">Live Price</span>
          <span className="text-[#06b6d4] font-bold">{entry?.symbol ?? "Feed"}</span>
          <span className="text-[#F4F5FA] text-sm font-bold">{formatPrice(livePrice)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-[#d6c4ac]">
            Target: {formatTarget(targetPrice, targetExpo)}
          </span>
          <span className={`text-xs font-bold px-2 py-0.5 rounded ${yesWinning ? "bg-[#a1d494]/20 text-[#a1d494]" : "bg-[#ffb4ab]/20 text-[#ffb4ab]"}`}>
            {comparison === 0 ? ">" : "<"} Target — {yesWinning ? "YES" : "NO"} winning
          </span>
        </div>
      </div>
      <div className="w-full h-2 bg-[#0A0B12] rounded overflow-hidden border border-white/10 relative">
        <div
          className="h-full rounded transition-[width] duration-500 ease-out"
          style={{
            width: `${barPct}%`,
            background: yesWinning
              ? "linear-gradient(90deg, #a1d494, #6cb660)"
              : "linear-gradient(90deg, #ffb4ab, #e57373)",
          }}
        />
        <div
          className="absolute top-0 w-0.5 h-full bg-[#ffd89c] z-10"
          style={{ left: "50%" }}
          title="Target price"
        />
      </div>
      <div className="flex justify-between text-[9px] text-[#d6c4ac]/70">
        <span>{comparison === 0 ? "Below target (NO winning)" : "Below target (YES winning)"}</span>
        <span className="font-bold">{deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}% from target</span>
        <span>{comparison === 0 ? "Above target (YES winning)" : "Above target (NO winning)"}</span>
      </div>
    </div>
  );
}
