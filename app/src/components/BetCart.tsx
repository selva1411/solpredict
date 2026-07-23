"use client";
import { useState, useEffect, useCallback } from "react";

interface CartItem {
  marketId: number;
  marketQuestion: string;
  side: "yes" | "no";
  amountLamports: number;
  estimatedPayout: number;
}

export function useBetCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("solpredict-bet-cart");
      if (saved) setItems(JSON.parse(saved));
    } catch {}
  }, []);

  const save = useCallback((next: CartItem[]) => {
    setItems(next);
    try {
      sessionStorage.setItem("solpredict-bet-cart", JSON.stringify(next));
    } catch {}
  }, []);

  const addItem = useCallback(
    (item: CartItem) => {
      save([...items, item]);
    },
    [items, save]
  );

  const removeItem = useCallback(
    (index: number) => {
      const next = items.filter((_, i) => i !== index);
      save(next);
    },
    [items, save]
  );

  const clearCart = useCallback(() => {
    save([]);
  }, [save]);

  const totalLamports = items.reduce((sum, i) => sum + i.amountLamports, 0);
  const totalPayout = items.reduce((sum, i) => sum + i.estimatedPayout, 0);

  return {
    items,
    isOpen,
    setIsOpen,
    addItem,
    removeItem,
    clearCart,
    totalLamports,
    totalPayout,
    count: items.length,
  };
}

interface CartProps {
  items: CartItem[];
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  removeItem: (i: number) => void;
  clearCart: () => void;
  totalLamports: number;
  totalPayout: number;
  count: number;
  onPlaceAll: () => void;
  placing: boolean;
}

export default function BetCart({
  items,
  isOpen,
  setIsOpen,
  removeItem,
  clearCart,
  totalLamports,
  totalPayout,
  count,
  onPlaceAll,
  placing,
}: CartProps) {
  if (count === 0) return null;

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          bottom: "80px",
          right: "24px",
          zIndex: 9998,
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "var(--color-primary)",
          border: "none",
          color: "#131313",
          fontFamily: "var(--font-mono)",
          fontSize: "18px",
          fontWeight: 700,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(255,216,156,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {count}
      </button>

      {/* Cart panel */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "148px",
            right: "24px",
            zIndex: 9997,
            width: "320px",
            maxHeight: "400px",
            background: "var(--color-surface-variant)",
            border: "1px solid var(--color-outline)",
            borderRadius: "12px",
            padding: "16px",
            fontFamily: "var(--font-mono)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--color-primary)", fontSize: "14px", fontWeight: 700 }}>
              Bet Cart ({count})
            </span>
            <button
              onClick={clearCart}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-text-secondary)",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: "12px",
              }}
            >
              Clear
            </button>
          </div>

          <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
            {items.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "6px 8px",
                  background: "#131313",
                  borderRadius: "6px",
                  fontSize: "11px",
                }}
              >
                <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <span style={{ color: item.side === "yes" ? "var(--color-yes)" : "var(--color-no)" }}>
                    {item.side.toUpperCase()}
                  </span>
                  <span style={{ color: "var(--color-text-secondary)", marginLeft: "4px" }}>
                    {item.marketQuestion.slice(0, 30)}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ color: "var(--color-text-primary)" }}>
                    {(item.amountLamports / 1e9).toFixed(3)} SOL
                  </span>
                  <button
                    onClick={() => removeItem(i)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--color-no)",
                      cursor: "pointer",
                      fontSize: "14px",
                      padding: "0 2px",
                    }}
                  >
                    x
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              borderTop: "1px solid var(--color-outline)",
              paddingTop: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <span style={{ color: "var(--color-text-secondary)" }}>Total</span>
              <span style={{ color: "var(--color-text-primary)" }}>
                {(totalLamports / 1e9).toFixed(3)} SOL
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
              <span style={{ color: "var(--color-text-secondary)" }}>Est. Payout</span>
              <span style={{ color: "var(--color-yes)" }}>
                {(totalPayout / 1e9).toFixed(3)} SOL
              </span>
            </div>
            <button
              onClick={onPlaceAll}
              disabled={placing}
              style={{
                background: placing ? "var(--color-surface)" : "var(--color-primary)",
                border: "none",
                borderRadius: "6px",
                padding: "10px",
                color: placing ? "var(--color-text-secondary)" : "#131313",
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                fontWeight: 700,
                cursor: placing ? "not-allowed" : "pointer",
              }}
            >
              {placing ? "Placing bets..." : "Place All Bets"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export { type CartItem };