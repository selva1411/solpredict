"use client";

import React, { useEffect, useState } from "react";

interface FlipCountdownProps {
  endTs: number; // unix seconds
  compact?: boolean;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function getParts(endTs: number) {
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, endTs - now);
  return {
    ended: diff <= 0,
    days: Math.floor(diff / 86400),
    hours: Math.floor((diff % 86400) / 3600),
    minutes: Math.floor((diff % 3600) / 60),
    seconds: Math.floor(diff % 60),
  };
}

function FlipUnit({ value, label, compact }: { value: number; label: string; compact?: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={`relative overflow-hidden rounded bg-[#131313] border border-gold-deep/40 font-mono font-bold text-gold-lite flex items-center justify-center ${
          compact ? "w-8 h-8 text-xs" : "w-12 h-12 text-[21px]"
        }`}
        style={{ perspective: "200px" }}
      >
        <span className="flip-digit">
          {pad(value)}
        </span>
      </div>
      {!compact && (
        <span className="text-[9px] uppercase tracking-wider text-[#d6c4ac] mt-1">{label}</span>
      )}
    </div>
  );
}

export const FlipCountdown = React.memo(function FlipCountdown({ endTs, compact = false }: FlipCountdownProps) {
  // Start with no parts so the SERVER render (and first client hydration
  // render) both show the same static placeholder. Date.now() differs between
  // the server and the client by milliseconds, so rendering seconds during SSR
  // would cause a hydration mismatch now that pages server-render market data.
  // The effect fills in real values immediately after hydration.
  const [parts, setParts] = useState<ReturnType<typeof getParts> | null>(null);

  useEffect(() => {
    setParts(getParts(endTs));
    const interval = setInterval(() => setParts(getParts(endTs)), 1000);
    return () => clearInterval(interval);
  }, [endTs]);

  if (!parts) {
    // Stable SSR/hydration placeholder. Include a Days unit so the footprint
    // matches the live countdown (which shows Days when > 0) and there is no
    // layout shift after hydration. aria-hidden: only the live digits are
    // announced to assistive tech.
    return (
      <div className={`flex items-center ${compact ? "gap-1" : "gap-2"}`} aria-hidden="true">
        <FlipUnit value={0} label={compact ? "" : "Days"} compact={compact} />
        <FlipUnit value={0} label={compact ? "" : "Hrs"} compact={compact} />
        <FlipUnit value={0} label={compact ? "" : "Min"} compact={compact} />
        <FlipUnit value={0} label={compact ? "" : "Sec"} compact={compact} />
      </div>
    );
  }

  if (parts.ended) {
    return (
      <span className="text-xs font-mono font-semibold text-[#d6c4ac]">Trading ended</span>
    );
  }

  return (
    <div className={`flex items-center ${compact ? "gap-1" : "gap-2"}`}>
      {parts.days > 0 && <FlipUnit value={parts.days} label="Days" compact={compact} />}
      <FlipUnit value={parts.hours} label="Hrs" compact={compact} />
      <FlipUnit value={parts.minutes} label="Min" compact={compact} />
      <FlipUnit value={parts.seconds} label="Sec" compact={compact} />
    </div>
  );
});
