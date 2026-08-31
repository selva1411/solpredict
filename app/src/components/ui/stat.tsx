"use client";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function Stat({
  label, value, hint, size = "md",
}: { label: string; value: React.ReactNode; hint?: string; size?: "sm" | "md" | "lg" }) {
  const [k, setK] = useState(0);
  useEffect(() => setK((n) => n + 1), [value]);
  const sizes = { sm: "text-[22px]", md: "text-[34px]", lg: "text-[64px]" };
  return (
    <div>
      <div className="eyebrow">{label}</div>
      {/* Live numbers can legitimately change between the server render and
          client hydration (a stats refetch can land mid-hydration), which
          React would otherwise flag as a hydration mismatch. The value is
          cosmetic — the client value wins after hydration. */}
      <div
        key={k}
        suppressHydrationWarning
        className={cn(
          "num tick font-semibold mt-3 text-ivory",
          size === "lg" && "leading-[.95]",
          sizes[size]
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-2 text-[13px] text-ash-dim">{hint}</div>}
    </div>
  );
}