"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen bg-[#050507] flex items-center justify-center p-4">
      <div className="holo-card p-8 text-center flex flex-col items-center justify-center space-y-4 max-w-md">
        <AlertTriangle className="w-12 h-12 text-[#FF4D6D]" />
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-[#F4F5FA]">Application Error</h2>
          <p className="text-sm text-[#A5A8B8]">
            {error.digest && (
              <span className="block text-[10px] font-mono text-[#7B3FE4] mb-1">Error ID: {error.digest}</span>
            )}
            {error.message || "An unexpected error occurred. Please try again."}
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-semibold bg-[#7B3FE4] hover:bg-[#6A2FD4] text-white rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    </div>
  );
}
