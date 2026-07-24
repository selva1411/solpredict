import * as anchor from "@coral-xyz/anchor";

const SCALE = new anchor.BN(1_000_000_000_000);

export function getSpotPriceYes(poolYes: anchor.BN, poolNo: anchor.BN, feeBps: number): anchor.BN {
  if (poolYes.isZero()) return new anchor.BN(0);
  const gross = poolNo.mul(SCALE).div(poolYes);
  const fee = gross.muln(feeBps).divn(10_000);
  return gross.sub(fee);
}

export function getSpotPriceNo(poolYes: anchor.BN, poolNo: anchor.BN, feeBps: number): anchor.BN {
  if (poolNo.isZero()) return new anchor.BN(0);
  const gross = poolYes.mul(SCALE).div(poolNo);
  const fee = gross.muln(feeBps).divn(10_000);
  return gross.sub(fee);
}

export function getBuyCostIn(
  poolYes: anchor.BN,
  poolNo: anchor.BN,
  dyOut: anchor.BN,
  feeBps: number,
): anchor.BN {
  if (dyOut.isZero() || dyOut.gte(poolYes)) throw new Error("InvalidQuantity");
  const k = poolYes.mul(poolNo);
  const newYes = poolYes.sub(dyOut);
  if (newYes.isZero()) throw new Error("MathOverflow");
  const newNo = k.div(newYes);
  const dxGross = newNo.sub(poolNo);
  const divisor = 10_000 - feeBps;
  if (divisor <= 0) throw new Error("InvalidFee");
  return dxGross.muln(10_000).divn(divisor);
}

export function getBuyAmountOut(
  poolYes: anchor.BN,
  poolNo: anchor.BN,
  dxIn: anchor.BN,
  feeBps: number,
): anchor.BN {
  if (dxIn.isZero()) throw new Error("InvalidQuantity");
  const k = poolYes.mul(poolNo);
  const fee = dxIn.muln(feeBps).divn(10_000);
  const dxAfterFee = dxIn.sub(fee);
  const newNo = poolNo.add(dxAfterFee);
  if (newNo.isZero()) return new anchor.BN(0);
  const newYes = k.div(newNo);
  return poolYes.sub(newYes);
}

export function getSellAmountOut(
  poolYes: anchor.BN,
  poolNo: anchor.BN,
  dyIn: anchor.BN,
  feeBps: number,
): anchor.BN {
  if (dyIn.isZero()) throw new Error("InvalidQuantity");
  const k = poolYes.mul(poolNo);
  const newYes = poolYes.add(dyIn);
  const newNo = k.div(newYes);
  const dxGross = poolNo.sub(newNo);
  const fee = dxGross.muln(feeBps).divn(10_000);
  return dxGross.sub(fee);
}

export function priceToPct(price: anchor.BN, decimals = 2): number {
  const pct = price.muln(100).div(SCALE);
  return pct.toNumber() / Math.pow(10, decimals);
}

export function pctToPrice(pct: number, decimals = 4): anchor.BN {
  const scaled = Math.round(pct * Math.pow(10, decimals));
  return new anchor.BN(scaled).mul(SCALE).divn(100 * Math.pow(10, decimals));
}

export function spotPriceFraction(poolYes: anchor.BN, poolNo: anchor.BN): number {
  const total = poolYes.add(poolNo);
  if (total.isZero()) return 0.5;
  return poolYes.toNumber() / total.toNumber();
}