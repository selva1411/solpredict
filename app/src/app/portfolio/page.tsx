"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useUserPositions } from "@/hooks/useUserPositions";
import { useMarkets } from "@/hooks/useMarkets";
import { formatSol, categoryName } from "@/lib/format";
import Link from "next/link";

export default function PortfolioPage() {
  const { publicKey } = useWallet();
  const { positions, dbPositions, loading: posLoading, hasOnChainData } = useUserPositions();
  const { markets, loading: mkLoading } = useMarkets();

  const marketMap = new Map(markets.map((m) => [m.publicKey.toBase58(), m]));

  // Use on-chain positions if available, otherwise fall back to DB positions
  const useDbFallback = !hasOnChainData && dbPositions.length > 0;

  const totalInvested = useDbFallback
    ? dbPositions.reduce((s, p) => s + p.totalSpentLamports, 0)
    : positions.reduce((s, p) => s + p.totalSpentLamports, 0);

  const activePositions = useDbFallback
    ? dbPositions.filter((p) => p.status === "open" || p.status === "Open")
    : positions.filter((p) => {
        const m = marketMap.get(p.market.toBase58());
        return m && m.account.status === 0;
      });

  const settledPositions = useDbFallback
    ? dbPositions.filter((p) => p.status === "settled" || p.status === "Settled")
    : positions.filter((p) => {
        const m = marketMap.get(p.market.toBase58());
        return m && m.account.status === 1;
      });

  const cancelledPositions = useDbFallback
    ? dbPositions.filter((p) => p.status === "cancelled" || p.status === "Cancelled")
    : positions.filter((p) => {
        const m = marketMap.get(p.market.toBase58());
        return m && m.account.status === 2;
      });

  if (!publicKey) {
    return (
      <div
        style={{
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-secondary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        Connect your wallet to view portfolio
      </div>
    );
  }

  if (posLoading || mkLoading) {
    return (
      <div
        style={{
          minHeight: "80vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-secondary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        Loading portfolio...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: "32px" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "32px",
            color: "var(--color-primary)",
            marginBottom: "8px",
          }}
        >
          Portfolio
        </h1>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--color-text-secondary)" }}>
          {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
        </p>
      </div>

      {/* Summary Bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "12px",
          marginBottom: "32px",
        }}
      >
        <SummaryCard label="Total Invested" value={`${formatSol(totalInvested)} SOL`} color="var(--color-primary)" />
        <SummaryCard label="Active Bets" value={activePositions.length.toString()} color="var(--color-yes)" />
        <SummaryCard label="Settled" value={settledPositions.length.toString()} color="var(--color-crypto)" />
        <SummaryCard label="Cancelled" value={cancelledPositions.length.toString()} color="var(--color-no)" />
      </div>

      {/* Positions */}
      {!useDbFallback && positions.length === 0 && dbPositions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", fontFamily: "var(--font-mono)", color: "var(--color-text-secondary)" }}>
          <p style={{ fontSize: "16px", marginBottom: "16px" }}>You haven&apos;t placed any bets yet</p>
          <Link
            href="/markets"
            style={{
              color: "var(--color-primary)",
              border: "1px solid var(--color-primary)",
              padding: "8px 24px",
              borderRadius: "6px",
              textDecoration: "none",
              fontSize: "14px",
            }}
          >
            View Markets
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* DB Fallback Positions */}
          {useDbFallback && dbPositions.map((pos, idx) => (
            <Link
              key={pos.marketPubkey}
              href={`/market/${pos.marketPubkey}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--color-surface-variant)",
                  border: "1px solid var(--color-outline)",
                  borderRadius: "8px",
                  padding: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                }}
              >
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "14px",
                      color: "var(--color-text-primary)",
                      marginBottom: "6px",
                    }}
                  >
                    {pos.question || `Market ${pos.marketPubkey.slice(0, 8)}...`}
                  </p>
                  <div style={{ display: "flex", gap: "12px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-text-secondary)" }}>
                    <span>YES: <span style={{ color: "var(--color-yes)" }}>{pos.yesAmount}</span></span>
                    <span>NO: <span style={{ color: "var(--color-no)" }}>{pos.noAmount}</span></span>
                    <span>Spent: <span style={{ color: "var(--color-text-primary)" }}>{formatSol(pos.totalSpentLamports)} SOL</span></span>
                    <span>{pos.category}</span>
                    <span style={{ color: "var(--color-outline)" }}>(from DB)</span>
                  </div>
                </div>
                <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                  <span style={{ color: pos.status === "open" ? "var(--color-primary)" : "var(--color-text-secondary)" }}>
                    {pos.status}
                  </span>
                </div>
              </div>
            </Link>
          ))}

          {/* On-chain Positions */}
          {positions.map((pos) => {
            const market = marketMap.get(pos.market.toBase58());
            if (!market) return null;
            const isWinner =
              market.account.status === 1 &&
              ((market.account.winningOutcome === 1 && pos.yesAmount > 0) ||
                (market.account.winningOutcome === 2 && pos.noAmount > 0));
            const isLoser =
              market.account.status === 1 && !pos.claimed && !isWinner;
            const claimable = isWinner && !pos.claimed;

            return (
              <Link
                key={pos.publicKey.toBase58()}
                href={`/market/${market.account.marketId}`}
                style={{ textDecoration: "none" }}
              >
                <div
                  style={{
                    background: "var(--color-surface-variant)",
                    border: `1px solid ${claimable ? "var(--color-yes)" : isLoser ? "var(--color-no)" : "var(--color-outline)"}`,
                    borderRadius: "8px",
                    padding: "16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "14px",
                        color: "var(--color-text-primary)",
                        marginBottom: "6px",
                      }}
                    >
                      {market.account.question.slice(0, 80)}
                      {market.account.question.length > 80 ? "..." : ""}
                    </p>
                    <div style={{ display: "flex", gap: "12px", fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-text-secondary)" }}>
                      <span>
                        YES: <span style={{ color: "var(--color-yes)" }}>{pos.yesAmount}</span>
                      </span>
                      <span>
                        NO: <span style={{ color: "var(--color-no)" }}>{pos.noAmount}</span>
                      </span>
                      <span>
                        Spent: <span style={{ color: "var(--color-text-primary)" }}>{formatSol(pos.totalSpentLamports)} SOL</span>
                      </span>
                      <span style={{ color: categoryName(market.account.category) ? "var(--color-crypto)" : "var(--color-text-secondary)" }}>
                        {categoryName(market.account.category)}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
                    {claimable && (
                      <span
                        style={{
                          color: "var(--color-yes)",
                          border: "1px solid var(--color-yes)",
                          borderRadius: "4px",
                          padding: "4px 8px",
                          fontSize: "11px",
                        }}
                      >
                        Claim Available
                      </span>
                    )}
                    {isLoser && (
                      <span style={{ color: "var(--color-text-secondary)" }}>Lost</span>
                    )}
                    {pos.claimed && (
                      <span style={{ color: "var(--color-outline)" }}>Claimed</span>
                    )}
                    {market.account.status === 2 && !pos.claimed && (
                      <span
                        style={{
                          color: "var(--color-crypto)",
                          border: "1px solid var(--color-crypto)",
                          borderRadius: "4px",
                          padding: "4px 8px",
                          fontSize: "11px",
                        }}
                      >
                        Refund Available
                      </span>
                    )}
                    {market.account.status === 0 && (
                      <span style={{ color: "var(--color-primary)" }}>Active</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      style={{
        background: "var(--color-surface-variant)",
        border: "1px solid var(--color-outline)",
        borderRadius: "8px",
        padding: "16px",
        textAlign: "center",
        fontFamily: "var(--font-mono)",
      }}
    >
      <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", marginBottom: "4px" }}>{label}</p>
      <p style={{ fontSize: "18px", fontWeight: 700, color }}>{value}</p>
    </div>
  );
}