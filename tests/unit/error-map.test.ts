import { expect } from "chai";
import { getFriendlyErrorMessage, ERROR_MAP } from "../../app/src/lib/error-map";

describe("error-map", () => {
  describe("ERROR_MAP", () => {
    it("contains known error keys", () => {
      expect(ERROR_MAP.Unauthorized).to.equal("Only the program admin can perform this action");
      expect(ERROR_MAP.MarketNotOpen).to.equal("Market is not open for trading");
      expect(ERROR_MAP.AlreadySettled).to.equal("Market has already been settled");
    });
  });

  describe("getFriendlyErrorMessage", () => {
    it("returns default for null/undefined input", () => {
      expect(getFriendlyErrorMessage(null)).to.equal("Unknown error occurred");
      expect(getFriendlyErrorMessage(undefined)).to.equal("Unknown error occurred");
    });

    it("maps error codes to friendly messages", () => {
      const err = new Error("MarketNotOpen");
      expect(getFriendlyErrorMessage(err)).to.equal("Market is not open for trading");
    });

    it("returns message if no error key matches", () => {
      const err = new Error("Some random error");
      expect(getFriendlyErrorMessage(err)).to.equal("Some random error");
    });

    it("handles insufficient lamports", () => {
      const err = new Error("Attempt to debit an account");
      const msg = getFriendlyErrorMessage(err);
      expect(msg).to.include("Insufficient SOL");
    });

    it("handles user rejection", () => {
      const err = new Error("User rejected the request");
      expect(getFriendlyErrorMessage(err)).to.equal("Transaction signature rejected by user.");
    });

    it("handles account does not exist", () => {
      const err = new Error("Account does not exist");
      expect(getFriendlyErrorMessage(err)).to.equal("Required account does not exist on-chain.");
    });

    it("handles custom program errors", () => {
      expect(getFriendlyErrorMessage(new Error("custom program error: 0x1783"))).to.equal(ERROR_MAP.FeeTooHigh);
      expect(getFriendlyErrorMessage(new Error("custom program error: 0x177d"))).to.equal(ERROR_MAP.InvalidQuantity);
      expect(getFriendlyErrorMessage(new Error("custom program error: 0x1774"))).to.equal(ERROR_MAP.TooEarlyToSettle);
    });

    it("truncates long messages", () => {
      const longMsg = "a".repeat(150);
      const result = getFriendlyErrorMessage(new Error(longMsg));
      expect(result.length).to.be.at.most(103);
    });

    it("handles object with message property", () => {
      expect(getFriendlyErrorMessage({ message: "AlreadySettled" })).to.equal("Market has already been settled");
    });
  });
});
