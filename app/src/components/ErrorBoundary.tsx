"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex items-center justify-center h-40 border border-[#353534] rounded font-mono text-[#9e8e78] text-sm">
          <div className="text-center">
            <div className="text-[#ffb4ab] mb-2">⚠ Component Error</div>
            <div className="text-xs">{this.state.error?.message}</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
