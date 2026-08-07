import { describe, it, expect } from "vitest";
import {
  getSpotPriceYes,
  getBuyCostIn,
  getBuyAmountOut,
  getSellAmountOut,
  buyCostLamports,
  sellRefundLamports,
  CPMM_SCALE,
} from "./cpmm";

describe("cpmm (constant-product AMM) parity with amm_math.rs", () => {
  it("buy increases spot price, sell decreases it", () => {
    let yes = 1_000_000n;
    let no = 1_000_000n;
    const fee = 30;

    const p0 = getSpotPriceYes(yes, no, fee);
    const cost = getBuyCostIn(yes, no, 100_000n, fee);
    yes = yes - 100_000n;
    no = no + cost;
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
    const newYes = yes - 50_000n;
    const newNo = no + cost;
    const refund = getSellAmountOut(newYes, newNo, 50_000n, fee);
    expect(refund < cost).toBe(true);
  });

  it("buy_amount_out ↔ buy_cost_in round trip within 1", () => {
    const yes = 10_000_000n;
    const no = 10_000_000n;
    const fee = 30;
    const cost = getBuyCostIn(yes, no, 100_000n, fee);
    const dy = getBuyAmountOut(yes, no, cost, fee);
    const diff = 100_000n > dy ? 100_000n - dy : dy - 100_000n;
    expect(diff <= 1n).toBe(true);
  });

  it("symmetric pools produce clean spot price (200 bps fee)", () => {
    const yes = 10_000_000n;
    const no = 10_000_000n;
    const fee = 200;
    const spot = getSpotPriceYes(yes, no, fee);
    const feeAmt = CPMM_SCALE * 200n / 10_000n;
    const expected = CPMM_SCALE - feeAmt;
    const diff = expected > spot ? expected - spot : spot - expected;
    expect(diff < 1000n).toBe(true);
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
    // For asymmetric pools the two sides cost differently.
    expect(buyYes).not.toBe(buyNo);
  });

  it("sellRefundLamports < buyCostLamports for a position", () => {
    const poolYes = 10_000_000n;
    const poolNo = 10_000_000n;
    const fee = 30;
    const dy = 9_000_000n;
    const cost = buyCostLamports({ poolYes, poolNo, feeBps: fee }, "YES", dy);
    const newYes = poolYes - dy;
    const newNo = poolNo + cost;
    const refund = sellRefundLamports({ poolYes: newYes, poolNo: newNo, feeBps: fee }, "YES", dy);
    expect(refund < cost).toBe(true);
    expect(refund > 0n).toBe(true);
  });

  it("works at extreme pool ratio without overflow", () => {
    const yes = 100_000n;
    const no = 1_000_000_000_000_000n;
    const fee = 50;
    const cost = getBuyCostIn(yes, no, 1n, fee);
    expect(cost > 0n).toBe(true);
    const refund = getSellAmountOut(yes, no, 1n, fee);
    expect(refund < cost).toBe(true);
  });
});