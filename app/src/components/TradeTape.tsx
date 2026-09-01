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
    <div
      className="w-full overflow-hidden py-2"
      style={{
        background: "color-mix(in srgb, var(--color-void) 80%, transparent)",
        borderTop: "1px solid var(--color-hairline)",
        borderBottom: "1px solid var(--color-hairline)",
      }}
      aria-label="Recent trades"
    >
      <div className="mx-auto max-w-[1240px] px-6 flex items-center gap-0 overflow-x-auto no-scrollbar">
        <span className="font-mono text-[9px] uppercase tracking-[.18em] text-ash-dim shrink-0 mr-3">
          Tape
        </span>
        <span
          className="w-px h-3 shrink-0 mr-3"
          style={{ background: "var(--color-hairline)" }}
          aria-hidden
        />
        {trades.map((t, i) => (
          <span
            key={t.signature}
            className="shrink-0 inline-flex items-center gap-1.5 font-mono text-[10px] tnum whitespace-nowrap pr-4"
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background:
                  t.side === "YES"
                    ? "var(--color-verdigris)"
                    : "var(--color-bordeaux)",
              }}
              aria-hidden
            />
            <span className="text-ash-dim">{short(t.trader)}</span>
            <span className="text-ivory font-semibold">
              {(Math.abs(t.tokensOut || 0) / 1e6).toFixed(0)}×
            </span>
            <span
              className={
                t.side === "YES"
                  ? "text-verdigris font-bold"
                  : "text-bordeaux font-bold"
              }
            >
              {t.side}
            </span>
            <span className="text-ash">
              @{" "}
              {(
                Math.abs(t.lamportsIn || 0) /
                1e9 /
                Math.max(1e-9, Math.abs(t.tokensOut || 1) / 1e6)
              ).toFixed(3)}{" "}
              SOL
            </span>
            {i < trades.length - 1 && (
              <span className="text-hairline ml-1">·</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
