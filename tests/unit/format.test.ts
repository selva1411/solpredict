import { expect } from "chai";
import BN from "bn.js";

// Import from app source using relative path
import {
  formatSol,
  lamportsToSol,
  bnToNum,
  formatNumber,
  solToLamports,
  shortAddr,
  calcYesPct,
  calcNoPct,
  formatTs,
  timeUntil,
  isActive,
  categoryName,
  categoryColor,
  statusLabel,
  outcomeLabel,
  formatBpsPct,
  assertBigIntSafe,
} from "../../app/src/lib/format";

describe("format utilities", () => {
  describe("formatSol", () => {
    it("formats BN lamports to SOL string", () => {
      expect(formatSol(new BN(1_000_000_000))).to.equal("1.000");
    });

    it("formats number lamports to SOL string", () => {
      expect(formatSol(500_000_000)).to.equal("0.500");
    });

    it("returns 0.000 for null/undefined", () => {
      expect(formatSol(null)).to.equal("0.000");
      expect(formatSol(undefined)).to.equal("0.000");
    });

    it("respects decimals parameter", () => {
      expect(formatSol(new BN(1_234_000_000), 4)).to.equal("1.2340");
    });
  });

  describe("lamportsToSol", () => {
    it("converts BN lamports to number", () => {
      expect(lamportsToSol(new BN(2_500_000_000))).to.equal(2.5);
    });

    it("converts number lamports to number", () => {
      expect(lamportsToSol(100_000_000)).to.equal(0.1);
    });

    it("returns 0 for null/undefined", () => {
      expect(lamportsToSol(null)).to.equal(0);
      expect(lamportsToSol(undefined)).to.equal(0);
    });
  });

  describe("bnToNum", () => {
    it("converts BN to number", () => {
      expect(bnToNum(new BN(123))).to.equal(123);
    });

    it("passes through numbers", () => {
      expect(bnToNum(456)).to.equal(456);
    });

    it("returns 0 for null/undefined", () => {
      expect(bnToNum(null)).to.equal(0);
      expect(bnToNum(undefined)).to.equal(0);
    });
  });

  describe("solToLamports", () => {
    it("converts SOL string to lamports BN", () => {
      const result = solToLamports("1.5");
      expect(BN.isBN(result)).to.be.true;
      expect(result.toNumber()).to.equal(1_500_000_000);
    });

    it("converts number to lamports BN", () => {
      const result = solToLamports(0.1);
      expect(result.toNumber()).to.equal(100_000_000);
    });
  });

  describe("shortAddr", () => {
    it("shortens a base58 address", () => {
      const addr = "ABCDefgh1234WXYZ5678abcdEFGH9012ijklMNOP";
      const result = shortAddr(addr);
      expect(result).to.have.lengthOf(11); // 4 + ... + 4
      expect(result).to.equal("ABCD...MNOP");
    });

    it("returns empty string for falsy input", () => {
      expect(shortAddr("")).to.equal("");
    });
  });

  describe("calcYesPct / calcNoPct", () => {
    it("returns 50% for empty pools", () => {
      expect(calcYesPct(0, 0)).to.equal(50);
    });

    it("calculates correct percentage", () => {
      expect(calcYesPct(new BN(300_000_000), new BN(700_000_000))).to.equal(30);
    });

    it("calcNoPct complements calcYesPct", () => {
      const yes = 400_000_000;
      const no = 600_000_000;
      expect(calcNoPct(yes, no)).to.equal(100 - calcYesPct(yes, no));
    });
  });

  describe("category utilities", () => {
    it("categoryName returns correct names", () => {
      expect(categoryName(0)).to.equal("Crypto");
      expect(categoryName(1)).to.equal("Sports");
      expect(categoryName(2)).to.equal("Politics");
      expect(categoryName(3)).to.equal("Tech");
      expect(categoryName(4)).to.equal("Other");
    });

    it("categoryName returns Other for out-of-range", () => {
      expect(categoryName(99)).to.equal("Other");
    });

    it("categoryColor returns color variables", () => {
      expect(categoryColor(0)).to.include("crypto");
      expect(categoryColor(4)).to.include("other");
    });
  });

  describe("statusLabel", () => {
    it("returns correct labels", () => {
      expect(statusLabel(0)).to.equal("Open");
      expect(statusLabel(1)).to.equal("Settled");
      expect(statusLabel(2)).to.equal("Cancelled");
    });

    it("returns Unknown for invalid status", () => {
      expect(statusLabel(99)).to.equal("Unknown");
    });
  });

  describe("outcomeLabel", () => {
    it("returns correct labels", () => {
      expect(outcomeLabel(0)).to.equal("—");
      expect(outcomeLabel(1)).to.equal("YES ✓");
      expect(outcomeLabel(2)).to.equal("NO ✓");
    });
  });

  describe("timeUntil", () => {
    it("returns '—' for falsy timestamp", () => {
      expect(timeUntil(0)).to.equal("—");
    });

    it("returns 'Ended' for past timestamp", () => {
      expect(timeUntil(1_000)).to.equal("Ended");
    });
  });

  describe("isActive", () => {
    it("returns false for past timestamp", () => {
      expect(isActive(1_000)).to.be.false;
    });
  });

  describe("formatBpsPct", () => {
    it("returns '—' for null / undefined", () => {
      expect(formatBpsPct(null)).to.equal("—");
      expect(formatBpsPct(undefined)).to.equal("—");
    });

    it("formats bps as percent with one decimal", () => {
      expect(formatBpsPct(5000)).to.equal("50.0%");
      expect(formatBpsPct(0)).to.equal("0.0%");
      expect(formatBpsPct(10000)).to.equal("100.0%");
      expect(formatBpsPct(125)).to.equal("1.3%");
    });
  });

  describe("assertBigIntSafe", () => {
    it("returns BigInt for safe inputs", () => {
      expect(assertBigIntSafe("1234")).to.equal(BigInt(1234));
      expect(assertBigIntSafe(1234)).to.equal(BigInt(1234));
      expect(assertBigIntSafe(BigInt(1234))).to.equal(BigInt(1234));
    });

    it("throws for unsafe inputs", () => {
      expect(() => assertBigIntSafe("abc")).to.throw();
      expect(() => assertBigIntSafe(-1)).to.throw();
      expect(() => assertBigIntSafe("-3")).to.throw();
    });
  });
});
