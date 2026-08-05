"use client";

import React, { memo, useCallback, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
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

const CATEGORY_COLORS: Record<UiMarket["category"], string> = {
  Crypto:  "text-[#C8FF00] bg-[#C8FF00]/10 border-[#C8FF00]/30",
  Sports:  "text-[#00E5FF] bg-[#00E5FF]/10 border-[#00E5FF]/30",
  Politics:"text-[#FF3D9A] bg-[#FF3D9A]/10 border-[#FF3D9A]/30",
  Tech:    "text-[#7B3FE4] bg-[#7B3FE4]/10 border-[#7B3FE4]/30",
  Other:   "text-[#A5A8B8] bg-[#A5A8B8]/10 border-[#A5A8B8]/30",
};

function formatTimeLeft(endDate: string): string {
  const ms = new Date(endDate).getTime() - Date.now();
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
  const catColor = CATEGORY_COLORS[market.category];
  const { isWatched, toggleWatchlistItem } = useAppState();
  const watched = isWatched(market.id);
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-80, 80], [8, -8]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(x, [-80, 80], [-8, 8]), { stiffness: 300, damping: 30 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set(e.clientX - rect.left - rect.width / 2);
    y.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const handleStarClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    toggleWatchlistItem(market.id);
  }, [market.id, toggleWatchlistItem]);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -4 }}
      onClick={onClick}
      style={{ rotateX, rotateY, transformStyle: "preserve-3d" as const, perspective: 800 }}
      className={`holo-card p-5 cursor-pointer group ${selected ? "ring-2 ring-[#7B3FE4]" : ""}`}
    >
      <div className="flex items-center justify-between mb-3 relative z-10" style={{ transform: "translateZ(30px)" }}>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-md border ${catColor}`}>
            {market.category}
          </span>
          {market.hot && (
            <span className="flex items-center gap-1 text-[10px] font-mono text-[#FF3D9A] bg-[#FF3D9A]/10 px-2 py-0.5 rounded-md border border-[#FF3D9A]/30">
              <Flame size={10} /> HOT
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleStarClick}
            className="p-1 rounded hover:bg-white/5 transition-colors"
            title={watched ? "Remove from watchlist" : "Add to watchlist"}
          >
            <Star className={`w-3.5 h-3.5 ${watched ? "fill-[#00E5FF] text-[#00E5FF]" : "text-[#A5A8B8]"}`} />
          </button>
          <span className="flex items-center gap-1 text-[11px] text-[#A5A8B8] font-mono">
            <Clock size={11} />
            {formatTimeLeft(market.endDate)}
          </span>
        </div>
      </div>

      <h3 className="font-display text-[15px] font-semibold leading-tight mb-4 line-clamp-2 text-[#F4F5FA] group-hover:text-gradient transition-all min-h-[40px]">
        {market.question}
      </h3>

      <div className="flex items-center gap-4 mb-4 relative z-10" style={{ transform: "translateZ(40px)" }}>
        <div
          className="prob-orb w-16 h-16 flex-shrink-0 relative"
          style={{ ["--pct" as string]: `${yesPct}%` }}
        >
          <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-sm z-10">
            {yesPct.toFixed(0)}%
          </div>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-2">
          <div className="bg-[#C8FF00]/8 border border-[#C8FF00]/25 rounded-lg p-2.5">
            <div className="text-[#C8FF00] font-mono font-bold text-[11px] tracking-wide">YES</div>
            <div className="text-[#F4F5FA] font-mono text-sm font-semibold">${market.yesPrice.toFixed(2)}</div>
          </div>
          <div className="bg-[#FF4D6D]/8 border border-[#FF4D6D]/25 rounded-lg p-2.5">
            <div className="text-[#FF4D6D] font-mono font-bold text-[11px] tracking-wide">NO</div>
            <div className="text-[#F4F5FA] font-mono text-sm font-semibold">${market.noPrice.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between" style={{ transform: "translateZ(20px)" }}>
        <div className="flex-1">
          <Sparkline data={market.sparkline} width={140} height={28} color="#00E5FF" />
        </div>
        <div className="text-right ml-3">
          <div className="text-[10px] text-[#A5A8B8] font-mono uppercase tracking-wider">Pool Vol</div>
          <div className="text-[#F4F5FA] font-mono text-xs font-semibold">{formatVolume(market.yesPool + market.noPool || market.volume24h)}</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[11px] text-[#A5A8B8] font-mono pt-3 border-t border-white/5 relative z-10" style={{ transform: "translateZ(15px)" }}>
        <span className="flex items-center gap-1">
          <Users size={11} /> {market.traders > 0 ? market.traders.toLocaleString() : "0"}
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp size={11} /> {formatVolume(market.liquidity || (market.yesPool + market.noPool))} liq
        </span>
        <span className="text-[#00E5FF] opacity-0 group-hover:opacity-100 transition-opacity">Trade →</span>
      </div>
    </motion.div>
  );
});
