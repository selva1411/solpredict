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
        className={`relative overflow-hidden rounded bg-[#131313] border border-[#9e8e78]/40 font-mono font-bold text-[#ffd89c] flex items-center justify-center ${
          compact ? "w-8 h-8 text-xs" : "w-12 h-12 text-lg"
        }`}
        style={{ perspective: "200px" }}
      >
        <span key={value} className="flip-digit">
          {pad(value)}
        </span>
      </div>
      {!compact && (
        <span className="text-[9px] uppercase tracking-wider text-[#d6c4ac] mt-1">{label}</span>
      )}
    </div>
  );
}

export function FlipCountdown({ endTs, compact = false }: FlipCountdownProps) {
  const [parts, setParts] = useState(() => getParts(endTs));

  useEffect(() => {
    const interval = setInterval(() => setParts(getParts(endTs)), 1000);
    return () => clearInterval(interval);
  }, [endTs]);

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
}
