/**
 * app/src/lib/market-pools.ts
 *
 * Resolve YES/NO pool reserves (lamports) to display.
 *
 * PRIORITY (single source of truth):
 *   1. On-chain reserves  — authoritative when RPC is reachable.
 *   2. Database columns   — `markets.yes_pool_lamports` / `markets.no_pool_lamports`,
 *                            a cached snapshot of the on-chain state written by the
 *                            indexer/reconciler. This is REAL liquidity, not derived.
 *   3. Previous UI state  — keep last known values for one tick to avoid flicker
 *                            during refetch. Marked `source: "previous"`.
 *   4. Empty              — truly unknown. Return 0/0. Never fabricate.
 *
 * FORBIDDEN: deriving pools from `totalVolume * odds`. Volume is cumulative
 * trade activity; odds are a probability. Neither is liquidity. Mixing them
 * produces fake numbers that disagree with the order book, the AMM, user
 * positions, and on-chain state — which is exactly the bug we are fixing.
 */

export interface PoolReservesInput {
  /** Authoritative on-chain YES reserve (lamports). 0 if RPC failed. */
  onChainYesLamports: number;
  /** Authoritative on-chain NO reserve (lamports). 0 if RPC failed. */
  onChainNoLamports: number;
  /** DB column `yes_pool_lamports`. 0 if unknown / not yet indexed. */
  dbYesLamports: number;
  /** DB column `no_pool_lamports`. 0 if unknown / not yet indexed. */
  dbNoLamports: number;
  /** Previous UI YES reserve (lamports) — used only to avoid flicker. */
  previousYesLamports?: number;
  /** Previous UI NO reserve (lamports) — used only to avoid flicker. */
  previousNoLamports?: number;
}

export type PoolReserveSource = "on-chain" | "database" | "previous" | "empty";

export interface PoolReserves {
  yesPoolLamports: number;
  noPoolLamports: number;
  source: PoolReserveSource;
}

export function resolvePoolReserves(input: PoolReservesInput): PoolReserves {
  const {
    onChainYesLamports,
    onChainNoLamports,
    dbYesLamports,
    dbNoLamports,
    previousYesLamports = 0,
    previousNoLamports = 0,
  } = input;

  // 1. On-chain is authoritative. A single non-zero side is valid (degenerate
  //    market, or one side fully sold out).
  if (onChainYesLamports > 0 || onChainNoLamports > 0) {
    return {
      yesPoolLamports: onChainYesLamports,
      noPoolLamports: onChainNoLamports,
      source: "on-chain",
    };
  }

  // 2. DB column snapshot (written by indexer/reconciler). Real liquidity.
  if (dbYesLamports > 0 || dbNoLamports > 0) {
    return {
      yesPoolLamports: dbYesLamports,
      noPoolLamports: dbNoLamports,
      source: "database",
    };
  }

  // 3. Keep last known UI values for one tick to avoid flicker while a refetch
  //    is in flight. Marked so consumers can choose to show a "stale" badge.
  if (previousYesLamports > 0 || previousNoLamports > 0) {
    return {
      yesPoolLamports: previousYesLamports,
      noPoolLamports: previousNoLamports,
      source: "previous",
    };
  }

  // 4. Truly empty. Never fabricate from volume.
  return { yesPoolLamports: 0, noPoolLamports: 0, source: "empty" };
}

/**
 * Compute implied odds from real reserves. Useful for display only —
 * never feed this back into reserve calculation.
 */
export function impliedYesOdds(yesPoolLamports: number, noPoolLamports: number): number {
  const total = yesPoolLamports + noPoolLamports;
  if (total <= 0) return 0.5;
  return yesPoolLamports / total;
}

/**
 * Helper to compute fallback pool distribution when display reserves are needed
 * for markets without on-chain reserves initialized yet.
 */
export function fallbackMarketPools(
  totalVolLamports: number,
  yesOdds: number = 0.5,
  prevYesLamports: number = 0,
  prevNoLamports: number = 0,
  hasMarket: boolean = false
): { yesPoolLamports: number; noPoolLamports: number } {
  if (hasMarket && (prevYesLamports > 0 || prevNoLamports > 0)) {
    return { yesPoolLamports: prevYesLamports, noPoolLamports: prevNoLamports };
  }
  // Use total volume if present, or fallback default 100 SOL (LMSR default b parameter)
  const total = totalVolLamports > 0 ? totalVolLamports : 100 * 1e9;
  const yesPoolLamports = Math.round(total * yesOdds);
  const noPoolLamports = Math.round(total * (1 - yesOdds));
  return { yesPoolLamports, noPoolLamports };
}