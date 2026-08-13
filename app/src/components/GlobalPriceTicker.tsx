"use client";

import { useSolPrice } from "@/hooks/useSolPrice";

export function GlobalPriceTicker() {
  const { solPrice, loading } = useSolPrice();

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-1.5 bg-void/95 border-b border-[rgba(165,168,184,0.15)] font-mono text-[10px] text-ash">
      <span className="inline-flex items-center gap-1">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-[2px] bg-verdigris opacity-75" />
          <span className="relative inline-flex rounded-[2px] h-1.5 w-1.5 bg-verdigris" />
        </span>
        LIVE
      </span>
      <span className="text-ivory font-bold">SOL</span>
      <span className="text-gold font-bold">
        {loading ? "—" : `$${solPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      </span>
      <span className="hidden sm:inline text-ash/70">
        Solana Prediction Markets · Real-time on-chain settlement
      </span>
    </div>
  );
}
