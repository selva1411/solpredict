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
      className={`space-y-4 ${isAlert ? "holo-card p-6 border-gold-lite/40 bg-panel" : ""}`}
    >
      <div className="flex items-center space-x-2">
        <motion.div
          animate={isAlert ? { rotate: [0, -4, 4, 0] } : {}}
          transition={{ repeat: isAlert ? Infinity : 0, duration: 2.5, repeatDelay: 3 }}
          className="text-gold-lite"
        >
          <Icon className="w-5 h-5" />
        </motion.div>
        <h2 className="text-[21px] font-bold font-display tracking-wide uppercase">
          {title}
          {count !== undefined && count > 0 ? ` (${count})` : ""}
        </h2>
      </div>
      {subtitle && <p className="text-graphite text-xs -mt-2 font-bold">{subtitle}</p>}
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
      className="border-b border-hairline pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 relative"
    >
      <div className="absolute -top-4 -left-4 w-24 h-24 bg-gold-lite/5 rounded-[2px] blur-3xl pointer-events-none" />
      <div className="space-y-1 relative">
        <h1 className="text-3xl font-bold font-display text-ivory uppercase tracking-wide">{title}</h1>
        <p className="text-graphite text-[13px]">{subtitle}</p>
      </div>
      {badge && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className="flex items-center space-x-2 bg-panel border border-hairline px-3 py-1.5 rounded shadow-[inset_0_1px_0_color-mix(in_oklab,var(--color-ivory)_5%25,transparent)]"
        >
          {badgeLabel && (
            <span className="text-xs font-mono text-graphite font-bold">{badgeLabel}</span>
          )}
          <span className="text-xs font-mono font-bold text-gold-lite">{badge}</span>
        </motion.div>
      )}
    </motion.div>
  );
}
