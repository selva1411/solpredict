"use client";

import { useEffect } from "react";
import { useReportWebVitals } from "next/web-vitals";

export function WebVitals() {
  useReportWebVitals((metric) => {
    if (process.env.NODE_ENV === "development") return;

    const body = {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
    };

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
      navigator.sendBeacon("/api/monitor/web-vitals", blob);
    } else {
      fetch("/api/monitor/web-vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch((err) => {
        // Web-vitals telemetry is deliberately best-effort; log, never throw.
        console.warn("web-vitals report failed:", err);
      });
    }
  });

  return null;
}
