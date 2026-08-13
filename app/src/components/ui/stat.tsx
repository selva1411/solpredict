"use client";
import { useEffect, useState } from "react";
import { LabelLux } from "./label-lux";

export function Stat({
  label, value, hint, size = "md",
}: { label: string; value: string; hint?: string; size?: "sm" | "md" | "lg" }) {
  const [k, setK] = useState(0);
  useEffect(() => setK((n) => n + 1), [value]);
  const sizes = { sm: "text-[21px]", md: "text-[34px]", lg: "text-[68px] leading-[.95]" };
  return (
    <div>
      <LabelLux>{label}</LabelLux>
      {/* Live numbers can legitimately change between the server render and
          client hydration (a stats refetch can land mid-hydration), which
          React would otherwise flag as a hydration mismatch. The value is
          cosmetic — the client value wins after hydration. */}
      <div key={k} suppressHydrationWarning className={`tick tnum font-mono ${sizes[size]} mt-3 text-ivory`}>{value}</div>
      {hint && <div className="mt-2 text-[13px] text-ash-dim">{hint}</div>}
    </div>
  );
}
