"use client";

import dynamic from "next/dynamic";

/**
 * SSR-safe mount for the WebGL orb — three.js touches `window` at import
 * time in places, and a hydration mismatch on the canvas is guaranteed
 * otherwise. Renders an elegant CSS placeholder while loading.
 */
export const SignalOrb = dynamic(() => import("./SignalOrb3D"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center" style={{ width: 260, height: 260 }}>
      <div className="h-32 w-32 rounded-full border border-hairline bg-[radial-gradient(circle_at_35%_30%,color-mix(in_oklab,var(--color-gold)_25%25,transparent),transparent_65%25)] animate-pulse-slow" />
    </div>
  ),
});
