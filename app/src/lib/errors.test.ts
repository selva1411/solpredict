import { describe, it, expect } from "vitest";
import { toError, getErrorMessage } from "./errors";

describe("toError", () => {
  it("returns Error for string", () => {
    const e = toError("bad");
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe("bad");
  });

  it("returns same Error instance", () => {
    const orig = new Error("already");
    expect(toError(orig)).toBe(orig);
  });

  it("extracts message from object", () => {
    expect(toError({ message: "oops" }).message).toBe("oops");
  });

  it("converts primitive number", () => {
    expect(toError(42).message).toBe("42");
  });

  it("converts null", () => {
    expect(toError(null).message).toBe("null");
  });

  it("converts undefined", () => {
    expect(toError(undefined).message).toBe("undefined");
  });

  it("converts object without message", () => {
    const obj = { foo: "bar" };
    expect(toError(obj).message).toBe("[object Object]");
  });
});

describe("getErrorMessage", () => {
  it("returns message from Error", () => {
    expect(getErrorMessage(new Error("fail"))).toBe("fail");
  });

  it("returns string directly", () => {
    expect(getErrorMessage("direct")).toBe("direct");
  });

  it("extracts message from object", () => {
    expect(getErrorMessage({ message: "oops" })).toBe("oops");
  });

  it("converts primitive number", () => {
    expect(getErrorMessage(42)).toBe("42");
  });

  it("converts null", () => {
    expect(getErrorMessage(null)).toBe("null");
  });

  it("converts undefined", () => {
    expect(getErrorMessage(undefined)).toBe("undefined");
  });

  it("converts object without message", () => {
    const obj = { foo: "bar" };
    expect(getErrorMessage(obj)).toBe("[object Object]");
  });
});
