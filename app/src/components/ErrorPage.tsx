"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  message?: string;
}

export function ErrorPage({ error, reset, title = "Something went wrong", message }: ErrorPageProps) {
  logger.error("[ErrorPage]", { digest: error.digest, message: error.message });

  return (
    <div className="holo-card p-8 text-center flex flex-col items-center justify-center space-y-4 max-w-md mx-auto mt-12">
      <AlertTriangle className="w-12 h-12 text-bordeaux" />
      <div className="space-y-1">
        <h2 className="text-[21px] font-bold text-ivory">{title}</h2>
        <p className="text-[13px] text-ash">
          {error.digest && (
            <span className="block text-[10px] font-mono text-gold mb-1">Error ID: {error.digest}</span>
          )}
          {message || error.message || "An unexpected error occurred."}
        </p>
      </div>
      <button
        onClick={reset}
        className="inline-flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-semibold bg-gold hover:bg-gold-lite text-void rounded-[2px] transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Try Again
      </button>
    </div>
  );
}
