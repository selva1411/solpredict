/**
 * LMSR (Logarithmic Market Scoring Rule) — TypeScript port.
 *
 * Mirrors programs/solpredict/src/math/lmsr.rs exactly.
 * This is the ONLY module in the codebase that may compute a probability.
 * No API route, no component, no adapter may derive a price by division.
 * They read `last_price_bps` from market_outcomes, which the indexer
 * writes using these functions.
 *
 * All arithmetic uses bigint to avoid IEEE-754 precision loss on u64 values.
 * PRECISION = 10^9 matches Solana lamports.
 */

// ─── Constants ──────────────────────────────────────────────────────────

/** Fixed-point precision (9 decimals, matches lamports). */
export const PRECISION = 1_000_000_000n;

/** Default liquidity parameter: 100 SOL in lamports. */
export const DEFAULT_B = 100_000_000_000n;

// ─── Fixed-point math helpers ───────────────────────────────────────────

/**
 * Compute exp(x) for x scaled by PRECISION.
 * Taylor series: sum_{k=0}^{12} x^k / k!
 * Each term: term_n = term_{n-1} * x / (n * PRECISION)
 *
 * Matches lmsr.rs exp_scaled exactly.
 */
export function expScaled(x: bigint): bigint {
  let result = PRECISION;
  let term = PRECISION;

  for (let k = 1n; k <= 12n; k++) {
    term = (term * x) / (k * PRECISION);
    result = result + term;
  }

  if (result <= 0n) {
    throw new Error('MathOverflow: exp result non-positive');
  }

  return result;
}

/**
 * Compute ln(x) for x > 0, scaled by PRECISION.
 * Uses floating-point ln then converts back to fixed-point.
 * Matches lmsr.rs ln_scaled (which also uses f64).
 */
export function lnScaled(x: bigint): bigint {
  if (x === 0n) {
    throw new Error('MathOverflow: ln(0)');
  }

  const xF64 = Number(x) / Number(PRECISION);
  if (xF64 <= 0) {
    throw new Error('MathOverflow: ln of non-positive');
  }

  const lnF64 = Math.log(xF64);
  return BigInt(Math.round(lnF64 * Number(PRECISION)));
}

// ─── LMSR Core ──────────────────────────────────────────────────────────

/**
 * Cost function: C(q) = b * ln(Σ exp(q_i / b))
 *
 * For binary markets: C(q_yes, q_no) = b * ln(exp(q_yes/b) + exp(q_no/b))
 *
 * Generalised for n outcomes.
 *
 * @param q  Array of shares outstanding per outcome (in lamports)
 * @param b  Liquidity parameter (in lamports)
 * @returns  Total cost in lamports
 */
export function cost(q: bigint[], b: bigint): bigint {
  let sumExp = 0n;

  for (const qi of q) {
    const scaled = (qi * PRECISION) / b;
    sumExp += expScaled(scaled);
  }

  const lnSum = lnScaled(sumExp);
  return (BigInt(lnSum) * b) / PRECISION;
}

/**
 * Cost to buy `shares` of outcome `i`.
 * ΔC = C(q with q_i + shares) − C(q)
 */
export function buyCost(q: bigint[], b: bigint, i: number, shares: bigint): bigint {
  const costBefore = cost(q, b);
  const qAfter = [...q];
  qAfter[i] = qAfter[i] + shares;
  const costAfter = cost(qAfter, b);
  return costAfter - costBefore;
}

/**
 * Refund from selling `shares` of outcome `i`.
 * ΔC = C(q) − C(q with q_i - shares)
 */
export function sellReturn(q: bigint[], b: bigint, i: number, shares: bigint): bigint {
  if (shares > q[i]) {
    throw new Error('InsufficientShares');
  }
  const costBefore = cost(q, b);
  const qAfter = [...q];
  qAfter[i] = qAfter[i] - shares;
  const costAfter = cost(qAfter, b);
  return costBefore - costAfter;
}

/**
 * Instantaneous price (probability) of outcome `i` in basis points (0–10000).
 *
 * p_i = exp(q_i / b) / Σ exp(q_j / b)
 *
 * This is the ONLY function in the entire codebase that may produce a probability.
 */
export function priceBps(q: bigint[], b: bigint, i: number): number {
  let sumExp = 0n;
  const exps: bigint[] = [];

  for (const qi of q) {
    const scaled = (qi * PRECISION) / b;
    const e = expScaled(scaled);
    exps.push(e);
    sumExp += e;
  }

  if (sumExp === 0n) return 5000; // 50% default

  const bps = (exps[i] * 10000n) / sumExp;
  const bpsNum = Number(bps);

  // Clamp to [1, 9999] like the Rust version
  return Math.max(1, Math.min(9999, bpsNum));
}

/**
 * All prices at once (avoids recomputing exp per outcome).
 * Returns array of basis-point prices, one per outcome.
 */
export function allPricesBps(q: bigint[], b: bigint): number[] {
  let sumExp = 0n;
  const exps: bigint[] = [];

  for (const qi of q) {
    const scaled = (qi * PRECISION) / b;
    const e = expScaled(scaled);
    exps.push(e);
    sumExp += e;
  }

  if (sumExp === 0n) {
    return q.map(() => Math.round(10000 / q.length));
  }

  return exps.map(e => {
    const bps = Number((e * 10000n) / sumExp);
    return Math.max(1, Math.min(9999, bps));
  });
}

/**
 * Compute how many shares of outcome `i` can be purchased with `maxCost` lamports.
 * Binary search approach.
 */
export function sharesForCost(
  q: bigint[], b: bigint, i: number, maxCost: bigint
): bigint {
  if (maxCost <= 0n) return 0n;

  // Upper bound: maxCost * 2 shares (price is always ≤ 1)
  let lo = 0n;
  let hi = maxCost * 2n;

  // Quick check: if buying hi shares costs less than maxCost, return hi
  try {
    if (buyCost(q, b, i, hi) <= maxCost) return hi;
  } catch {
    // overflow — hi is too large, narrow it
    hi = maxCost;
  }

  // Binary search
  while (lo < hi - 1n) {
    const mid = (lo + hi) / 2n;
    try {
      const c = buyCost(q, b, i, mid);
      if (c <= maxCost) {
        lo = mid;
      } else {
        hi = mid;
      }
    } catch {
      hi = mid;
    }
  }

  return lo;
}

// ─── Convenience for binary markets ─────────────────────────────────────

/**
 * Binary-market YES probability in basis points.
 */
export function probabilityYesBps(b: bigint, qYes: bigint, qNo: bigint): number {
  return priceBps([qYes, qNo], b, 0);
}

/**
 * Binary-market NO probability in basis points.
 */
export function probabilityNoBps(b: bigint, qYes: bigint, qNo: bigint): number {
  return priceBps([qYes, qNo], b, 1);
}

/**
 * Cost to buy `delta` YES shares in a binary market.
 */
export function buyCostYes(b: bigint, qYes: bigint, qNo: bigint, delta: bigint): bigint {
  return buyCost([qYes, qNo], b, 0, delta);
}

/**
 * Cost to buy `delta` NO shares in a binary market.
 */
export function buyCostNo(b: bigint, qYes: bigint, qNo: bigint, delta: bigint): bigint {
  return buyCost([qYes, qNo], b, 1, delta);
}

/**
 * Refund from selling `delta` YES shares.
 */
export function sellReturnYes(b: bigint, qYes: bigint, qNo: bigint, delta: bigint): bigint {
  return sellReturn([qYes, qNo], b, 0, delta);
}

/**
 * Refund from selling `delta` NO shares.
 */
export function sellReturnNo(b: bigint, qYes: bigint, qNo: bigint, delta: bigint): bigint {
  return sellReturn([qYes, qNo], b, 1, delta);
}
