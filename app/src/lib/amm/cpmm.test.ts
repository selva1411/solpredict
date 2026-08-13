import { describe, it, expect } from "vitest";
import {
  getSpotPriceYes,
  getSpotPriceNo,
  getBuyCostIn,
  getBuyAmountOut,
  getSellAmountOut,
  buyCostLamports,
  sellRefundLamports,
  CPMM_SCALE,
} from "./cpmm";

describe("cpmm (probability-based constant-product AMM) parity with amm_math.rs", () => {
  it("balanced pools price each side at 50% and sum to 1", () => {
    const yes = 1_000_000n;
    const no = 1_000_000n;
    expect(getSpotPriceYes(yes, no, 0)).toBe(CPMM_SCALE / 2n);
    expect(getSpotPriceNo(yes, no, 0)).toBe(CPMM_SCALE / 2n);
    expect(getSpotPriceYes(yes, no, 0) + getSpotPriceNo(yes, no, 0)).toBe(CPMM_SCALE);
  });

  it("imbalanced pools price by share of total (never > 100%)", () => {
    const yes = 3_000_000n;
    const no = 1_000_000n;
    expect(getSpotPriceYes(yes, no, 0)).toBe((CPMM_SCALE * 3n) / 4n);
    expect(getSpotPriceNo(yes, no, 0)).toBe(CPMM_SCALE / 4n);
    // The old (broken) ratio pricing gave no/yes = 33% for YES and 300% for NO.
    expect(getSpotPriceNo(yes, no, 0) <= CPMM_SCALE).toBe(true);
  });

  it("buy increases spot price, sell decreases it", () => {
    let yes = 1_000_000n;
    let no = 1_000_000n;
    const fee = 30;

    const p0 = getSpotPriceYes(yes, no, fee);
    const cost = getBuyCostIn(yes, no, 100_000n, fee);
    yes = yes + cost;
    const p1 = getSpotPriceYes(yes, no, fee);
    expect(p1 > p0).toBe(true);

    const refund = getSellAmountOut(yes, no, 100_000n, fee);
    expect(refund < cost).toBe(true);
  });

  it("no-arbitrage round trip (refund < cost)", () => {
    const yes = 1_000_000n;
    const no = 1_000_000n;
    const fee = 30;
    const cost = getBuyCostIn(yes, no, 50_000n, fee);
    const newYes = yes + cost;
    const refund = getSellAmountOut(newYes, no, 50_000n, fee);
    expect(refund < cost).toBe(true);
  });

  it("buy_amount_out ↔ buy_cost_in round trip within 2", () => {
    const yes = 10_000_000n;
    const no = 10_000_000n;
    const fee = 30;
    const cost = getBuyCostIn(yes, no, 100_000n, fee);
    const dy = getBuyAmountOut(yes, no, cost, fee);
    const diff = 100_000n > dy ? 100_000n - dy : dy - 100_000n;
    expect(diff <= 2n).toBe(true);
  });

  it("symmetric pools produce clean spot price (200 bps fee)", () => {
    const yes = 10_000_000n;
    const no = 10_000_000n;
    const fee = 200;
    const spot = getSpotPriceYes(yes, no, fee);
    const feeAmt = (CPMM_SCALE / 2n) * 200n / 10_000n;
    const expected = CPMM_SCALE / 2n - feeAmt;
    const diff = expected > spot ? expected - spot : spot - expected;
    expect(diff < 1000n).toBe(true);
  });

  it("gross buy cost never exceeds face value (probability basis)", () => {
    const cases: Array<[bigint, bigint]> = [
      [1_000_000n, 1_000_000n],
      [1_000_000n, 9_000_000n],
      [9_000_000n, 1_000_000n],
      [1n, 1n],
    ];
    for (const [yes, no] of cases) {
      for (const fee of [0, 30, 300]) {
        const cost = getBuyCostIn(yes, no, 100_000n, fee);
        const maxFeeGross = (100_000n * 10_000n) / BigInt(10_000 - fee) + 2n;
        expect(cost <= maxFeeGross).toBe(true);
        expect(cost > 0n).toBe(true);
      }
    }
  });

  it("buyCostLamports handles YES vs NO pool ordering", () => {
    const poolYes = 3_000_000n;
    const poolNo = 1_000_000n;
    const fee = 50;
    const dy = 10_000n;
    const buyYes = buyCostLamports({ poolYes, poolNo, feeBps: fee }, "YES", dy);
    const buyNo = buyCostLamports({ poolYes, poolNo, feeBps: fee }, "NO", dy);
    expect(buyYes > 0n).toBe(true);
    expect(buyNo > 0n).toBe(true);
    // YES is favored (75%) so YES shares cost more than NO shares.
    expect(buyYes > buyNo).toBe(true);
  });

  it("sellRefundLamports < buyCostLamports for a position", () => {
    const poolYes = 10_000_000n;
    const poolNo = 10_000_000n;
    const fee = 30;
    const dy = 9_000_000n;
    const cost = buyCostLamports({ poolYes, poolNo, feeBps: fee }, "YES", dy);
    const newYes = poolYes + cost;
    const refund = sellRefundLamports({ poolYes: newYes, poolNo, feeBps: fee }, "YES", dy);
    expect(refund < cost).toBe(true);
    expect(refund > 0n).toBe(true);
  });

  it("works at extreme pool ratio without overflow", () => {
    const yes = 100_000n;
    const no = 1_000_000_000_000_000n;
    const fee = 50;
    const cost = getBuyCostIn(yes, no, 1n, fee);
    expect(cost > 0n).toBe(true);
    expect(cost <= 1n).toBe(true); // longshot YES is priced near zero
    const refund = getSellAmountOut(yes, no, 1n, fee);
    expect(refund < cost).toBe(true);
  });

  it("handles trades larger than the total pool without failure", () => {
    const yes = 1n;
    const no = 1n;
    const fee = 30;
    const cost = getBuyCostIn(yes, no, 100_000n, fee);
    expect(cost > 0n).toBe(true);
    expect(cost <= 100_000n * 10_000n / 9_700n + 2n).toBe(true);
  });

  it("getSellAmountOut on an empty side pool returns 0 (saturating cap), never negative", () => {
    // Rust: r_capped = r_gross.min(pool.saturating_sub(1)) → 0 when pool is 0.
    expect(getSellAmountOut(0n, 5_000_000n, 100_000n, 30)).toBe(0n);
    expect(getSellAmountOut(0n, 0n, 100_000n, 30)).toBe(0n);
    // Fee on 0 stays 0.
    expect(getSellAmountOut(1n, 0n, 100_000n, 300)).toBe(0n);
  });

  it("getSellAmountOut is capped below the side pool (mirrors saturating_sub(1))", () => {
    // Selling more value than the pool holds must refund < pool, not exceed it.
    const refund = getSellAmountOut(1_000n, 100_000_000n, 10_000_000n, 30);
    expect(refund < 1_000n).toBe(true);
    expect(refund >= 0n).toBe(true);
  });

  it("sellRefundLamports with empty pool yields 0 for both sides", () => {
    expect(sellRefundLamports({ poolYes: 0n, poolNo: 5_000_000n, feeBps: 30 }, "YES", 100_000n)).toBe(0n);
    expect(sellRefundLamports({ poolYes: 5_000_000n, poolNo: 0n, feeBps: 30 }, "NO", 100_000n)).toBe(0n);
  });
});
