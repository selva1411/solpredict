import { describe, expect, it } from "vitest";
import { resolvePoolReserves, impliedYesOdds } from "@/lib/market-pools";

describe("resolvePoolReserves", () => {
  it("prefers on-chain reserves when available", () => {
    const r = resolvePoolReserves({
      onChainYesLamports: 5_000_000_000,
      onChainNoLamports: 3_000_000_000,
      dbYesLamports: 4_000_000_000, // stale DB value must be ignored
      dbNoLamports: 2_000_000_000,
    });
    expect(r).toEqual({
      yesPoolLamports: 5_000_000_000,
      noPoolLamports: 3_000_000_000,
      source: "on-chain",
    });
  });

  it("falls back to DB columns when on-chain is unavailable", () => {
    const r = resolvePoolReserves({
      onChainYesLamports: 0,
      onChainNoLamports: 0,
      dbYesLamports: 4_000_000_000,
      dbNoLamports: 2_000_000_000,
    });
    expect(r.source).toBe("database");
    expect(r.yesPoolLamports).toBe(4_000_000_000);
    expect(r.noPoolLamports).toBe(2_000_000_000);
  });

  it("keeps previous UI state to avoid flicker when both sources are zero", () => {
    const r = resolvePoolReserves({
      onChainYesLamports: 0,
      onChainNoLamports: 0,
      dbYesLamports: 0,
      dbNoLamports: 0,
      previousYesLamports: 7_000_000_000,
      previousNoLamports: 6_000_000_000,
    });
    expect(r.source).toBe("previous");
    expect(r.yesPoolLamports).toBe(7_000_000_000);
    expect(r.noPoolLamports).toBe(6_000_000_000);
  });

  it("returns empty (0/0) when nothing is known — NEVER fabricates from volume", () => {
    const r = resolvePoolReserves({
      onChainYesLamports: 0,
      onChainNoLamports: 0,
      dbYesLamports: 0,
      dbNoLamports: 0,
    });
    expect(r).toEqual({ yesPoolLamports: 0, noPoolLamports: 0, source: "empty" });
  });

  it("accepts single-sided reserves (degenerate market)", () => {
    const r = resolvePoolReserves({
      onChainYesLamports: 0,
      onChainNoLamports: 9_000_000_000,
      dbYesLamports: 0,
      dbNoLamports: 0,
    });
    expect(r.source).toBe("on-chain");
    expect(r.yesPoolLamports).toBe(0);
    expect(r.noPoolLamports).toBe(9_000_000_000);
  });

  it("does NOT derive pools from volume or odds (regression)", () => {
    // 2 SOL of lifetime volume must NOT show up as 1 SOL per side.
    const r = resolvePoolReserves({
      onChainYesLamports: 100_000_000,  // 0.1 SOL actual
      onChainNoLamports: 100_000_000,
      dbYesLamports: 0,
      dbNoLamports: 0,
    });
    expect(r.yesPoolLamports).toBe(100_000_000);
    expect(r.noPoolLamports).toBe(100_000_000);
  });
});

describe("impliedYesOdds", () => {
  it("returns 0.5 for empty pools", () => {
    expect(impliedYesOdds(0, 0)).toBe(0.5);
  });

  it("returns proportion of YES reserve", () => {
    expect(impliedYesOdds(3_000_000_000, 1_000_000_000)).toBeCloseTo(0.75);
  });
});