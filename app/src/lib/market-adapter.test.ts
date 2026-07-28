import { describe, it, expect } from "vitest";
import { categoryFromIndex, lamportsToSol, onChainToUiMarket, CATEGORY_NAMES } from "./market-adapter";

describe("categoryFromIndex", () => {
  it("returns Crypto for index 0", () => expect(categoryFromIndex(0)).toBe("Crypto"));
  it("returns Sports for index 1", () => expect(categoryFromIndex(1)).toBe("Sports"));
  it("returns Politics for index 2", () => expect(categoryFromIndex(2)).toBe("Politics"));
  it("returns Tech for index 3", () => expect(categoryFromIndex(3)).toBe("Tech"));
  it("returns Other for index 4", () => expect(categoryFromIndex(4)).toBe("Other"));
  it("returns Other for out-of-range index", () => expect(categoryFromIndex(99)).toBe("Other"));
});

describe("lamportsToSol", () => {
  it("converts 1_000_000_000 lamports to 1 SOL", () => expect(lamportsToSol(1_000_000_000)).toBe(1));
  it("converts 0 to 0", () => expect(lamportsToSol(0)).toBe(0));
  it("converts 500_000_000 to 0.5", () => expect(lamportsToSol(500_000_000)).toBe(0.5));
});

describe("onChainToUiMarket", () => {
  const mockMarket = {
    publicKey: { toBase58: () => "test123" },
    account: {
      marketId: 1, question: "Test?", description: "A test", category: 0,
      oracleFeedId: [1, 2, 3], endTs: 2000000000, status: 0, winningOutcome: 0,
      yesPoolLamports: 100_000_000, noPoolLamports: 100_000_000, yesSupply: 1000, noSupply: 1000,
    },
  } as any;

  it("returns correct id", () => expect(onChainToUiMarket(mockMarket).id).toBe("test123"));
  it("returns correct question", () => expect(onChainToUiMarket(mockMarket).question).toBe("Test?"));
  it("returns Crypto category", () => expect(onChainToUiMarket(mockMarket).category).toBe("Crypto"));
  it("computes yesPrice = 0.5 for equal pools", () => expect(onChainToUiMarket(mockMarket).yesPrice).toBeCloseTo(0.5));
  it("returns 0 volume24h when no enrichment", () => expect(onChainToUiMarket(mockMarket).volume24h).toBeGreaterThan(0));
  it("returns 0 traders when no enrichment", () => expect(onChainToUiMarket(mockMarket).traders).toBeGreaterThan(0));
  it("uses enrichment volume when provided", () => {
    const result = onChainToUiMarket(mockMarket, { volume24h: 5000, traders: 10 });
    expect(result.volume24h).toBe(5000);
    expect(result.traders).toBe(10);
  });
});
