import { describe, it, expect } from "vitest";
import { normalizeStatus, normalizeOutcome } from "./reducer";

describe("normalizeStatus", () => {
  it("keeps open as-is", () => {
    expect(normalizeStatus("open")).toBe("open");
  });

  it("maps closed/resolved to settled", () => {
    expect(normalizeStatus("closed")).toBe("settled");
    expect(normalizeStatus("resolved")).toBe("settled");
  });

  it("maps canceled/cancelled to cancelled", () => {
    expect(normalizeStatus("canceled")).toBe("cancelled");
    expect(normalizeStatus("cancelled")).toBe("cancelled");
  });

  it("handles undefined", () => {
    expect(normalizeStatus()).toBeUndefined();
  });

  it("is case-insensitive", () => {
    expect(normalizeStatus("OPEN")).toBe("open");
    expect(normalizeStatus("Settled")).toBe("settled");
  });
});

describe("normalizeOutcome", () => {
  it("keeps yes and no lowercase", () => {
    expect(normalizeOutcome("yes")).toBe("yes");
    expect(normalizeOutcome("no")).toBe("no");
  });

  it("normalizes case", () => {
    expect(normalizeOutcome("YES")).toBe("yes");
    expect(normalizeOutcome("No")).toBe("no");
  });

  it("maps cancel to cancelled", () => {
    expect(normalizeOutcome("cancel")).toBe("cancelled");
    expect(normalizeOutcome("cancelled")).toBe("cancelled");
  });

  it("rejects unknown outcomes", () => {
    expect(normalizeOutcome("maybe")).toBeUndefined();
    expect(normalizeOutcome()).toBeUndefined();
  });
});
