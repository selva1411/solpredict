import { describe, it, expect } from "vitest";
import { normalizeStatus, normalizeOutcome, effectiveTradePrice } from "./reducer";

describe("normalizeStatus", () => {
  it("keeps open as-is", () => {
    expect(normalizeStatus("open")).toBe("open");
  });

  it("maps closed/resolved to settled", () => {
    expect(normalizeStatus("closed")).toBe("settled");
    expect(normalizeStatus("resolved")).toBe("settled");
  });

  it("maps canceled/cancelled to cancelled", () => {
    expect(normalizeStatus("canceled")).toBe("cancelled");
    expect(normalizeStatus("cancelled")).toBe("cancelled");
  });

  it("handles undefined", () => {
    expect(normalizeStatus()).toBeUndefined();
  });

  it("is case-insensitive", () => {
    expect(normalizeStatus("OPEN")).toBe("open");
    expect(normalizeStatus("Settled")).toBe("settled");
  });
});

describe("normalizeOutcome", () => {
  it("keeps yes and no lowercase", () => {
    expect(normalizeOutcome("yes")).toBe("yes");
    expect(normalizeOutcome("no")).toBe("no");
  });

  it("normalizes case", () => {
    expect(normalizeOutcome("YES")).toBe("yes");
    expect(normalizeOutcome("No")).toBe("no");
  });

  it("maps cancel to cancelled", () => {
    expect(normalizeOutcome("cancel")).toBe("cancelled");
    expect(normalizeOutcome("cancelled")).toBe("cancelled");
  });

  it("rejects unknown outcomes", () => {
    expect(normalizeOutcome("maybe")).toBeUndefined();
    expect(normalizeOutcome()).toBeUndefined();
  });
});

describe("effectiveTradePrice", () => {
  it("uses pricePerToken when provided", () => {
    expect(
      effectiveTradePrice({ pricePerToken: 0.1234, lamportsIn: 1000000000, tokensOut: 500000000 })
    ).toBe(0.1234);
  });

  it("computes price for a BUY from signed lamports", () => {
    // 1 SOL in (1e9 lamports), 100 shares out (100 × 1e6 micro-shares)
    // → 1e-8 SOL per micro-share == 0.01 SOL per share.
    const p = effectiveTradePrice({ lamportsIn: 1_000_000_000, tokensOut: 100_000_000 });
    expect(p).toBeCloseTo(1e-8, 12);
  });

  it("computes price for a SELL (negative lamports/tokens)", () => {
    // 0.4 SOL refund (4e8 lamports), 40 shares sold (40 × 1e6 micro-shares)
    // → 1e-8 SOL per micro-share == 0.01 SOL per share.
    const p = effectiveTradePrice({ lamportsIn: -400_000_000, tokensOut: -40_000_000 });
    expect(p).toBeCloseTo(1e-8, 12);
  });

  it("returns 0 when there is no value", () => {
    expect(effectiveTradePrice({ lamportsIn: 0, tokensOut: 0 })).toBe(0);
    expect(effectiveTradePrice({ lamportsIn: 100, tokensOut: 0 })).toBe(0);
  });
});
