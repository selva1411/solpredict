import { describe, it, expect } from "vitest";
import { ok, badRequest, serverError, unauthorized } from "./api-response";

describe("ok", () => {
  it("returns 200 with data", async () => {
    const res = ok({ ok: true, hello: "world" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.hello).toBe("world");
  });
});

describe("badRequest", () => {
  it("returns 400 with error", async () => {
    const res = badRequest("invalid input");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid input");
  });
});

describe("serverError", () => {
  it("returns 500", async () => {
    const res = serverError("broken");
    expect(res.status).toBe(500);
  });
});

describe("unauthorized", () => {
  it("returns 401", async () => {
    const res = unauthorized("denied");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("denied");
  });
});
