"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught React error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6 sm:p-8">
          <div className="board-panel max-w-lg w-full p-6 sm:p-8 bg-board-panel border-board-border text-center space-y-6 shadow-2xl rounded">
            <div className="w-16 h-16 rounded-full bg-[#ffb4ab]/10 border border-[#ffb4ab]/30 flex items-center justify-center mx-auto text-[#ffb4ab]">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold font-display uppercase tracking-wider text-text-primary">
                System Fault Detected
              </h2>
              <p className="text-xs text-text-muted leading-relaxed font-sans max-w-sm mx-auto">
                A critical rendering exception occurred. The predictions engine halted safety controls to prevent UI corruption.
              </p>
            </div>

            {this.state.error && (
              <div className="p-4 bg-black/40 border border-[#ffd89c]/20 rounded font-mono text-[10px] text-left text-[#ffb4ab] overflow-x-auto max-h-40 scrollbar-thin">
                <p className="font-bold text-xs pb-1">Error: {this.state.error.name}</p>
                <p className="opacity-90">{this.state.error.message}</p>
                <p className="opacity-50 pt-2 select-all whitespace-pre">
                  {this.state.error.stack}
                </p>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="btn-amber text-xs font-semibold px-4 py-2.5 flex items-center justify-center gap-2 mx-auto cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reboot Engine
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
