"use client";

import { useEffect, useRef, useState } from "react";
import { useSpring, useTransform, motion, type MotionValue } from "framer-motion";

import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  /** Decimal places to render. */
  decimals?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}

/**
 * Spring-tweened numeric display — values glide to their new targets with
 * physical motion instead of snapping. Tabular numerals keep layout stable.
 */
export function AnimatedNumber({ value, decimals = 0, className, prefix = "", suffix = "" }: AnimatedNumberProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const spring = useSpring(value, { stiffness: 120, damping: 26, mass: 0.9 });
  const display: MotionValue<string> = useTransform(spring, (v) =>
    `${prefix}${v.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`,
  );

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      spring.jump(value);
      first.current = false;
    } else {
      spring.set(value);
    }
  }, [value, spring]);

  const formattedStatic = `${prefix}${value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;

  return (
    <motion.span className={cn("num", className)} suppressHydrationWarning>
      {mounted ? display : formattedStatic}
    </motion.span>
  );
}

