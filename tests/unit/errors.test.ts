import { expect } from "chai";
import { toError, getErrorMessage } from "../../app/src/lib/errors";

describe("errors", () => {
  describe("toError", () => {
    it("returns the same Error instance when given an Error", () => {
      const err = new Error("test");
      expect(toError(err)).to.equal(err);
    });

    it("creates an Error from a string", () => {
      const result = toError("something broke");
      expect(result).to.be.instanceOf(Error);
      expect(result.message).to.equal("something broke");
    });

    it("extracts message from an object with message property", () => {
      const result = toError({ message: "object error" });
      expect(result.message).to.equal("object error");
    });

    it("converts non-Error, non-string values via String()", () => {
      const result = toError(42);
      expect(result.message).to.equal("42");
    });

    it("handles null", () => {
      const result = toError(null);
      expect(result.message).to.equal("null");
    });

    it("handles undefined", () => {
      const result = toError(undefined);
      expect(result.message).to.equal("undefined");
    });
  });

  describe("getErrorMessage", () => {
    it("returns message from Error instance", () => {
      expect(getErrorMessage(new Error("fail"))).to.equal("fail");
    });

    it("returns the string itself when given a string", () => {
      expect(getErrorMessage("direct")).to.equal("direct");
    });

    it("extracts message from object with message property", () => {
      expect(getErrorMessage({ message: "extracted" })).to.equal("extracted");
    });

    it("converts non-string primitives via String()", () => {
      expect(getErrorMessage(99)).to.equal("99");
    });
  });
});
