"use client";

import React, { useRef, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { SplitFlapText } from "@/components/SplitFlapText";
import type { LucideIcon } from "lucide-react";

interface StatTile3DProps {
  label: string;
  value: string;
  unit: string;
  icon?: LucideIcon;
  accent?: "amber" | "green" | "neutral";
  delay?: number;
  useSplitFlap?: boolean;
}

export function StatTile3D({
  label,
  value,
  unit,
  icon: Icon,
  accent = "amber",
  delay = 0,
  useSplitFlap = true,
}: StatTile3DProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovering, setHovering] = useState(false);

  const springConfig = { stiffness: 280, damping: 22 };
  const rotateX = useSpring(0, springConfig);
  const rotateY = useSpring(0, springConfig);
  const sheenOpacity = useTransform(rotateX, [-8, 0, 8], [0.35, 0.15, 0.35]);

  const accentColors = {
    amber: "from-gold-lite/15 via-transparent to-transparent border-gold-lite/35",
    green: "from-verdigris/15 via-transparent to-transparent border-verdigris/30",
    neutral: "from-white/5 via-transparent to-transparent border-hairline",
  };

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    rotateX.set(-y * 12);
    rotateY.set(x * 12);
  };

  const handleLeave = () => {
    setHovering(false);
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20, rotateX: 12 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 0.45, delay, ease: "easeOut" }}
      onMouseMove={handleMove}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={handleLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        perspective: 900,
      }}
      className={`holo-card p-5 flex flex-col justify-between h-32 bg-[var(--surface-1)] holo-card-3d relative overflow-hidden group ${accentColors[accent]}`}
    >
      <motion.div
        style={{ opacity: sheenOpacity }}
        className="absolute inset-0 bg-gradient-radial from-gold-lite/5 to-transparent pointer-events-none"
      />

      <div className="flex items-start justify-between relative z-10" style={{ transform: "translateZ(12px)" }}>
        <div className="text-[10px] uppercase font-display tracking-widest text-graphite font-bold">
          {label}
        </div>
        {Icon && (
          <Icon
            className={`w-4 h-4 transition-colors duration-300 ${
              hovering ? "text-gold-lite" : "text-graphite"
            }`}
          />
        )}
      </div>

      <div className="flex items-end justify-between relative z-10" style={{ transform: "translateZ(18px)" }}>
        <span className="text-xs font-mono text-graphite">{unit}</span>
        {useSplitFlap ? (
          <SplitFlapText text={value} charClassName="w-[18px] h-[28px] text-xs text-gold-lite" />
        ) : (
          <span className="text-[21px] font-mono font-bold text-gold-lite">{value}</span>
        )}
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold-lite/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ transform: "translateZ(8px)" }}
      />
    </motion.div>
  );
}
