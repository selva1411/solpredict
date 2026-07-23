"use client";
import ActivityFeed from "@/components/ActivityFeed";

export default function ActivityPage() {
  return (
    <div style={{ maxWidth: "720px", margin: "0 auto", padding: "32px 16px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "32px",
            color: "var(--color-primary)",
          }}
        >
          Activity
        </h1>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            color: "var(--color-text-secondary)",
            marginTop: "4px",
          }}
        >
          Recent transactions across all markets
        </p>
      </div>

      <div
        style={{
          background: "var(--color-surface-variant)",
          border: "1px solid var(--color-outline)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <ActivityFeed limit={50} />
      </div>
    </div>
  );
}