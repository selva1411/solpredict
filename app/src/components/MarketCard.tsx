"use client";

import React, { memo, useCallback } from "react";
import { motion } from "framer-motion";
import { Clock, Star } from "lucide-react";
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
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  if (v > 0) return `${v.toFixed(1)}`;
  return `0`;
}

export const MarketCard = memo(function MarketCard({
  market,
  index = 0,
  onClick,
  selected,
}: MarketCardProps) {
  const yesPct = market.yesPrice * 100;
  const noPct = 100 - yesPct;
  const { isWatched, toggleWatchlistItem } = useAppState();
  const watched = isWatched(market.id);

  const handleStarClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      toggleWatchlistItem(market.id);
    },
    [market.id, toggleWatchlistItem]
  );

  const settled = market.status === "settled";
  const cancelled = market.status === "cancelled";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: Math.min(index * 0.03, 0.2) }}
      onClick={onClick}
      className={`group relative cursor-pointer flex flex-col transition-colors duration-150 ${
        selected ? "ring-1 ring-gold" : ""
      }`}
      style={{
        background: "var(--color-panel)",
        border: "1px solid var(--color-hairline)",
        borderRadius: "var(--radius-panel)",
      }}
      whileHover={{
        borderColor: "var(--color-hairline-2)",
      }}
    >
      <div className="p-4 flex flex-col gap-3">
        {/* Header: category + time */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ash-dim">
            {market.category}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleStarClick}
              className="p-0.5 rounded hover:bg-panel-2 transition-colors cursor-pointer"
              aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
            >
              <Star
                className={`w-3 h-3 transition-colors ${
                  watched ? "fill-amber text-amber" : "text-ash-dim hover:text-ash"
                }`}
              />
            </button>
            <span className="font-mono text-[10px] text-ash-dim flex items-center gap-1">
              {settled ? (
                "Settled"
              ) : cancelled ? (
                "Cancelled"
              ) : (
                <>
                  <Clock className="w-2.5 h-2.5" />
                  <TimeLeft endDate={market.endDate} />
                </>
              )}
            </span>
          </div>
        </div>

        {/* Question */}
        <h3 className="font-display font-semibold text-[15px] leading-snug line-clamp-2 text-ivory group-hover:text-gold-lite transition-colors duration-150">
          {market.question}
        </h3>

        {/* Prices */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-verdigris">YES</span>
            <FlashValue
              value={yesPct}
              decimals={0}
              suffix="¢"
              className="font-display font-bold text-[20px] text-verdigris tabular-nums"
            />
          </div>
          <div className="w-px h-4 bg-hairline" />
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-bordeaux">NO</span>
            <FlashValue
              value={noPct}
              decimals={0}
              suffix="¢"
              className="font-display font-bold text-[20px] text-bordeaux tabular-nums"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-hairline">
          <span className="font-mono text-[10px] text-ash-dim">
            {market.traders > 0 ? market.traders.toLocaleString() : "0"} traders
          </span>
          <span className="font-mono text-[10px] text-ash-dim">
            {formatVolume(market.volume24h || market.liquidity)} SOL
          </span>
        </div>
      </div>
    </motion.div>
  );
});
