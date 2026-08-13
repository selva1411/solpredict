"use client";

import React, { memo, useCallback } from "react";
import { motion } from "framer-motion";
import { Clock, TrendingUp, Users, Flame, Star } from "lucide-react";
import { Sparkline } from "./Sparkline";
import { useAppState } from "@/contexts/AppContext";
import type { UiMarket } from "@/lib/market-adapter";

interface MarketCardProps {
  market: UiMarket;
  index?: number;
  onClick?: () => void;
  selected?: boolean;
}

function formatTimeLeft(endDate: string): string {
  const t = new Date(endDate).getTime();
  if (Number.isNaN(t)) return "—";
  const ms = t - Date.now();
  if (ms <= 0) return "Ended";
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M SOL`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K SOL`;
  if (v > 0) return `${v.toFixed(1)} SOL`;
  return `0.0 SOL`;
}

export const MarketCard = memo(function MarketCard({ market, index = 0, onClick, selected }: MarketCardProps) {
  const yesPct = market.yesPrice * 100;
  const { isWatched, toggleWatchlistItem } = useAppState();
  const watched = isWatched(market.id);

  const handleStarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWatchlistItem(market.id);
  }, [market.id, toggleWatchlistItem]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      onClick={onClick}
      className={`terminal-card holo-card terminal-card-interactive p-5 cursor-pointer flex flex-col justify-between space-y-4 ${selected ? "border-[var(--accent)]" : ""}`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--surface-0)] border border-[var(--color-gray-800)] text-[var(--color-gray-300)]">
            {market.category}
          </span>
          {market.hot && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[var(--warning)] bg-[var(--warning)]/10 px-2 py-0.5 rounded border border-[var(--warning)]/30">
              <Flame size={10} /> HOT
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-gray-400)]">
          <button
            onClick={handleStarClick}
            className="p-1 rounded hover:bg-[var(--color-gray-800)] transition-colors"
            title={watched ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Star className={`w-3.5 h-3.5 ${watched ? "fill-[var(--warning)] text-[var(--warning)]" : "text-[var(--color-gray-500)]"}`} />
          </button>
          <span
            className={`flex items-center gap-1 ${
              market.status === "settled"
                ? "text-[var(--negative)]"
                : market.status === "cancelled"
                  ? "text-[var(--color-gray-400)]"
                  : ""
            }`}
          >
            <Clock size={11} />
            {market.status === "settled"
              ? "Settled"
              : market.status === "cancelled"
                ? "Cancelled"
                : formatTimeLeft(market.endDate)}
          </span>
        </div>
      </div>

      {/* Question */}
      <h3 className="font-display text-[15px] font-semibold leading-snug line-clamp-2 text-[var(--color-gray-100)] min-h-[40px]">
        {market.question}
      </h3>

      {/* Outcome Prices */}
      <div className="grid grid-cols-2 gap-2 font-mono">
        <div className="bg-[var(--surface-0)] border border-[var(--accent)]/35 rounded-[2px] p-2.5 space-y-0.5 hover:border-[var(--accent)]/60 transition-colors">
          <div className="text-[var(--accent)] font-bold text-[11px] tracking-wider">YES</div>
          <div className="text-[var(--color-gray-100)] text-[15px] font-semibold">
            {yesPct.toFixed(0)}% <span className="text-xs text-[var(--color-gray-400)]">(${market.yesPrice.toFixed(2)})</span>
          </div>
          <div className="h-1 rounded-[2px] bg-[var(--color-gray-800)] overflow-hidden mt-1">
            <div className="h-full rounded-[2px] bg-gradient-to-r from-gold-lite to-gold" style={{ width: `${Math.min(100, Math.max(2, yesPct))}%` }} />
          </div>
        </div>
        <div className="bg-[var(--surface-0)] border border-[var(--negative)]/30 rounded-[2px] p-2.5 space-y-0.5 hover:border-[var(--negative)]/60 transition-colors">
          <div className="text-[var(--negative)] font-bold text-[11px] tracking-wider">NO</div>
          <div className="text-[var(--color-gray-100)] text-[15px] font-semibold">
            {(100 - yesPct).toFixed(0)}% <span className="text-xs text-[var(--color-gray-400)]">(${market.noPrice.toFixed(2)})</span>
          </div>
          <div className="h-1 rounded-[2px] bg-[var(--color-gray-800)] overflow-hidden mt-1">
            <div className="h-full rounded-[2px] bg-gradient-to-r from-bordeaux to-bordeaux" style={{ width: `${Math.min(100, Math.max(2, 100 - yesPct))}%` }} />
          </div>
        </div>
      </div>

      {/* Card Footer Metrics */}
      <div className="flex items-center justify-between text-xs font-mono text-[var(--color-gray-400)] pt-3 border-t border-[var(--color-gray-800)]">
        <span className="flex items-center gap-1">
          <Users size={11} /> {market.traders > 0 ? market.traders.toLocaleString() : "0"} traders
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp size={11} /> {formatVolume(market.volume24h || market.liquidity)}
        </span>
      </div>
    </motion.div>
  );
});
