"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

interface FlashValueProps {
  /** Numeric value to watch; when it changes the numeral flashes in the direction it moved. */
  value: number;
  /** Rendered decimals (default 0). */
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

const NO_FLASH: { dir: "none" | "up" | "down"; key: number } = { dir: "none", key: 0 };

/**
 * Directional price flash — emerald pulse when the value rises, rose when it
 * falls. The signature "live line" micro-interaction used across the board.
 */
export function FlashValue({ value, decimals = 0, suffix = "", prefix = "", className }: FlashValueProps) {
  const prev = useRef<number>(value);
  const [flash, setFlash] = useState<{ dir: "none" | "up" | "down"; key: number }>(NO_FLASH);

  useEffect(() => {
    if (value === prev.current) return;
    const dir = value > prev.current ? "up" : "down";
    prev.current = value;
    const key = Date.now();
    setFlash({ dir, key });
    const t = setTimeout(() => setFlash(NO_FLASH), 650);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <span
      key={flash.key || "stable"}
      className={cn("num", className ?? "", flash.dir === "up" ? "odds-flash-up" : flash.dir === "down" ? "odds-flash-down" : "")}
    >
      {prefix}
      {value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  );
}

interface BoardRowProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/**
 * A board row that glides to its new position when the list re-ranks
 * (framer-motion layout animation).
 */
export function MotionBoardRow({ children, onClick, className }: BoardRowProps) {
  return (
    <motion.button
      layout
      transition={{ type: "spring", stiffness: 320, damping: 32 }}
      onClick={onClick}
      whileHover={{ x: 4 }}
      className={`board-row group w-full text-left cursor-pointer edge-glow ${className ?? ""}`}
    >
      {children}
    </motion.button>
  );
}

export { AnimatePresence };
