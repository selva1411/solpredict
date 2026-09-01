/**
 * Constant-Product AMM — TypeScript port of
 * `programs/solpredict/src/utils/amm_math.rs` (the ONLY pricing engine the
 * on-chain program actually uses for buy/sell).
 *
 * Pricing is PROBABILITY-based to match the documented implied-probability
 * formula `docs/program/00-design-decisions.md` §2:
 *
 *     probability = pool_side / (pool_yes + pool_no)
 *
 * The pools hold the SOL committed to each outcome. Buying `v`-value of a side
 * credits the side pool (one-sided pool model), so the post-trade probability
 * is `(side + cost) / (side + cost + other)`, and the cost is the shares'
 * value priced at that post-trade probability — a constant-product curve in
 * probability space with correct slippage and prices in [0,1].
 *
 * Do NOT derive a price by simple pool-ratio division anywhere else — use
 * these functions so the UI matches what `buy_shares` / `sell_shares`
 * charge/refund on-chain.
 */

/** Fixed-point scale (1e12) matching amm_math.rs SCALE. */
export const CPMM_SCALE = 1_000_000_000_000n;

/** lamports → SOL */
export function lamportsToSol(lamports: number): number {
  return lamports / 1e9;
}

/** Floor integer square root for bigint (Newton's method). */
export function isqrt(x: bigint): bigint {
  if (x < 2n) return x;
  let r = x;
  while (r > x / r) {
    r = (r + x / r) / 2n;
  }
  while (r > 0n && r * r > x) r -= 1n;
  while ((r + 1n) * (r + 1n) <= x) r += 1n;
  return r;
}

/**
 * Spot price of YES as a *probability* in fixed-point (SCALE).
 * price_yes = pool_yes / (pool_yes + pool_no), fee-adjusted. Mirrors
 * get_spot_price_yes. Returns 0 on an empty pool.
 */
export function getSpotPriceYes(poolYes: bigint, poolNo: bigint, _feeBps: number): bigint {
  const total = poolYes + poolNo;
  if (total === 0n) return 0n;
  // RAW probability — fees apply to cost/refund quotes, not to probability.
  // Subtracting them here broke p_yes + p_no = 1 at any non-zero fee.
  void _feeBps;
  return (poolYes * BigInt(CPMM_SCALE)) / total;
}

/** Spot price of NO as a probability. Mirrors get_spot_price_no. */
export function getSpotPriceNo(poolYes: bigint, poolNo: bigint, _feeBps: number): bigint {
  const total = poolYes + poolNo;
  if (total === 0n) return 0n;
  void _feeBps;
  return (poolNo * BigInt(CPMM_SCALE)) / total;
}

/**
 * Cost (in lamports) to buy `dyOut`-value of the traded side.
 * Mirrors get_buy_cost_in: c = [√((s−v)² + 4·v·a) − (s−v)] / 2 where s = a + b,
 * a = the side pool, b = the opposite pool, grossed up by the fee, floored at
 * 1 lamport. Callers swap the pool arguments for the NO side.
 */
export function getBuyCostIn(poolA: bigint, poolB: bigint, dyOut: bigint, feeBps: number): bigint {
  if (dyOut <= 0n) throw new Error('InvalidQuantity');
  const s = poolA + poolB;
  const diff = s >= dyOut ? s - dyOut : dyOut - s;
  const disc = diff * diff + 4n * dyOut * poolA;
  const root = isqrt(disc);
  const cGross = (s >= dyOut ? root - diff : root + diff) / 2n;
  const divisor = 10000n - BigInt(feeBps);
  const cWithFee = (cGross * 10000n) / divisor;
  return cWithFee >= 1n ? cWithFee : 1n;
}

/**
 * Shares-value (in the same unit as the pool passed as `poolA`) bought for
 * `dxIn` lamports. Exact inverse of getBuyCostIn (fee-adjusted both ways):
 * v = c·(c + a + b) / (a + c) where c = dxIn net of fee.
 */
export function getBuyAmountOut(poolA: bigint, poolB: bigint, dxIn: bigint, feeBps: number): bigint {
  if (dxIn <= 0n) throw new Error('InvalidQuantity');
  const fee = (dxIn * BigInt(feeBps)) / 10000n;
  const c = dxIn - fee;
  const denominator = poolA + c;
  if (denominator === 0n) return 0n;
  return (c * (c + poolA + poolB)) / denominator;
}

/**
 * Refund (lamports) for selling `dyIn`-value of the traded side.
 * Mirrors get_sell_amount_out: r = [(s + v) − √((s + v)² − 4·v·a)] / 2, capped
 * below the side pool, fee taken from the refund.
 */
export function getSellAmountOut(poolA: bigint, poolB: bigint, dyIn: bigint, feeBps: number): bigint {
  if (dyIn <= 0n) throw new Error('InvalidQuantity');
  const s = poolA + poolB + dyIn;
  const disc = s * s - 4n * dyIn * poolA;
  const root = isqrt(disc);
  const rGross = (s - root) / 2n;
  // amm_math.rs caps with `pool_yes.saturating_sub(1)` — mirror the saturating
  // semantics so an empty side pool yields 0, never a negative refund.
  const cap = poolA > 0n ? poolA - 1n : 0n;
  const rCapped = rGross < cap ? rGross : cap;
  const fee = (rCapped * BigInt(feeBps)) / 10000n;
  return rCapped - fee;
}

/**
 * Handle the two pool arguments for buy/sell so callers stay close to the
 * on-chain convention (side pool first).
 */
export interface PoolState {
  poolYes: bigint;
  poolNo: bigint;
  feeBps: number;
}

/**
 * Cost in lamports to buy `dyOutBaseUnits` of `side`.
 * For YES, pools map to get_buy_cost_in(pool_yes, pool_no, dy, fee).
 * For NO, they are swapped as the program does.
 */
export function buyCostLamports(p: PoolState, side: 'YES' | 'NO', dyOut: bigint): bigint {
  if (side === 'YES') return getBuyCostIn(p.poolYes, p.poolNo, dyOut, p.feeBps);
  return getBuyCostIn(p.poolNo, p.poolYes, dyOut, p.feeBps);
}

/**
 * Refund in lamports for selling `nBaseUnits` worth of `side`.
 */
export function sellRefundLamports(p: PoolState, side: 'YES' | 'NO', dyIn: bigint): bigint {
  if (side === 'YES') return getSellAmountOut(p.poolYes, p.poolNo, dyIn, p.feeBps);
  return getSellAmountOut(p.poolNo, p.poolYes, dyIn, p.feeBps);
}
