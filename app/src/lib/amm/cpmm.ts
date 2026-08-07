/**
 * Constant-Product AMM — TypeScript port of
 * `programs/solpredict/src/utils/amm_math.rs` (the ONLY pricing engine the
 * on-chain program actually uses for buy/sell).
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

/**
 * Spot price of YES in fixed-point (SCALE). Returns 0 when yes pool is empty.
 * price_yes = pool_no / pool_yes, fee-adjusted. Mirrors get_spot_price_yes.
 */
export function getSpotPriceYes(poolYes: bigint, poolNo: bigint, feeBps: number): bigint {
  if (poolYes === 0n) return 0n;
  const gross = (poolNo * BigInt(CPMM_SCALE)) / poolYes;
  const fee = (gross * BigInt(feeBps)) / 10000n;
  return gross - fee;
}

/** Spot price of NO, i.e. pool_yes scaled by pool_no. Same form. */
export function getSpotPriceNo(poolYes: bigint, poolNo: bigint, feeBps: number): bigint {
  if (poolNo === 0n) return 0n;
  const gross = (poolYes * CPMM_SCALE) / poolNo;
  const fee = (gross * BigInt(feeBps)) / 10000n;
  return gross - fee;
}

/**
 * Cost (in lamports) to buy `dyOut` lamports-worth of the traded side.
 * Mirrors get_buy_cost_in: k = yes*no; new_yes = yes - dy_out; new_no = k/new_yes.
 * Throws if dy_out >= pool.
 */
export function getBuyCostIn(poolA: bigint, poolB: bigint, dyOut: bigint, feeBps: number): bigint {
  if (dyOut <= 0n) throw new Error('InvalidQuantity');
  if (dyOut >= poolA) throw new Error('InvalidQuantity');
  const k = poolA * poolB;
  const newA = poolA - dyOut;
  if (newA === 0n) throw new Error('MathOverflow');
  const newB = k / newA;
  const dxGross = newB - poolB;
  const divisor = 10000n - BigInt(feeBps);
  return (dxGross * 10000n) / divisor;
}

/**
 * Shares-out (in the same unit as the pool passed as `poolA`) for an input of
 * `dxIn` lamports. Mirrors get_buy_amount_out.
 */
export function getBuyAmountOut(poolA: bigint, poolB: bigint, dxIn: bigint, feeBps: number): bigint {
  if (dxIn <= 0n) throw new Error('InvalidQuantity');
  const k = poolA * poolB;
  const fee = (dxIn * BigInt(feeBps)) / 10000n;
  const dxAfterFee = dxIn - fee;
  const newB = poolB + dxAfterFee;
  if (newB === 0n) return 0n;
  const newA = k / newB;
  return poolA - newA;
}

/**
 * Refund (lamports) for selling `dyIn`-value of the traded side.
 * Mirrors get_sell_amount_out.
 */
export function getSellAmountOut(poolA: bigint, poolB: bigint, dyIn: bigint, feeBps: number): bigint {
  if (dyIn <= 0n) throw new Error('InvalidQuantity');
  const k = poolA * poolB;
  const newA = poolA + dyIn;
  const newB = k / newA;
  const dxGross = poolB - newB;
  const fee = (dxGross * BigInt(feeBps)) / 10000n;
  return dxGross - fee;
}

/**
 * Handle the two pool arguments for buy/sell so callers stay close to the
 * on-chain convention (side pool first). Buying YES: cost added flows into the
 * YES pool on-chain, so cheap.
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