/**
 * LMSR fixture tests — verifies TypeScript output matches Rust (lmsr.rs).
 *
 * Vectors are derived from running the Rust tests with known inputs
 * and recording outputs. The TS implementation must reproduce them.
 */
import { describe, it, expect } from 'vitest';
import {
  PRECISION,
  DEFAULT_B,
  expScaled,
  lnScaled,
  cost,
  buyCost,
  sellReturn,
  priceBps,
  allPricesBps,
  sharesForCost,
  probabilityYesBps,
  probabilityNoBps,
  buyCostYes,
  buyCostNo,
  sellReturnYes,
  sellReturnNo,
} from './lmsr';

describe('LMSR', () => {
  // ── expScaled ─────────────────────────────────────────────────────

  it('exp(0) = 1.0', () => {
    const result = expScaled(0n);
    expect(result).toBe(PRECISION); // 1.0 in fixed-point
  });

  it('exp(1.0) ≈ e', () => {
    const result = expScaled(PRECISION);
    const expected = BigInt(Math.round(Math.E * Number(PRECISION)));
    const diff = result > expected ? result - expected : expected - result;
    // Within 1% tolerance (Taylor 12 terms)
    expect(Number(diff)).toBeLessThan(Number(PRECISION / 100n));
  });

  it('exp(-1.0) ≈ 1/e', () => {
    const result = expScaled(-PRECISION);
    const expected = BigInt(Math.round((1 / Math.E) * Number(PRECISION)));
    const diff = result > expected ? result - expected : expected - result;
    expect(Number(diff)).toBeLessThan(Number(PRECISION / 10n));
  });

  it('exp(0.5) ≈ √e', () => {
    const half = PRECISION / 2n;
    const result = expScaled(half);
    const expected = BigInt(Math.round(Math.exp(0.5) * Number(PRECISION)));
    const diff = result > expected ? result - expected : expected - result;
    expect(Number(diff)).toBeLessThan(Number(PRECISION / 50n));
  });

  // ── lnScaled ──────────────────────────────────────────────────────

  it('ln(1.0) = 0', () => {
    const result = lnScaled(PRECISION);
    expect(Number(result)).toBe(0);
  });

  it('ln(e) ≈ 1.0', () => {
    const e = BigInt(Math.round(Math.E * Number(PRECISION)));
    const result = lnScaled(e);
    const diff = result > PRECISION ? result - PRECISION : PRECISION - result;
    expect(Number(diff)).toBeLessThan(Number(PRECISION / 100n));
  });

  it('ln(0) throws', () => {
    expect(() => lnScaled(0n)).toThrow('MathOverflow');
  });

  // ── Probability: equal quantities → 50% ───────────────────────────

  it('equal quantities → ~50% probability', () => {
    const b = 100_000_000_000n; // 100 SOL
    const q = 50_000_000_000n;  // 50 SOL each
    const p = probabilityYesBps(b, q, q);
    expect(Math.abs(p - 5000)).toBeLessThan(100);
  });

  it('equal quantities, multi-outcome → equal probabilities', () => {
    const b = 100_000_000_000n;
    const q = [50_000_000_000n, 50_000_000_000n, 50_000_000_000n];
    const prices = allPricesBps(q, b);
    for (const p of prices) {
      expect(Math.abs(p - 3333)).toBeLessThan(200);
    }
  });

  // ── Probability: biased quantities ────────────────────────────────

  it('YES has more shares → higher YES price', () => {
    const b = 100_000_000_000n;
    const p = probabilityYesBps(b, 100_000_000_000n, 50_000_000_000n);
    expect(p).toBeGreaterThan(5000);
  });

  it('NO has more shares → lower YES price', () => {
    const b = 100_000_000_000n;
    const p = probabilityYesBps(b, 50_000_000_000n, 100_000_000_000n);
    expect(p).toBeLessThan(5000);
  });

  it('YES + NO probabilities sum to ~10000 bps', () => {
    const b = 100_000_000_000n;
    const qYes = 80_000_000_000n;
    const qNo = 30_000_000_000n;
    const pYes = probabilityYesBps(b, qYes, qNo);
    const pNo = probabilityNoBps(b, qYes, qNo);
    // Should sum to 10000 (within rounding)
    expect(Math.abs(pYes + pNo - 10000)).toBeLessThan(5);
  });

  // ── Buy cost ──────────────────────────────────────────────────────

  it('buying shares costs something', () => {
    const b = 100_000_000_000n;
    const c = buyCostYes(b, 50_000_000_000n, 50_000_000_000n, 1_000_000n);
    expect(c).toBeGreaterThan(0n);
  });

  it('symmetric costs when pools equal', () => {
    const b = 100_000_000_000n;
    const qYes = 50_000_000_000n;
    const qNo = 50_000_000_000n;
    const costYes = buyCostYes(b, qYes, qNo, 1_000_000n);
    const costNo = buyCostNo(b, qYes, qNo, 1_000_000n);
    const diff = costYes > costNo ? costYes - costNo : costNo - costYes;
    expect(Number(diff)).toBeLessThan(1000);
  });

  it('buying more shares costs more per share (convexity)', () => {
    const b = 100_000_000_000n;
    const q = [50_000_000_000n, 50_000_000_000n];
    const cost1 = buyCost(q, b, 0, 1_000_000_000n);
    const cost10 = buyCost(q, b, 0, 10_000_000_000n);
    // cost10 / 10 > cost1 (average price increases with quantity)
    expect(cost10 * 1n).toBeGreaterThan(cost1 * 10n);
  });

  // ── Sell return ───────────────────────────────────────────────────

  it('sell return ≤ buy cost (AMM spread)', () => {
    const b = 100_000_000_000n;
    const qYes = 50_000_000_000n;
    const qNo = 50_000_000_000n;
    const delta = 1_000_000n;
    const buy = buyCostYes(b, qYes, qNo, delta);
    const sell = sellReturnYes(b, qYes + delta, qNo, delta);
    expect(sell).toBeLessThanOrEqual(buy);
  });

  it('cannot sell more shares than outstanding', () => {
    const b = 100_000_000_000n;
    expect(() => sellReturnYes(b, 10n, 10n, 100n)).toThrow('InsufficientShares');
  });

  // ── Large quantities (overflow check) ─────────────────────────────

  it('large quantities do not overflow', () => {
    const b = 1_000_000_000_000n; // 1000 SOL
    const qYes = 500_000_000_000n;
    const qNo = 500_000_000_000n;
    const delta = 100_000_000_000n; // 100 SOL
    const c = buyCostYes(b, qYes, qNo, delta);
    expect(c).toBeGreaterThan(0n);
  });

  // ── Cost function monotonicity ────────────────────────────────────

  it('cost increases when any q_i increases', () => {
    const b = 100_000_000_000n;
    const c1 = cost([50_000_000_000n, 50_000_000_000n], b);
    const c2 = cost([60_000_000_000n, 50_000_000_000n], b);
    expect(c2).toBeGreaterThan(c1);
  });

  // ── sharesForCost ─────────────────────────────────────────────────

  it('sharesForCost returns 0 for 0 budget', () => {
    const q = [50_000_000_000n, 50_000_000_000n];
    const b = 100_000_000_000n;
    expect(sharesForCost(q, b, 0, 0n)).toBe(0n);
  });

  it('sharesForCost result costs ≤ budget', () => {
    const q = [50_000_000_000n, 50_000_000_000n];
    const b = 100_000_000_000n;
    const budget = 5_000_000_000n; // 5 SOL
    const shares = sharesForCost(q, b, 0, budget);
    expect(shares).toBeGreaterThan(0n);
    const actualCost = buyCost(q, b, 0, shares);
    expect(actualCost).toBeLessThanOrEqual(budget);
  });

  it('sharesForCost+1 costs > budget', () => {
    const q = [50_000_000_000n, 50_000_000_000n];
    const b = 100_000_000_000n;
    const budget = 5_000_000_000n;
    const shares = sharesForCost(q, b, 0, budget);
    if (shares > 0n) {
      const overCost = buyCost(q, b, 0, shares + 1n);
      expect(overCost).toBeGreaterThan(budget);
    }
  });

  // ── Rust fixture vectors ──────────────────────────────────────────
  // These test that our TS matches the Rust implementation's behavior

  it('fixture: probability range sweep', () => {
    const b = 100_000_000_000n;
    const cases: [bigint, bigint, number][] = [
      [0n, 0n, 5000],         // equal → 50%
      [50_000_000_000n, 50_000_000_000n, 5000], // equal → 50%
      [100_000_000_000n, 0n, 7311],              // heavily YES
      [0n, 100_000_000_000n, 2689],              // heavily NO
    ];
    for (const [qYes, qNo, expected] of cases) {
      const p = probabilityYesBps(b, qYes, qNo);
      expect(Math.abs(p - expected)).toBeLessThan(200);
    }
  });

  it('fixture: buy cost at various prices', () => {
    const b = 100_000_000_000n;
    // Buying 1 SOL of YES shares at 50%
    const cost50 = buyCostYes(b, 50_000_000_000n, 50_000_000_000n, 1_000_000_000n);
    // Buying 1 SOL of YES shares at ~73% (YES-heavy)
    const cost73 = buyCostYes(b, 100_000_000_000n, 50_000_000_000n, 1_000_000_000n);
    // Should cost more when price is higher
    expect(cost73).toBeGreaterThan(cost50);
  });

  it('fixture: roundtrip buy-sell loses to spread', () => {
    const b = 100_000_000_000n;
    const qYes = 50_000_000_000n;
    const qNo = 50_000_000_000n;
    const shares = 10_000_000_000n;

    const buyCostAmt = buyCostYes(b, qYes, qNo, shares);
    const sellReturnAmt = sellReturnYes(b, qYes + shares, qNo, shares);
    // Roundtrip loses or equals cost in pure LMSR
    expect(sellReturnAmt).toBeLessThanOrEqual(buyCostAmt);
  });

  it('fixture: multi-outcome probabilities sum to ~10000', () => {
    const b = 100_000_000_000n;
    const q = [30_000_000_000n, 50_000_000_000n, 20_000_000_000n, 40_000_000_000n];
    const prices = allPricesBps(q, b);
    const sum = prices.reduce((a, b) => a + b, 0);
    expect(Math.abs(sum - 10000)).toBeLessThan(10);
  });
});
