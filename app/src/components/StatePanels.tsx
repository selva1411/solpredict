"use client";

import React from "react";
import { HelpCircle, AlertTriangle, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function MarketCardSkeleton() {
  return (
    <div className="surface p-4 flex flex-col gap-3 h-64 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="w-16 h-3 bg-panel-2 rounded" />
        <div className="w-12 h-3 bg-panel-2 rounded" />
      </div>
      <div className="space-y-2">
        <div className="w-full h-4 bg-panel-2 rounded" />
        <div className="w-3/4 h-4 bg-panel-2 rounded" />
      </div>
      <div className="flex items-center gap-3">
        <div className="w-20 h-6 bg-panel-2 rounded" />
        <div className="w-20 h-6 bg-panel-2 rounded" />
      </div>
      <div className="pt-2 mt-auto border-t border-hairline flex items-center justify-between">
        <div className="w-16 h-3 bg-panel-2 rounded" />
        <div className="w-12 h-3 bg-panel-2 rounded" />
      </div>
    </div>
  );
}

export function LoadingState({ title = "Loading..." }: { title?: string }) {
  return (
    <div className="space-y-3 py-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="live-dot" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-ash-dim">
          {title}
        </span>
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="surface shimmer"
          style={{ height: "72px" }}
        />
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

export function EmptyState({
  icon: Icon = HelpCircle,
  title = "Nothing here",
  description,
  message,
  action,
}: {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  message?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <div className="py-16 text-center">
      <Icon className="w-8 h-8 text-ash-dim mx-auto mb-3" />
      <h2 className="font-display text-[18px] font-semibold text-ivory mb-2">
        {title}
      </h2>
      <p className="text-[13px] text-ash max-w-sm mx-auto">
        {message || description}
      </p>
      {action && (
        <div className="pt-4">
          {action.href ? (
            <a
              href={action.href}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium bg-gold hover:bg-gold-deep text-white rounded-lg transition-colors"
            >
              {action.label}
            </a>
          ) : (
            <button
              onClick={action.onClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium bg-gold hover:bg-gold-deep text-white rounded-lg transition-colors"
            >
              {action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="surface py-12 text-center flex flex-col items-center gap-3">
      <AlertTriangle className="w-8 h-8 text-bordeaux" />
      <div>
        <h3 className="text-[14px] font-semibold text-ivory">
          Something went wrong
        </h3>
        <p className="text-[12px] text-ash mt-1 max-w-sm">
          {message || "Failed to load data from the network."}
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-[12px] font-medium bg-gold hover:bg-gold-deep text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
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
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-medium uppercase tracking-wider ${
        isLive ? "text-verdigris" : "text-ash"
      }`}
    >
      <span
        className={`relative w-2 h-2 rounded-full ${
          isLive ? "bg-verdigris" : "bg-ash"
        }`}
      >
        {isLive && (
          <span className="absolute inset-0 rounded-full bg-verdigris animate-ping opacity-40" />
        )}
      </span>
      {label || (isLive ? "Live" : "Offline")}
    </span>
  );
}
