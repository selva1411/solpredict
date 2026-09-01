/**
 * app/src/lib/amm/lp.ts
 *
 * LP deposit math — TypeScript port of
 * `programs/solpredict/src/instructions/add_liquidity.rs` (the ONLY LP
 * accounting the on-chain program uses for add_liquidity).
 *
 * On-chain semantics (verified against add_liquidity.rs):
 *
 *   1. `lp_tokens_minted = yes_lamports + no_lamports`
 *      LP tokens are minted 1:1 with lamports deposited. There is NO curve,
 *      NO fee, and NO sqrt invariant — a balanced 1 SOL deposit (0.5 + 0.5)
 *      mints exactly 1e9 LP tokens.
 *   2. `market.yes_pool_lamports += yes_lamports` (same for NO) — each side's
 *      pool grows by exactly its deposit.
 *   3. The caller (UI) picks the split: balanced (half each), or a one-sided
 *      deposit into either pool.
 *
 * SINGLE SOURCE OF TRUTH: the trade-ticket preview, handleProvideLiquidity,
 * and the DB liquidity route all call these functions so the number a user
 * sees is always the number the transaction produces.
 */

export type LpAllocation = "balanced" | "yes" | "no";

export interface LpSplit {
  /** SOL to deposit into the YES pool. */
  yesSol: number;
  /** SOL to deposit into the NO pool. */
  noSol: number;
}

/**
 * Split an LP deposit across the YES/NO pools.
 *
 * - "balanced" → half the SOL to each side
 * - "yes"      → all SOL to the YES pool (one-sided deposit)
 * - "no"       → all SOL to the NO pool
 */
export function lpSplitFor(option: LpAllocation, amountSol: number): LpSplit {
  if (option === "yes") return { yesSol: amountSol, noSol: 0 };
  if (option === "no") return { yesSol: 0, noSol: amountSol };
  return { yesSol: amountSol / 2, noSol: amountSol / 2 };
}

/** Normalize an untrusted string (e.g. from an API body) to a valid allocation. */
export function normalizeLpAllocation(option: string | undefined | null): LpAllocation {
  return option === "yes" || option === "no" ? option : "balanced";
}

/**
 * Lamports deposited into each side — the exact values a submit handler must
 * pass to `addLiquidity(yes_lamports, no_lamports)` (rounded individually, as
 * the UI and on-chain do).
 */
export function lpSplitLamports(option: LpAllocation, amountSol: number): { yesLamports: number; noLamports: number } {
  const { yesSol, noSol } = lpSplitFor(option, amountSol);
  return { yesLamports: Math.round(yesSol * 1e9), noLamports: Math.round(noSol * 1e9) };
}

/**
 * LP tokens minted by a deposit — mirrors `lp_tokens_minted =
 * yes_lamports + no_lamports` from add_liquidity.rs. The rounded per-side
 * lamports are summed (NOT round(total * 1e9)) because a balanced deposit can
 * differ from the naive total by one lamport, and the program mints the sum
 * of the exact per-side values it receives.
 */
export function lpTokensMintedFor(option: LpAllocation, amountSol: number): number {
  const { yesLamports, noLamports } = lpSplitLamports(option, amountSol);
  return yesLamports + noLamports;
}

export interface LpPreview {
  /** SOL going to each pool (the split). */
  yesAddSol: number;
  noAddSol: number;
  /** Rounded lamports passed to addLiquidity. */
  yesAddLamports: number;
  noAddLamports: number;
  /** add_liquidity.rs: lp_tokens_minted = yes_lamports + no_lamports. */
  lpTokensMinted: number;
  /** Resulting pool sizes in SOL (current + deposit per side). */
  newYesPoolSol: number;
  newNoPoolSol: number;
}

/**
 * Full preview for a deposit, given the CURRENT pool sizes in SOL. Every value
 * is derived from the same split + rounding the on-chain program applies.
 */
export function lpPreview(option: LpAllocation, amountSol: number, currentYesPoolSol: number, currentNoPoolSol: number): LpPreview {
  // Minimum LP deposit enforced by UI: 0.1 SOL. On-chain: no minimum (by design for now).
  // TODO: Add MIN_LP_LAMPORTS = 10_000_000 check in add_liquidity.rs when LP spam becomes an issue.
  const { yesSol, noSol } = lpSplitFor(option, amountSol);
  const { yesLamports, noLamports } = lpSplitLamports(option, amountSol);
  return {
    yesAddSol: yesSol,
    noAddSol: noSol,
    yesAddLamports: yesLamports,
    noAddLamports: noLamports,
    lpTokensMinted: yesLamports + noLamports,
    newYesPoolSol: currentYesPoolSol + yesSol,
    newNoPoolSol: currentNoPoolSol + noSol,
  };
}
