"use client";
import { LabelLux } from "./label-lux";

export function Outcome({
  side, price, selected, onSelect,
}: { side: "YES" | "NO"; price: string; selected?: boolean; onSelect?: () => void }) {
  const tone = side === "YES" ? "text-verdigris" : "text-bordeaux";
  return (
    <button
      onClick={onSelect}
      className={`sheen group flex w-full items-end justify-between rounded-[2px] border px-5 py-4 text-left transition-colors
        ${selected ? "border-gold bg-panel-2" : "border-hairline bg-panel hover:border-ash-dim"}`}
    >
      <div>
        <LabelLux>{side}</LabelLux>
        <div className={`mt-2 font-mono tnum text-[28px] ${tone}`}>{price}</div>
      </div>
      <div className="label-lux pb-1">{selected ? "SELECTED" : "SELECT"}</div>
    </button>
  );
}
