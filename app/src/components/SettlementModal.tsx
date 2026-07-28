"use client";
import { useState } from "react";
import { useProgram } from "@/hooks/useProgram";
import { usePythPrices } from "@/hooks/usePythPrices";
import { feedIdBytesToHex } from "@/lib/pyth-feeds";
import { MarketAccount } from "@/hooks/useMarkets";
import { useToast } from "./NotificationToast";

interface Props {
  market: MarketAccount | null;
  onClose: () => void;
  onSettled: () => void;
}

export default function SettlementModal({ market, onClose, onSettled }: Props) {
  const { program } = useProgram();
  const { addToast } = useToast();
  const [outcome, setOutcome] = useState<1 | 2>(1);
  const [reason, setReason] = useState("");
  const [settling, setSettling] = useState(false);

  const feedIdHex = market?.account.oracleFeedId
    ? feedIdBytesToHex(market.account.oracleFeedId)
    : null;
  const pythPrices = usePythPrices(feedIdHex ? [feedIdHex] : []);
  const currentPrice = feedIdHex ? pythPrices[feedIdHex]?.price : null;

  if (!market) return null;

  const isCrypto = market.account.category === 0;
  const isEnded = market.account.endTs * 1000 < Date.now();
  const predictedOutcome =
    isCrypto && currentPrice !== null
      ? market.account.comparison === 0
        ? currentPrice >= market.account.targetPrice / 1e8
          ? 1
          : 2
        : currentPrice <= market.account.targetPrice / 1e8
        ? 1
        : 2
      : null;

  const handleSettle = async () => {
    if (!program) return;
    setSettling(true);
    try {
      if (isCrypto) {
        const tx = await program.methods
          .settleMarket()
          .accounts({
            market: market.publicKey,
            config: (
              await import("@/lib/pda")
            ).getConfigPda(program.programId),
            priceUpdate: market.publicKey,
          })
          .rpc();
        addToast({ type: "success", message: "Market settled via Pyth!", txSig: tx });
      } else {
        const tx = await program.methods
          .settleMarketManual(outcome)
          .accounts({
            admin: program.provider.publicKey,
            config: (
              await import("@/lib/pda")
            ).getConfigPda(program.programId),
            market: market.publicKey,
          })
          .rpc();
        addToast({ type: "success", message: "Market settled manually!", txSig: tx });
      }
      onSettled();
      onClose();
    } catch (err: unknown) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "Settlement failed",
      });
    } finally {
      setSettling(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--color-surface-variant)",
          border: "1px solid var(--color-outline)",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "480px",
          width: "100%",
          fontFamily: "var(--font-mono)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "18px",
            color: "var(--color-primary)",
            marginBottom: "16px",
          }}
        >
          Settle Market
        </h2>

        <p
          style={{
            fontSize: "13px",
            color: "var(--color-text-primary)",
            marginBottom: "4px",
          }}
        >
          {market.account.question}
        </p>
        <p
          style={{
            fontSize: "11px",
            color: "var(--color-text-secondary)",
            marginBottom: "16px",
          }}
        >
          {market.account.category === 0
            ? "Crypto (Pyth Oracle)"
            : market.account.category === 1
            ? "Sports"
            : market.account.category === 2
            ? "Politics"
            : market.account.category === 3
            ? "Tech"
            : "Other"}{" "}
          · {isEnded ? "Ended" : "Not yet ended"}
        </p>

        {/* For Crypto markets - show live price comparison */}
        {isCrypto && (
          <div
            style={{
              background: "#131313",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                color: "var(--color-text-secondary)",
                marginBottom: "8px",
              }}
            >
              <span>Current Price</span>
              <span>Target Price</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "16px",
                fontWeight: 700,
              }}
            >
              <span style={{ color: "var(--color-primary)" }}>
                ${currentPrice?.toFixed(2) ?? "—"}
              </span>
              <span style={{ color: "var(--color-text-primary)" }}>
                ${(market.account.targetPrice / 1e8).toFixed(2)}
              </span>
            </div>
            {predictedOutcome && (
              <div
                style={{
                  marginTop: "8px",
                  textAlign: "center",
                  fontSize: "12px",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  background:
                    predictedOutcome === 1
                      ? "rgba(161,212,148,0.15)"
                      : "rgba(255,180,171,0.15)",
                  color:
                    predictedOutcome === 1
                      ? "var(--color-yes)"
                      : "var(--color-no)",
                }}
              >
                Predicted: {predictedOutcome === 1 ? "YES wins" : "NO wins"}
              </div>
            )}
          </div>
        )}

        {/* For non-crypto markets - radio buttons */}
        {!isCrypto && (
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "12px",
                color: "var(--color-text-secondary)",
              }}
            >
              Winning Outcome
            </label>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setOutcome(1)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "6px",
                  border: `2px solid ${
                    outcome === 1 ? "var(--color-yes)" : "var(--color-outline)"
                  }`,
                  background:
                    outcome === 1
                      ? "rgba(161,212,148,0.1)"
                      : "transparent",
                  color:
                    outcome === 1
                      ? "var(--color-yes)"
                      : "var(--color-text-secondary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                YES Wins
              </button>
              <button
                onClick={() => setOutcome(2)}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "6px",
                  border: `2px solid ${
                    outcome === 2 ? "var(--color-no)" : "var(--color-outline)"
                  }`,
                  background:
                    outcome === 2
                      ? "rgba(255,180,171,0.1)"
                      : "transparent",
                  color:
                    outcome === 2
                      ? "var(--color-no)"
                      : "var(--color-text-secondary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                NO Wins
              </button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: "6px",
              border: "1px solid var(--color-outline)",
              background: "transparent",
              color: "var(--color-text-secondary)",
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSettle}
            disabled={settling || (!isCrypto && !outcome)}
            style={{
              padding: "10px 20px",
              borderRadius: "6px",
              border: "none",
              background: settling
                ? "var(--color-surface)"
                : "var(--color-primary)",
              color: settling ? "var(--color-text-secondary)" : "#131313",
              fontFamily: "var(--font-mono)",
              fontSize: "13px",
              fontWeight: 700,
              cursor: settling ? "not-allowed" : "pointer",
              opacity: settling ? 0.6 : 1,
            }}
          >
            {settling ? "Settling..." : "Confirm Settle"}
          </button>
        </div>
      </div>
    </div>
  );
}