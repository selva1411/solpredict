"use client";

import React from "react";

interface OrderBookDepthProps {
  yesPoolLamports: number; // in lamports
  noPoolLamports: number; // in lamports
}

export function OrderBookDepth({ yesPoolLamports, noPoolLamports }: OrderBookDepthProps) {
  const yesSol = yesPoolLamports / 1e9;
  const noSol = noPoolLamports / 1e9;
  const totalSol = yesSol + noSol;

  const yesPct = totalSol > 0 ? (yesSol / totalSol) * 100 : 50;
  const noPct = totalSol > 0 ? (noSol / totalSol) * 100 : 50;

  // Generate simulated order book levels based on actual pool weights to create a rich mechanical layout
  const levels = [
    { multiplier: 0.8, basePct: 0.2 },
    { multiplier: 0.6, basePct: 0.4 },
    { multiplier: 0.4, basePct: 0.6 },
    { multiplier: 0.2, basePct: 0.8 },
  ];

  return (
    <div className="board-panel p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-[#2D3142] pb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider font-display text-[#FFA500]">
          [■] Liquidity Pool Depth
        </h3>
        <span className="text-[10px] font-mono text-[#808495]">TOTAL: {totalSol.toFixed(2)} SOL</span>
      </div>

      <div className="space-y-2">
        {/* Header row */}
        <div className="grid grid-cols-5 text-[9px] uppercase tracking-wider font-display text-[#808495] border-b border-[#2D3142] pb-1.5 font-semibold">
          <div className="text-left">YES Pct</div>
          <div className="text-right">YES Depth</div>
          <div className="text-center text-[#FFA500]">Mid</div>
          <div className="text-left pl-4">NO Depth</div>
          <div className="text-right">NO Pct</div>
        </div>

        {/* Level Rows */}
        <div className="space-y-1 font-mono text-xs select-none">
          {levels.map((lvl, idx) => {
            const rowYesSol = yesSol * lvl.multiplier;
            const rowNoSol = noSol * lvl.multiplier;
            const rowYesPct = yesPct * lvl.basePct;
            const rowNoPct = noPct * lvl.basePct;

            return (
              <div 
                key={idx} 
                className="grid grid-cols-5 py-1.5 items-center relative hover:bg-white/2 transition-colors rounded"
              >
                {/* YES Pct */}
                <div className="text-left text-[#235A34] font-bold">
                  {rowYesPct.toFixed(1)}%
                </div>
                {/* YES Depth (Sol) */}
                <div className="text-right text-[#F4F4F9] pr-2">
                  {rowYesSol.toFixed(2)}
                </div>
                {/* Center Divider / Spread */}
                <div className="text-center text-[10px] text-[#808495] font-semibold border-l border-r border-[#2D3142]">
                  L{idx + 1}
                </div>
                {/* NO Depth (Sol) */}
                <div className="text-left text-[#F4F4F9] pl-4">
                  {rowNoSol.toFixed(2)}
                </div>
                {/* NO Pct */}
                <div className="text-right text-[#8E2424] font-bold">
                  {rowNoPct.toFixed(1)}%
                </div>

                {/* Left Depth Bar Graphic */}
                <div 
                  style={{ width: `${Math.min(yesPct * lvl.basePct, 100)}%`, right: "60%" }} 
                  className="absolute top-0 bottom-0 bg-[#235A34]/5 pointer-events-none rounded-l transition-all duration-300"
                />
                {/* Right Depth Bar Graphic */}
                <div 
                  style={{ width: `${Math.min(noPct * lvl.basePct, 100)}%`, left: "60%" }} 
                  className="absolute top-0 bottom-0 bg-[#8E2424]/5 pointer-events-none rounded-r transition-all duration-300"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary comparison bar */}
      <div className="pt-2 border-t border-[#2D3142] space-y-1.5">
        <div className="flex justify-between text-[10px] font-mono text-[#808495]">
          <span>YES Weight: {yesPct.toFixed(0)}%</span>
          <span>NO Weight: {noPct.toFixed(0)}%</span>
        </div>
        <div className="w-full h-2 bg-[#8E2424] rounded overflow-hidden flex border border-[#050608]">
          <div 
            style={{ width: `${yesPct}%` }} 
            className="h-full bg-[#235A34] border-r border-[#050608]"
          />
        </div>
      </div>
    </div>
  );
}
