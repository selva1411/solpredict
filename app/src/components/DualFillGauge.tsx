"use client";

interface DualFillGaugeProps {
  yesPrice: number;
  noPrice: number;
}

export default function DualFillGauge({ yesPrice, noPrice }: DualFillGaugeProps) {
  const yesPct = Math.round(yesPrice * 100);
  const noPct = 100 - yesPct;

  return (
    <div className="w-full space-y-1.5 select-none font-mono">
      {/* Probability Bar */}
      <div className="relative h-6 w-full bg-[var(--surface-0)] border border-[var(--color-gray-800)] rounded-[2px] overflow-hidden flex">
        <div
          className="h-full bg-[var(--accent)] transition-all duration-500 ease-out flex items-center justify-start px-2 font-bold text-xs text-void"
          style={{ width: `${yesPct}%` }}
        >
          {yesPct >= 15 && `${yesPct}%`}
        </div>
        <div
          className="h-full bg-[var(--negative)] transition-all duration-500 ease-out flex items-center justify-end px-2 font-bold text-xs text-[#FFFFFF]"
          style={{ width: `${noPct}%` }}
        >
          {noPct >= 15 && `${noPct}%`}
        </div>
      </div>
      <div className="flex justify-between text-[11px] font-bold text-[var(--color-gray-400)]">
        <span className="text-[var(--accent)]">YES ({yesPct}%)</span>
        <span className="text-[var(--negative)]">NO ({noPct}%)</span>
      </div>
    </div>
  );
}
