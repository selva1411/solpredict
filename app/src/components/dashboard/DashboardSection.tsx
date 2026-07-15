"use client";

import React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface DashboardSectionProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  count?: number;
  variant?: "default" | "alert";
  children: React.ReactNode;
  delay?: number;
}

export function DashboardSection({
  title,
  subtitle,
  icon: Icon,
  count,
  variant = "default",
  children,
  delay = 0,
}: DashboardSectionProps) {
  const isAlert = variant === "alert";

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay }}
      className={`space-y-4 ${isAlert ? "board-panel p-6 border-[#FFA500]/30 bg-[#0F0E0A]/90" : ""}`}
    >
      <div className="flex items-center space-x-2">
        <motion.div
          animate={isAlert ? { rotate: [0, -4, 4, 0] } : {}}
          transition={{ repeat: isAlert ? Infinity : 0, duration: 2.5, repeatDelay: 3 }}
          className={isAlert ? "text-[#FFA500]" : "text-[#FFA500]"}
        >
          <Icon className="w-5 h-5" />
        </motion.div>
        <h2 className="text-lg font-bold font-display tracking-wide uppercase">
          {title}
          {count !== undefined && count > 0 ? ` (${count})` : ""}
        </h2>
      </div>
      {subtitle && <p className="text-[#808495] text-xs -mt-2">{subtitle}</p>}
      {children}
    </motion.section>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle: string;
  badge?: string;
  badgeLabel?: string;
}

export function DashboardHero({
  title,
  subtitle,
  badge,
  badgeLabel,
}: SectionHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="border-b border-[#2D3142] pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 relative"
    >
      <div className="absolute -top-4 -left-4 w-24 h-24 bg-[#FFA500]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="space-y-1 relative">
        <h1 className="text-3xl font-bold font-display text-[#F4F4F9]">{title}</h1>
        <p className="text-[#808495] text-sm">{subtitle}</p>
      </div>
      {badge && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center space-x-2 bg-[#050608] border border-[#2D3142] px-3 py-1.5 rounded shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
        >
          {badgeLabel && (
            <span className="text-xs font-mono text-[#808495]">{badgeLabel}</span>
          )}
          <span className="text-xs font-mono font-semibold text-[#FFA500]">{badge}</span>
        </motion.div>
      )}
    </motion.div>
  );
}
