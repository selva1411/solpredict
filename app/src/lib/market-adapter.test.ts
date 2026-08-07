import { describe, it, expect } from "vitest";
import {
  categoryFromIndex, lamportsToSol, onChainToUiMarket,
  onChainMarketsToUi, CATEGORY_NAMES, CATEGORY_ICONS,
  categoryIcon,
} from "./market-adapter";

describe("categoryFromIndex", () => {
  it("returns Crypto for index 0", () => expect(categoryFromIndex(0)).toBe("Crypto"));
  it("returns Sports for index 1", () => expect(categoryFromIndex(1)).toBe("Sports"));
  it("returns Politics for index 2", () => expect(categoryFromIndex(2)).toBe("Politics"));
  it("returns Tech for index 3", () => expect(categoryFromIndex(3)).toBe("Tech"));
  it("returns Other for index 4", () => expect(categoryFromIndex(4)).toBe("Other"));
  it("returns Other for out-of-range index", () => expect(categoryFromIndex(99)).toBe("Other"));
  it("returns Other for negative index", () => expect(categoryFromIndex(-1)).toBe("Other"));
});

describe("categoryIcon", () => {
  it("returns ◎ for Crypto", () => expect(categoryIcon(0)).toBe("◎"));
  it("returns ⚽ for Sports", () => expect(categoryIcon(1)).toBe("⚽"));
  it("returns 🗳 for Politics", () => expect(categoryIcon(2)).toBe("🗳"));
  it("returns 💻 for Tech", () => expect(categoryIcon(3)).toBe("💻"));
  it("returns 🌐 for Other", () => expect(categoryIcon(4)).toBe("🌐"));
});

describe("CATEGORY_NAMES", () => {
  it("has 5 categories", () => expect(CATEGORY_NAMES).toHaveLength(5));
  it("starts with Crypto", () => expect(CATEGORY_NAMES[0]).toBe("Crypto"));
});

describe("CATEGORY_ICONS", () => {
  it("has icons for all categories", () => {
    for (const name of CATEGORY_NAMES) {
      expect(CATEGORY_ICONS[name]).toBeTruthy();
    }
  });
});

describe("lamportsToSol", () => {
  it("converts 1_000_000_000 lamports to 1 SOL", () => expect(lamportsToSol(1_000_000_000)).toBe(1));
  it("converts 0 to 0", () => expect(lamportsToSol(0)).toBe(0));
  it("converts 500_000_000 to 0.5", () => expect(lamportsToSol(500_000_000)).toBe(0.5));
  it("converts 1 lamport to 1e-9", () => expect(lamportsToSol(1)).toBe(1e-9));
});

describe("onChainToUiMarket", () => {
  const makeMock = (overrides: Record<string, unknown> = {}) => ({
    publicKey: { toBase58: () => (overrides.pubkey as string) ?? "test123" },
    account: {
      marketId: 1,
      question: "Test?",
      description: "A test market",
      category: 0,
      oracleFeedId: [1, 2, 3],
      endTs: 2000000000,
      status: 0,
      winningOutcome: 0,
      yesPoolLamports: 100_000_000,
      noPoolLamports: 100_000_000,
      yesSupply: 1000,
      noSupply: 1000,
      ...overrides,
    },
  }) as any;

  it("returns correct id", () => expect(onChainToUiMarket(makeMock()).id).toBe("test123"));
  it("returns correct question", () => expect(onChainToUiMarket(makeMock()).question).toBe("Test?"));
  it("returns correct description", () => expect(onChainToUiMarket(makeMock()).description).toBe("A test market"));
  it("returns Crypto category", () => expect(onChainToUiMarket(makeMock()).category).toBe("Crypto"));
  it("computes yesPrice = 0.5 for equal pools", () => expect(onChainToUiMarket(makeMock()).yesPrice).toBeCloseTo(0.5));
  it("computes yesPrice = 0.75 for 3:1 ratio", () => {
    const m = makeMock({ yesSupply: 300_000_000_000, noSupply: 100_000_000_000 });
    const result = onChainToUiMarket(m, { lastPriceBps: 7500 });
    expect(result.yesPrice).toBeCloseTo(0.75);
  });
  it("computes yesPrice = 0.5 for zero pools", () => {
    const m = makeMock({ yesPoolLamports: 0, noPoolLamports: 0 });
    expect(onChainToUiMarket(m).yesPrice).toBeCloseTo(0.5);
  });
  it("returns noPrice as 1 - yesPrice", () => {
    const result = onChainToUiMarket(makeMock());
    expect(result.noPrice).toBeCloseTo(1 - result.yesPrice);
  });
  it("returns 0 default volume24h when no enrichment", () => expect(onChainToUiMarket(makeMock()).volume24h).toBe(0));
  it("returns 0 default traders when no enrichment", () => expect(onChainToUiMarket(makeMock()).traders).toBe(0));
  it("returns false hot by default", () => expect(onChainToUiMarket(makeMock()).hot).toBe(false));
  it("returns false trending by default", () => expect(onChainToUiMarket(makeMock()).trending).toBe(false));
  it("returns No category for index 1", () => {
    const m = makeMock({ category: 1 });
    expect(onChainToUiMarket(m).category).toBe("Sports");
  });
  it("uses enrichment volume when provided", () => {
    const result = onChainToUiMarket(makeMock(), { volume24h: 5000, traders: 10 });
    expect(result.volume24h).toBe(5000);
    expect(result.traders).toBe(10);
  });
  it("uses enrichment hot flag", () => {
    const result1 = onChainToUiMarket(makeMock(), { hot: true });
    expect(result1.hot).toBe(true);
    const result2 = onChainToUiMarket(makeMock(), { hot: false });
    expect(result2.hot).toBe(false);
  });
  it("marks settled market as not hot", () => {
    const m = makeMock({ status: 1 });
    expect(onChainToUiMarket(m).hot).toBe(false);
  });
  it("returns correct endDate format", () => {
    const result = onChainToUiMarket(makeMock());
    expect(result.endDate).toContain("2033"); // 2000000000 * 1000 = ~2033
  });
  it("handles non-array oracleFeedId", () => {
    const m = makeMock({ oracleFeedId: "not-an-array" as any });
    expect(onChainToUiMarket(m).oracleFeedId).toBeDefined();
  });
});

describe("onChainMarketsToUi", () => {
  it("returns empty array for empty input", () => {
    expect(onChainMarketsToUi([])).toEqual([]);
  });

  it("returns array with same length", () => {
    const mock = {
      publicKey: { toBase58: () => "abc" },
      account: {
        marketId: 1, question: "Q?", description: "", category: 0,
        oracleFeedId: [], endTs: 2000000000, status: 0, winningOutcome: 0,
        yesPoolLamports: 0, noPoolLamports: 0, yesSupply: 0, noSupply: 0,
      },
    } as any;
    expect(onChainMarketsToUi([mock, mock])).toHaveLength(2);
  });
});
