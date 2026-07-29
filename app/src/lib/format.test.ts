import BN from "bn.js";
import { describe, it, expect } from "vitest";
import {
  formatSol, lamportsToSol, bnToSol, bnToNum, formatNumber,
  solToLamports, shortAddr, calcYesPct, calcNoPct,
  formatTs, timeUntil, formatTimeLeft, isActive,
  categoryName, categoryColor, statusLabel, outcomeLabel,
  calcExpectedPayout,
} from "./format";

describe("formatSol", () => {
  it("formats 1 SOL", () => expect(formatSol(1_000_000_000)).toBe("1.000"));
  it("formats 0 SOL", () => expect(formatSol(0)).toBe("0.000"));
  it("returns 0.000 for null", () => expect(formatSol(null)).toBe("0.000"));
  it("returns 0.000 for undefined", () => expect(formatSol(undefined)).toBe("0.000"));
});

describe("lamportsToSol", () => {
  it("converts 1e9 lamports to 1 SOL", () => expect(lamportsToSol(1_000_000_000)).toBe(1));
  it("converts 0 to 0", () => expect(lamportsToSol(0)).toBe(0));
  it("converts null to 0", () => expect(lamportsToSol(null)).toBe(0));
});

describe("bnToSol", () => {
  it("converts 2e9 to 2", () => expect(bnToSol(2_000_000_000)).toBe(2));
});

describe("bnToNum", () => {
  it("returns number for input", () => expect(bnToNum(42)).toBe(42));
  it("returns 0 for null", () => expect(bnToNum(null)).toBe(0));
  it("returns 0 for undefined", () => expect(bnToNum(undefined)).toBe(0));
  it("handles BN instance", () => {
    expect(bnToNum(new BN(100))).toBe(100);
  });
  it("converts string number", () => {
    expect(bnToNum("42" as any)).toBe(42);
  });
});

describe("formatNumber", () => {
  it("formats 1000", () => expect(formatNumber(1000)).toBe("1,000"));
  it("handles null", () => expect(formatNumber(null)).toBe("0"));
});

describe("solToLamports", () => {
  it("converts string 1.5", () => expect(solToLamports("1.5").toNumber()).toBe(1_500_000_000));
  it("converts number 2", () => expect(solToLamports(2).toNumber()).toBe(2_000_000_000));
});

describe("shortAddr", () => {
  it("shortens a Solana address", () => {
    const result = shortAddr("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij");
    expect(result).toBe("ABCD...ghij");
  });
  it("returns empty for empty string", () => expect(shortAddr("")).toBe(""));
});

describe("calcYesPct", () => {
  it("returns 50 for equal pools", () => expect(calcYesPct(100, 100)).toBe(50));
  it("returns 50 for zero total (fair start)", () => expect(calcYesPct(0, 0)).toBe(50));
  it("returns 50 for null values (fair start)", () => expect(calcYesPct(null, null)).toBe(50));
  it("returns 100 for only yes pool", () => expect(calcYesPct(100, 0)).toBe(100));
  it("returns 0 for only no pool", () => expect(calcYesPct(0, 100)).toBe(0));
});

describe("calcNoPct", () => {
  it("returns 50 for equal pools", () => expect(calcNoPct(100, 100)).toBe(50));
});

describe("formatTs", () => {
  it("formats a known timestamp", () => {
    const ts = new Date("2025-01-01T00:00:00Z").getTime() / 1000;
    expect(formatTs(ts)).toContain("2025");
  });
  it("returns — for null", () => expect(formatTs(null)).toBe("—"));
  it("returns — for 0", () => expect(formatTs(0)).toBe("—"));
});

describe("timeUntil", () => {
  it("returns — for null", () => expect(timeUntil(null)).toBe("—"));
  it("returns Ended for past date", () => {
    const past = Math.floor(Date.now() / 1000) - 86400;
    expect(timeUntil(past)).toBe("Ended");
  });
  it("returns Xd Yh for > 1 day", () => {
    const future = Math.floor(Date.now() / 1000) + 200_000;
    const result = timeUntil(future);
    expect(result).toMatch(/\d+d \d+h/);
  });
  it("returns Xh Ym for > 1 hour", () => {
    const future = Math.floor(Date.now() / 1000) + 10_000;
    const result = timeUntil(future);
    expect(result).toMatch(/\d+h \d+m/);
  });
  it("returns Xm for < 1 hour", () => {
    const future = Math.floor(Date.now() / 1000) + 600;
    const result = timeUntil(future);
    expect(result).toMatch(/\d+m/);
  });
});

describe("formatTimeLeft", () => {
  it("returns — for null", () => expect(formatTimeLeft(null)).toBe("—"));
});

describe("isActive", () => {
  it("returns false for null", () => expect(isActive(null)).toBe(false));
  it("returns true for future timestamp", () => {
    const future = Math.floor(Date.now() / 1000) + 86400;
    expect(isActive(future)).toBe(true);
  });
  it("returns false for past timestamp", () => {
    const past = Math.floor(Date.now() / 1000) - 86400;
    expect(isActive(past)).toBe(false);
  });
});

describe("categoryName", () => {
  it("returns Crypto for 0", () => expect(categoryName(0)).toBe("Crypto"));
  it("returns Sports for 1", () => expect(categoryName(1)).toBe("Sports"));
  it("returns Politics for 2", () => expect(categoryName(2)).toBe("Politics"));
  it("returns Tech for 3", () => expect(categoryName(3)).toBe("Tech"));
  it("returns Other for 4", () => expect(categoryName(4)).toBe("Other"));
  it("returns Other for out of range", () => expect(categoryName(99)).toBe("Other"));
});

describe("categoryColor", () => {
  it("returns CSS variable for each category", () => {
    expect(categoryColor(0)).toContain("--color");
    expect(categoryColor(99)).toContain("--color");
  });
});

describe("statusLabel", () => {
  it("returns Open for 0", () => expect(statusLabel(0)).toBe("Open"));
  it("returns Settled for 1", () => expect(statusLabel(1)).toBe("Settled"));
  it("returns Cancelled for 2", () => expect(statusLabel(2)).toBe("Cancelled"));
  it("returns Unknown for other", () => expect(statusLabel(99)).toBe("Unknown"));
});

describe("outcomeLabel", () => {
  it("returns — for 0 (unset)", () => expect(outcomeLabel(0)).toBe("—"));
  it("returns YES ✓ for 1", () => expect(outcomeLabel(1)).toBe("YES ✓"));
  it("returns NO ✓ for 2", () => expect(outcomeLabel(2)).toBe("NO ✓"));
});

describe("calcExpectedPayout", () => {
  it("returns tokens and payout for yes bet", () => {
    const r = calcExpectedPayout(100_000_000, 0.5, "yes", 500_000_000, 500_000_000, 0);
    expect(r.tokens).toBeGreaterThan(0);
    expect(r.roi).toBeGreaterThan(0);
  });

  it("returns tokens and payout for no bet", () => {
    const r = calcExpectedPayout(100_000_000, 0.5, "no", 500_000_000, 500_000_000, 0);
    expect(r.tokens).toBeGreaterThan(0);
    expect(r.roi).toBeGreaterThan(0);
  });

  it("handles zero lamportsToBet", () => {
    const r = calcExpectedPayout(0, 0.5, "yes", 500_000_000, 500_000_000, 0);
    expect(r.tokens).toBe(0);
    expect(r.roi).toBe(0);
    expect(r.estimatedPayout).toBe(0);
  });
});
