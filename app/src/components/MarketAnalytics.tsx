"use client";
import {
  poolDepthWarning,
  poolDepthMessage,
  priceImpact,
  contrarianMultiplier,
  timePressureLabel,
} from "@/lib/analytics";
import { formatSol } from "@/lib/format";

interface Props {
  yesPoolLamports: number;
  noPoolLamports: number;
  endTs: number;
  sharePriceLamports: number;
  betAmount?: number;
}

export default function MarketAnalytics({
  yesPoolLamports,
  noPoolLamports,
  endTs,
  sharePriceLamports,
  betAmount = 0,
}: Props) {
  const totalPool = yesPoolLamports + noPoolLamports;
  const depthWarning = poolDepthWarning(totalPool);
  const depthMsg = poolDepthMessage(totalPool);
  const contrarian = contrarianMultiplier(yesPoolLamports, noPoolLamports);
  const pressure = timePressureLabel(endTs);
  const yesPct = totalPool === 0 ? 50 : Math.round((yesPoolLamports / totalPool) * 100);
  const noPct = 100 - yesPct;

  return (
    <div
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        color: "var(--color-text-secondary)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Pool Depth */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          background: "var(--color-surface-variant)",
          borderRadius: "6px",
          border: `1px solid ${depthWarning === "low" ? "var(--color-no)" : depthWarning === "medium" ? "var(--color-primary)" : "var(--color-yes)"}`,
        }}
      >
        <span>Pool Depth</span>
        <span
          style={{
            color: depthWarning === "low" ? "var(--color-no)" : depthWarning === "medium" ? "var(--color-primary)" : "var(--color-yes)",
          }}
        >
          {depthMsg}
        </span>
      </div>

      {/* Time Pressure */}
      {pressure && (
        <div
          style={{
            padding: "8px 12px",
            background: "var(--color-surface-variant)",
            borderRadius: "6px",
            border: "1px solid var(--color-primary)",
            textAlign: "center",
            color: "var(--color-primary)",
          }}
        >
          {pressure}
        </div>
      )}

      {/* Contrarian Signal */}
      {contrarian && (
        <div
          style={{
            padding: "8px 12px",
            background: "var(--color-surface-variant)",
            borderRadius: "6px",
            border: "1px solid var(--color-crypto)",
            textAlign: "center",
            color: "var(--color-crypto)",
          }}
        >
          Contrarian bet: {contrarian.toFixed(1)}x payout potential
        </div>
      )}

      {/* Price Impact */}
      {betAmount > 0 && (
        <div
          style={{
            padding: "8px 12px",
            background: "var(--color-surface-variant)",
            borderRadius: "6px",
            border: "1px solid var(--color-outline)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Price Impact</span>
            <span style={{ color: "var(--color-primary)" }}>
              +{priceImpact(betAmount, totalPool).toFixed(2)}% of pool
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
            <span>New YES%</span>
            <span style={{ color: "var(--color-yes)" }}>
              {totalPool === 0
                ? "50%"
                : `${Math.round(((yesPoolLamports + (betAmount > 0 ? betAmount : 0)) / (totalPool + betAmount)) * 100)}%`}
            </span>
          </div>
        </div>
      )}

      {/* Pool Summary */}
      <div
        style={{
          padding: "8px 12px",
          background: "var(--color-surface-variant)",
          borderRadius: "6px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--color-yes)" }}>YES Pool</span>
          <span>{formatSol(yesPoolLamports)} SOL ({yesPct}%)</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
          <span style={{ color: "var(--color-no)" }}>NO Pool</span>
          <span>{formatSol(noPoolLamports)} SOL ({noPct}%)</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", borderTop: "1px solid var(--color-surface)", paddingTop: "4px" }}>
          <span>Total</span>
          <span style={{ color: "var(--color-text-primary)" }}>{formatSol(totalPool)} SOL</span>
        </div>
      </div>
    </div>
  );
}