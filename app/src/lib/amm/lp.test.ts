/**
 * Parity tests for `app/src/lib/amm/lp.ts` against
 * `programs/solpredict/src/instructions/add_liquidity.rs`.
 *
 * On-chain contract (add_liquidity.rs):
 *   - `lp_tokens_minted = yes_lamports + no_lamports` (1:1 with lamports)
 *   - `market.yes_pool_lamports += yes_lamports` (same for NO)
 *   - caller picks the split: balanced (half each) or one-sided
 */
import { describe, it, expect } from "vitest";
import {
  lpSplitFor,
  normalizeLpAllocation,
  lpSplitLamports,
  lpTokensMintedFor,
  lpPreview,
} from "./lp";

describe("lpSplitFor — mirrors the UI/on-chain deposit split", () => {
  it("balanced splits SOL evenly between YES and NO", () => {
    expect(lpSplitFor("balanced", 1)).toEqual({ yesSol: 0.5, noSol: 0.5 });
    expect(lpSplitFor("balanced", 0.5)).toEqual({ yesSol: 0.25, noSol: 0.25 });
  });

  it("yes sends everything to the YES pool", () => {
    expect(lpSplitFor("yes", 2)).toEqual({ yesSol: 2, noSol: 0 });
  });

  it("no sends everything to the NO pool", () => {
    expect(lpSplitFor("no", 2)).toEqual({ yesSol: 0, noSol: 2 });
  });
});

describe("normalizeLpAllocation — untrusted API bodies", () => {
  it("accepts the three valid allocations", () => {
    expect(normalizeLpAllocation("balanced")).toBe("balanced");
    expect(normalizeLpAllocation("yes")).toBe("yes");
    expect(normalizeLpAllocation("no")).toBe("no");
  });

  it("falls back to balanced for garbage / missing values", () => {
    expect(normalizeLpAllocation(undefined)).toBe("balanced");
    expect(normalizeLpAllocation(null)).toBe("balanced");
    expect(normalizeLpAllocation("sports")).toBe("balanced");
    expect(normalizeLpAllocation("")).toBe("balanced");
  });
});

describe("lpSplitLamports — exact lamports passed to addLiquidity", () => {
  it("balanced 1 SOL → 0.5e9 + 0.5e9 lamports", () => {
    expect(lpSplitLamports("balanced", 1)).toEqual({
      yesLamports: 500_000_000,
      noLamports: 500_000_000,
    });
  });

  it("one-sided deposits zero out the other side", () => {
    expect(lpSplitLamports("yes", 0.5)).toEqual({
      yesLamports: 500_000_000,
      noLamports: 0,
    });
    expect(lpSplitLamports("no", 0.5)).toEqual({
      yesLamports: 0,
      noLamports: 500_000_000,
    });
  });
});

describe("lpTokensMintedFor — 1:1 LP tokens per lamport (add_liquidity.rs)", () => {
  it("mints exactly the lamports deposited (yes + no)", () => {
    // Balanced 1 SOL → 1e9 LP tokens (0.5e9 YES + 0.5e9 NO).
    expect(lpTokensMintedFor("balanced", 1)).toBe(1_000_000_000);
    expect(lpTokensMintedFor("yes", 1)).toBe(1_000_000_000);
    expect(lpTokensMintedFor("no", 1)).toBe(1_000_000_000);
    // 2.5 SOL → 2.5e9 regardless of split.
    expect(lpTokensMintedFor("balanced", 2.5)).toBe(2_500_000_000);
  });

  it("sums the ROUNDED per-side lamports, not round(total*1e9)", () => {
    // A balanced 0.333333333 SOL deposit: round(0.5 * 0.333333333e9) * 2
    // can differ from round(0.333333333e9) by one lamport. The on-chain
    // program mints yes_lamports + no_lamports of the exact values passed.
    const amount = 0.333333333;
    const perSide = Math.round(amount * 0.5 * 1e9);
    expect(lpTokensMintedFor("balanced", amount)).toBe(perSide * 2);
  });
});

describe("lpPreview — resulting pools grow by exactly the deposit", () => {
  it("balanced adds half the SOL to each pool", () => {
    const p = lpPreview("balanced", 1, 10, 4);
    expect(p.newYesPoolSol).toBeCloseTo(10.5, 9);
    expect(p.newNoPoolSol).toBeCloseTo(4.5, 9);
    expect(p.lpTokensMinted).toBe(1_000_000_000);
    expect(p.yesAddLamports).toBe(500_000_000);
    expect(p.noAddLamports).toBe(500_000_000);
  });

  it("one-sided deposit only grows the target pool", () => {
    const yesOnly = lpPreview("yes", 2, 10, 4);
    expect(yesOnly.newYesPoolSol).toBeCloseTo(12, 9);
    expect(yesOnly.newNoPoolSol).toBeCloseTo(4, 9);

    const noOnly = lpPreview("no", 2, 10, 4);
    expect(noOnly.newYesPoolSol).toBeCloseTo(10, 9);
    expect(noOnly.newNoPoolSol).toBeCloseTo(6, 9);
  });
});
