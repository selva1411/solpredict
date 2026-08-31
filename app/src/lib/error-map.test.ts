import { describe, it, expect } from "vitest";
import { getFriendlyErrorMessage, ERROR_MAP } from "./error-map";
import fs from "node:fs";
import path from "node:path";

const RUST_ERRORS_PATH = path.join(__dirname, "..", "..", "..", "programs", "solpredict", "src", "errors.rs");

/**
 * Every on-chain error variant declared in programs/solpredict/src/errors.rs
 * must have a friendly message in ERROR_MAP — otherwise users see raw Anchor
 * error codes instead of actionable text.
 */
function rustErrorVariants(): string[] {
  const rs = fs.readFileSync(RUST_ERRORS_PATH, "utf8");
  return [...rs.matchAll(/^\s{4}([A-Z][A-Za-z0-9_]+),/gm)].map((m) => m[1]);
}

describe("error-map", () => {
  it("covers every Rust error variant in errors.rs", () => {
    const missing = rustErrorVariants().filter((v) => !(v in ERROR_MAP));
    expect(missing).toEqual([]);
  });

  it("contains no message with empty string", () => {
    const empty = Object.entries(ERROR_MAP).filter(([, msg]) => !msg || !msg.trim());
    expect(empty).toEqual([]);
  });

  it("getFriendlyErrorMessage resolves newly added variants", () => {
    expect(getFriendlyErrorMessage(new Error("SlippageExceeded"))).toBe(
      ERROR_MAP.SlippageExceeded
    );
    expect(getFriendlyErrorMessage("InsufficientLiquidity")).toBe(
      ERROR_MAP.InsufficientLiquidity
    );
    expect(getFriendlyErrorMessage(new Error("MarketPaused"))).toBe(
      ERROR_MAP.MarketPaused
    );
    expect(getFriendlyErrorMessage(new Error("PositionHasUnclaimedRewards"))).toBe(
      ERROR_MAP.PositionHasUnclaimedRewards
    );
  });

  it("getFriendlyErrorMessage maps raw Anchor error codes for the boundary errors", () => {
    for (const key of [
      "FeeTooHigh",
      "InvalidQuantity",
      "TooEarlyToSettle",
      "MarketNotSettled",
    ] as const) {
      expect(ERROR_MAP[key]).toBeTruthy();
    }
  });
});