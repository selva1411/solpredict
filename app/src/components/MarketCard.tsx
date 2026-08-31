"use client";

import React, { memo, useCallback } from "react";
import { motion } from "framer-motion";
import { Clock, TrendingUp, Users, Flame, Star } from "lucide-react";
import { useAppState } from "@/contexts/AppContext";
import type { UiMarket } from "@/lib/market-adapter";
import { FlashValue } from "@/components/ui/flash-value";
import { TimeLeft } from "@/components/ui/time-left";

interface MarketCardProps {
  market: UiMarket;
  index?: number;
  onClick?: () => void;
  selected?: boolean;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M ◎`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K ◎`;
  if (v > 0) return `${v.toFixed(1)} ◎`;
  return `0.0 ◎`;
}

export const MarketCard = memo(function MarketCard({ market, index = 0, onClick, selected }: MarketCardProps) {
  const yesPct = market.yesPrice * 100;
  const noPct = 100 - yesPct;
  const { isWatched, toggleWatchlistItem } = useAppState();
  const watched = isWatched(market.id);

  const handleStarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWatchlistItem(market.id);
  }, [market.id, toggleWatchlistItem]);

  const settled = market.status === "settled";
  const cancelled = market.status === "cancelled";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.4) }}
      onClick={onClick}
      className={`group relative surface rounded-lg p-5 cursor-pointer flex flex-col justify-between gap-4 edge-glow transition-all duration-200 hover:-translate-y-1 ${
        selected ? "border-gold/50 shadow-signal" : ""
      }`}
    >
      {/* top-edge signal line — emerald when YES leads, rose when NO leads */}
      <span
        className="absolute top-0 left-4 right-4 h-[2px] rounded-b-full opacity-70 group-hover:opacity-100 transition-opacity"
        style={{
          background: yesPct >= 50
            ? "linear-gradient(90deg, transparent, var(--color-verdigris), transparent)"
            : "linear-gradient(90deg, transparent, var(--color-bordeaux), transparent)",
          boxShadow: `0 0 12px ${yesPct >= 50 ? "color-mix(in oklab, var(--color-verdigris) 50%, transparent)" : "color-mix(in oklab, var(--color-bordeaux) 60%, transparent)"}`,
        }}
        aria-hidden
      />

      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="label-lux px-2 py-0.5 rounded bg-panel-2 border border-hairline !text-gold/90">
            {market.category}
          </span>
          {(market.hot || market.trending) && (
            <span className="flex items-center gap-1 label-lux text-amber bg-amber/8 px-2 py-0.5 rounded border border-amber/30">
              <Flame size={10} /> HOT
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-ash">
          <button
            onClick={handleStarClick}
            className="p-1 rounded hover:bg-panel-2 transition-colors cursor-pointer"
            title={watched ? "Remove from watchlist" : "Add to watchlist"}
            aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Star className={`w-3.5 h-3.5 transition-colors ${watched ? "fill-amber text-amber" : "text-ash-dim hover:text-ash"}`} />
          </button>
          <span className={`flex items-center gap-1 ${settled ? "text-verdigris" : cancelled ? "text-ash-dim" : "text-ash"}`}>
            <Clock size={11} />
            {settled ? "Settled" : cancelled ? "Cancelled" : <>closes <TimeLeft endDate={market.endDate} /></>}
          </span>
        </div>
      </div>

      {/* Question */}
      <h3 className="font-display font-semibold text-[16px] leading-snug line-clamp-2 text-ivory min-h-[42px] group-hover:text-gold-lite transition-colors">
        {market.question}
      </h3>

      {/* Outcome lines */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded bg-obsidian/80 border border-hairline p-2.5 space-y-1.5 transition-colors hover:border-verdigris/50">
          <div className="flex items-center justify-between">
            <span className="label-lux !text-verdigris">YES</span>
            <span className="text-[9px] font-mono text-ash-dim tnum">{yesPct.toFixed(1)}%</span>
          </div>
          <FlashValue value={yesPct} decimals={1} suffix="¢" className="odds-sm block" />
          <div className="h-1 bg-hairline overflow-hidden rounded-full">
            <div
              className="h-full bg-gradient-to-r from-verdigris/80 to-verdigris rounded-full transition-[width] duration-500"
              style={{ width: `${Math.min(100, Math.max(2, yesPct))}%`, boxShadow: "0 0 6px color-mix(in oklab, var(--color-verdigris) 50%, transparent)" }}
            />
          </div>
        </div>
        <div className="rounded bg-obsidian/80 border border-hairline p-2.5 space-y-1.5 transition-colors hover:border-bordeaux/50">
          <div className="flex items-center justify-between">
            <span className="label-lux !text-bordeaux">NO</span>
            <span className="text-[9px] font-mono text-ash-dim tnum">{noPct.toFixed(1)}%</span>
          </div>
          <FlashValue value={noPct} decimals={1} suffix="¢" className="odds-sm block" />
          <div className="h-1 bg-hairline overflow-hidden rounded-full">
            <div
              className="h-full bg-gradient-to-r from-bordeaux/80 to-bordeaux rounded-full transition-[width] duration-500"
              style={{ width: `${Math.min(100, Math.max(2, noPct))}%`, boxShadow: "0 0 6px color-mix(in oklab, var(--color-bordeaux) 50%, transparent)" }}
            />
          </div>
        </div>
      </div>

      {/* Card Footer Metrics */}
      <div className="flex items-center justify-between font-mono text-[11px] text-ash pt-3 border-t border-hairline">
        <span className="flex items-center gap-1.5">
          <Users size={11} /> {market.traders > 0 ? market.traders.toLocaleString() : "0"} traders
        </span>
        <span className="flex items-center gap-1.5">
          <TrendingUp size={11} /> {formatVolume(market.volume24h || market.liquidity)}
        </span>
      </div>
    </motion.div>
  );
});
