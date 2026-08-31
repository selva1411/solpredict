"use client";

import { useEffect, useState } from "react";

export type TimeTone = "hot" | "soon" | "calm" | "over" | "na";

export interface TimeLeftProps {
  endDate: string;
  /** Optional custom renderer for the label once mounted. */
  className?: string;
}

function computeBucket(endDate: string): { label: string; tone: TimeTone } {
  const t = new Date(endDate).getTime();
  if (Number.isNaN(t)) return { label: "—", tone: "na" };
  const ms = t - Date.now();
  if (ms <= 0) return { label: "closed", tone: "over" };
  const mins = ms / 60e3;
  if (mins < 60) return { label: `${Math.max(1, Math.round(mins))}m`, tone: "hot" };
  if (mins < 24 * 60) return { label: `${Math.round(mins / 60)}h`, tone: "soon" };
  return { label: `${Math.round(mins / (60 * 24))}d`, tone: "calm" };
}

/**
 * Time-to-close label that is hydration-safe by construction.
 *
 * The bucket derives from Date.now(), which ALWAYS differs at least slightly
 * between the server render and the client's first pass — and can cross a
 * minute/hour/day boundary in between, producing a text (or even structure,
 * via the hot-dot) mismatch that crashes hydration. So the first render on
 * BOTH sides emits an identical static placeholder; the real bucket appears
 * immediately after mount (~one frame later).
 */
export function TimeLeft({ endDate, className }: TimeLeftProps) {
  const [bucket, setBucket] = useState<{ label: string; tone: TimeTone } | null>(null);

  useEffect(() => {
    setBucket(computeBucket(endDate));
    const iv = setInterval(() => setBucket(computeBucket(endDate)), 30_000);
    return () => clearInterval(iv);
  }, [endDate]);

  const toneClass =
    bucket?.tone === "hot" ? "text-bordeaux"
    : bucket?.tone === "soon" ? "text-amber"
    : "text-ash-dim";

  return (
    <span className={`${className ?? ""} num text-[12px] ${toneClass}`}>
      {bucket ? (
        <>
          {bucket.tone === "hot" && <span className="live-dot !w-[5px] !h-[5px] mr-1" />}
          {bucket.label}
        </>
      ) : (
        "…"
      )}
    </span>
  );
}
