"use client";
import { LabelLux } from "./label-lux";

export function Outcome({
  side, price, selected, onSelect,
}: { side: "YES" | "NO"; price: string; selected?: boolean; onSelect?: () => void }) {
  const tone = side === "YES" ? "text-verdigris" : "text-bordeaux";
  return (
    <button
      onClick={onSelect}
      className={`group flex w-full items-end justify-between rounded-lg border px-5 py-4 text-left transition-colors duration-150
        ${selected ? "border-gold bg-panel-2" : "border-hairline bg-obsidian hover:border-ash-dim"}`}
    >
      <div>
        <LabelLux>{side}</LabelLux>
        <div className={`num mt-2 text-[28px] ${tone}`}>{price}</div>
      </div>
      <div className="label-lux pb-1">{selected ? "SELECTED" : "SELECT"}</div>
    </button>
  );
}
