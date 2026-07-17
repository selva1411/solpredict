"use client";

import React from "react";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/motion-variants";

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  as?: "div" | "section" | "article";
  animate?: boolean;
  delay?: number;
}

export function GlassPanel({
  children,
  className = "",
  interactive = false,
  as: Tag = "div",
  animate = false,
  delay = 0,
}: GlassPanelProps) {
  const baseClass = `glass-panel ${interactive ? "glass-panel-interactive cursor-pointer" : ""} ${className}`;

  if (animate) {
    return (
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-30px" }}
        transition={{ delay }}
        className={baseClass}
      >
        {children}
      </motion.div>
    );
  }

  return <Tag className={baseClass}>{children}</Tag>;
}
