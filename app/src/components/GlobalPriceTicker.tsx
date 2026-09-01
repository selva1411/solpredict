"use client";

import { useSolPrice } from "@/hooks/useSolPrice";

export function GlobalPriceTicker() {
  const { solPrice, loading } = useSolPrice();

  return (
    <div className="px-3 sm:px-4 pt-3 hidden sm:block">
      <div className="mx-auto w-full max-w-[1240px] flex items-center justify-center gap-3 px-4 py-2 rounded-full bg-panel border border-hairline font-mono text-[10px] text-ash">
        <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-widest text-verdigris">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-verdigris opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-verdigris" />
          </span>
          LIVE
        </span>
        <span className="text-ivory font-bold">SOL</span>
        <span className="num text-gold-lite font-bold">
          {loading ? "—" : `$${solPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </span>
        <span className="hidden sm:inline text-ash-dim">
          Solana Prediction Markets · Real-time on-chain settlement
        </span>
      </div>
    </div>
  );
}
