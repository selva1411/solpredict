import { describe, it, expect } from "vitest";
import { ok, badRequest, serverError, unauthorized, notFound, forbidden } from "./api-response";

describe("ok", () => {
  it("returns 200 with data", async () => {
    const res = ok({ ok: true, hello: "world" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.hello).toBe("world");
  });

  it("returns 200 with empty object", async () => {
    const res = ok({});
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({});
  });

  it("returns 200 with custom status via options", async () => {
    const res = ok({ ok: true }, { status: 201 } as ResponseInit);
    expect(res.status).toBe(201);
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
  it("returns 500 with string error", async () => {
    const res = serverError("broken");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("broken");
  });

  it("returns 500 from Error object", async () => {
    const res = serverError(new Error("something broke"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("something broke");
  });

  it("returns 500 from unknown", async () => {
    const res = serverError({ weird: "error" });
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

  it("returns 401 with default message", async () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
  });
});

describe("notFound", () => {
  it("returns 404 with message", async () => {
    const res = notFound("not here");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("not here");
  });
});

describe("forbidden", () => {
  it("returns 403 with message", async () => {
    const res = forbidden("no access");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("no access");
  });
});
