import { describe, it, expect } from "vitest";
import { syncMarketSchema, syncTradeSchema } from "./schemas";

describe("syncMarketSchema", () => {
  it("accepts a valid market sync", () => {
    const result = syncMarketSchema.safeParse({
      marketPubkey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      question: "Test question?",
      status: "settled",
      winningOutcome: "yes",
      yesPoolSol: 100,
    });
    expect(result.success).toBe(true);
  });

  it("accepts winningOutcome as optional", () => {
    const result = syncMarketSchema.safeParse({
      marketPubkey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      question: "Test question?",
      status: "open",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid winningOutcome", () => {
    const result = syncMarketSchema.safeParse({
      marketPubkey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      question: "Test question?",
      winningOutcome: "maybe",
    });
    expect(result.success).toBe(true);
  });
});

describe("syncTradeSchema", () => {
  it("accepts YES side notification message", () => {
    const result = syncTradeSchema.safeParse({
      marketPubkey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      trader: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      side: "YES",
      lamportsIn: 1000000000,
      tokensOut: 500000000,
    });
    expect(result.success).toBe(true);
    const msg = `${result.data!.side === "YES" ? "Bought" : "Sold"} ${result.data!.side} shares`;
    expect(msg).toBe("Bought YES shares");
  });

  it("accepts NO side notification message", () => {
    const result = syncTradeSchema.safeParse({
      marketPubkey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      trader: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      side: "NO",
      lamportsIn: 1000000000,
      tokensOut: 500000000,
    });
    expect(result.success).toBe(true);
    const msg = `${result.data!.side === "YES" ? "Bought" : "Sold"} ${result.data!.side} shares`;
    expect(msg).toBe("Sold NO shares");
  });

  it("accepts a SELL (negative lamportsIn/tokensOut)", () => {
    const result = syncTradeSchema.safeParse({
      marketPubkey: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      trader: "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      side: "YES",
      lamportsIn: -123456789,
      tokensOut: -40000000,
    });
    expect(result.success).toBe(true);
    expect(result.data!.lamportsIn).toBe(-123456789);
    expect(result.data!.tokensOut).toBe(-40000000);
  });
});
