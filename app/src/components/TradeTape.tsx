"use client";

import { useEffect, useRef, useState } from "react";
import { useRealtime } from "@/hooks/useRealtime";

interface TapeItem {
  signature: string;
  trader: string;
  side: "YES" | "NO";
  lamportsIn: number;
  tokensOut: number;
  blockTime: string;
  question?: string;
}

function short(w: string): string {
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}

/**
 * The tape — last trades scrolling once, then resting. In a prediction market
 * the trade feed is the atmosphere; this renders it verbatim, no theater.
 */
export function TradeTape({ initial }: { initial: TapeItem[] }) {
  const [trades, setTrades] = useState<TapeItem[]>(initial);
  const seen = useRef<Set<string>>(new Set(initial.map((t) => t.signature)));

  const rt = useRealtime("global");
  useEffect(() => {
    const unsub = rt.on("activity", (payload) => {
      const incoming = Array.isArray(payload) ? (payload as TapeItem[]) : [];
      setTrades((prev) => {
        const fresh = incoming.filter((t) => !seen.current.has(t.signature));
        for (const t of fresh) seen.current.add(t.signature);
        return fresh.length > 0 ? [...fresh, ...prev].slice(0, 24) : prev;
      });
    });
    return () => unsub?.();
  }, [rt]);

  if (trades.length === 0) return null;

  return (
    <div className="border-b border-hairline bg-obsidian/70 overflow-hidden" aria-label="Recent trades">
      <div className="mx-auto max-w-[1240px] px-6 h-8 flex items-center gap-2 overflow-x-auto no-scrollbar">
        <span className="label-lux shrink-0 !text-gold-lite">Tape</span>
        <span className="w-px h-3.5 bg-hairline shrink-0" />
        {trades.map((t, i) => (
          <span key={t.signature} className="shrink-0 flex items-center gap-1.5 font-mono text-[10.5px] tnum whitespace-nowrap">
            <span className={t.side === "YES" ? "text-verdigris font-bold" : "text-bordeaux font-bold"}>
              {t.side === "YES" ? "BUY YES" : "BUY NO"}
            </span>
            <span className="text-ivory">{(Math.abs(t.tokensOut || 0) / 1e6).toFixed(0)}×</span>
            <span className="text-ash">@ {((Math.abs(t.lamportsIn || 0)) / 1e9 / Math.max(1e-9, Math.abs(t.tokensOut || 1) / 1e6)).toFixed(2)} SOL</span>
            <span className="text-ash-dim">{short(t.trader)}</span>
            {i < trades.length - 1 && <span className="text-hairline ml-1.5">·</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
