"use client";
import { useMarkets } from "@/hooks/useMarkets";
import { getWatchlist } from "@/lib/watchlist";
import { formatSol, calcYesPct, calcNoPct, timeUntil, categoryName, categoryColor, outcomeLabel } from "@/lib/format";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function WatchlistPage() {
  const { markets, loading } = useMarkets();
  const [watchlistKeys, setWatchlistKeys] = useState<string[]>([]);

  useEffect(() => {
    setWatchlistKeys(getWatchlist());
  }, []);

  const watchedMarkets = markets.filter((m) =>
    watchlistKeys.includes(m.publicKey.toBase58())
  );

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 16px" }}>
      <div style={{ marginBottom: "24px" }}>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "32px",
            color: "var(--color-primary)",
          }}
        >
          Watchlist
        </h1>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "13px",
            color: "var(--color-text-secondary)",
            marginTop: "4px",
          }}
        >
          {watchedMarkets.length} tracked market{watchedMarkets.length !== 1 ? "s" : ""}
        </p>
      </div>

      {loading ? (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--color-text-secondary)", textAlign: "center", padding: "64px" }}>
          Loading watchlist...
        </div>
      ) : watchedMarkets.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "64px 0",
            fontFamily: "var(--font-mono)",
            color: "var(--color-text-secondary)",
          }}
        >
          <p style={{ fontSize: "16px", marginBottom: "16px" }}>
            Star markets to track them here
          </p>
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
            Browse Markets
          </Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "12px" }}>
          {watchedMarkets.map((m) => (
            <Link
              key={m.publicKey.toBase58()}
              href={`/market/${m.account.marketId}`}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "var(--color-surface-variant)",
                  border: "1px solid var(--color-outline)",
                  borderRadius: "8px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: categoryColor(m.account.category),
                      color: "#131313",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                    }}
                  >
                    {categoryName(m.account.category)}
                  </span>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background:
                        m.account.status === 0
                          ? "var(--color-yes)"
                          : m.account.status === 1
                          ? "var(--color-primary)"
                          : "var(--color-no)",
                      color: "#131313",
                      fontFamily: "var(--font-mono)",
                      fontWeight: 600,
                    }}
                  >
                    {m.account.status === 0
                      ? "Open"
                      : m.account.status === 1
                      ? "Settled"
                      : "Cancelled"}
                  </span>
                </div>

                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "14px",
                    color: "var(--color-text-primary)",
                    lineHeight: 1.3,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {m.account.question}
                </p>

                {/* Probability Bar */}
                <div
                  style={{
                    height: "8px",
                    borderRadius: "4px",
                    background: "var(--color-surface)",
                    overflow: "hidden",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      width: `${calcYesPct(m.account.yesPoolLamports, m.account.noPoolLamports)}%`,
                      background: "var(--color-yes)",
                      transition: "width 0.5s ease",
                    }}
                  />
                  <div
                    style={{
                      flex: 1,
                      background: "var(--color-no)",
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <span>
                    YES{" "}
                    <span style={{ color: "var(--color-yes)" }}>
                      {calcYesPct(m.account.yesPoolLamports, m.account.noPoolLamports)}%
                    </span>
                  </span>
                  <span>
                    NO{" "}
                    <span style={{ color: "var(--color-no)" }}>
                      {calcNoPct(m.account.yesPoolLamports, m.account.noPoolLamports)}%
                    </span>
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontFamily: "var(--font-mono)",
                    fontSize: "11px",
                    color: "var(--color-text-secondary)",
                    borderTop: "1px solid var(--color-surface)",
                    paddingTop: "8px",
                  }}
                >
                  <span>
                    Vol: {formatSol(m.account.yesPoolLamports + m.account.noPoolLamports)} SOL
                  </span>
                  <span>
                    {m.account.status === 0 && timeUntil(m.account.endTs)}
                    {m.account.status === 1 && outcomeLabel(m.account.winningOutcome)}
                    {m.account.status === 2 && "Cancelled"}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}