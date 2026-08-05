"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import dynamic from "next/dynamic";
import { ParticleBackground } from "./ParticleBackground";

declare global {
  interface Window {
    __predixWebglFailed?: boolean;
  }
}

const ParticleBackground3D = dynamic(() => import("@/components/ParticleBackground3D"), { ssr: false });

class BackgroundErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    if (typeof window !== "undefined") {
      window.__predixWebglFailed = true;
    }
  }

  render() {
    if (this.state.failed) return <ParticleBackground />;
    return this.props.children;
  }
}

export default function ParticleBackgroundWrapper() {
  return (
    <BackgroundErrorBoundary>
      <ParticleBackground3D />
    </BackgroundErrorBoundary>
  );
}