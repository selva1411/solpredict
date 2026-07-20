"use client";

import React from "react";
import { motion } from "framer-motion";
import { HelpCircle, AlertTriangle, RefreshCw, Activity } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface LoadingStateProps {
  title?: string;
  height?: string;
  count?: number;
}

export function MarketCardSkeleton() {
  return (
    <div className="glass-panel p-4 sm:p-5 flex flex-col justify-between h-76 border-[var(--glass-border)] animate-pulse">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <div className="w-16 h-4 bg-white/5 rounded skeleton-shimmer" />
            <div className="w-12 h-4 bg-white/5 rounded skeleton-shimmer" />
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-white/5 rounded skeleton-shimmer" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/5 skeleton-shimmer" />
            <div className="w-10 h-3 bg-white/5 rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="w-full h-4 bg-white/5 rounded skeleton-shimmer" />
        <div className="w-3/4 h-4 bg-white/5 rounded skeleton-shimmer" />
      </div>
      <div className="space-y-1.5">
        <div className="w-full h-3 bg-white/5 rounded skeleton-shimmer" />
        <div className="w-full h-3 bg-white/5 rounded skeleton-shimmer" />
      </div>
      <div className="pt-3 border-t border-[var(--glass-border)] flex items-center justify-between">
        <div className="w-20 h-3 bg-white/5 rounded skeleton-shimmer" />
        <div className="w-16 h-3 bg-white/5 rounded skeleton-shimmer" />
      </div>
      <div className="w-full h-8 bg-white/5 rounded skeleton-shimmer" />
    </div>
  );
}

export function LoadingState({ title, height = "h-76", count = 6 }: LoadingStateProps) {
  if (title) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-10 bg-white/5 border border-white/10 rounded w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`${height} board-panel skeleton-shimmer bg-[#131313]`} />
          ))}
        </div>
        <div className={`${height} board-panel skeleton-shimmer bg-[#131313]`} />
      </div>
    );
  }
  return (
    <div className={`grid sm:grid-cols-2 lg:grid-cols-3 gap-6`}>
      {[...Array(count)].map((_, i) => (
        <div key={i} className={`board-panel skeleton-shimmer ${height} bg-board-panel`} />
      ))}
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function EmptyState({ icon: Icon = HelpCircle, title, description, action }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="board-panel py-16 text-center text-[#d6c4ac] flex flex-col items-center justify-center space-y-4"
    >
      <Icon className="w-12 h-12 opacity-30 text-[#ffd89c]" />
      <div className="space-y-1">
        <h3 className="text-base font-bold font-display text-[#e5e2e1] uppercase">{title}</h3>
        <p className="text-xs max-w-sm mx-auto">{description}</p>
      </div>
      {action && (
        <div className="pt-2">
          {action.href ? (
            <a
              href={action.href}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold btn-primary"
            >
              {action.label}
            </a>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold btn-primary cursor-pointer"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="board-panel py-16 text-center text-[#d6c4ac] flex flex-col items-center justify-center space-y-4">
      <AlertTriangle className="w-12 h-12 opacity-30 text-[#ffb4ab]" />
      <div className="space-y-1">
        <h3 className="text-base font-bold font-display text-[#e5e2e1] uppercase">Data Feed Error</h3>
        <p className="text-xs max-w-sm mx-auto">{message || "Failed to load data from the network. The board may be offline."}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold btn-primary cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Connection
        </button>
      )}
    </div>
  );
}

interface LiveIndicatorProps {
  isLive?: boolean;
  label?: string;
}

export function LiveIndicator({ isLive = true, label }: LiveIndicatorProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-wider ${isLive ? "text-[#a1d494]" : "text-[#d6c4ac]"}`}>
      <span className={`relative w-2 h-2 rounded-full ${isLive ? "bg-[#a1d494]" : "bg-[#9e8e78]"}`}>
        {isLive && (
          <span className="absolute inset-0 rounded-full bg-[#a1d494] animate-ping opacity-50" />
        )}
      </span>
      {label || (isLive ? "Live" : "Offline")}
    </span>
  );
}
