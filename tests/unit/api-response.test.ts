import { expect } from "chai";
import { ok, badRequest, notFound, unauthorized, serverError } from "../../app/src/lib/api-response";

describe("api-response", () => {
  describe("ok", () => {
    it("returns 200 with JSON body", async () => {
      const res = ok({ ok: true, data: "test" });
      expect(res.status).to.equal(200);
      const body = await res.json();
      expect(body).to.deep.equal({ ok: true, data: "test" });
    });
  });

  describe("badRequest", () => {
    it("returns 400 with error message", async () => {
      const res = badRequest("Missing field");
      expect(res.status).to.equal(400);
      const body = await res.json();
      expect(body).to.deep.equal({ error: "Missing field" });
    });
  });

  describe("notFound", () => {
    it("returns 404 with default message", async () => {
      const res = notFound();
      expect(res.status).to.equal(404);
      const body = await res.json();
      expect(body).to.deep.equal({ error: "Not found" });
    });

    it("returns 404 with custom message", async () => {
      const res = notFound("Market not found");
      expect(res.status).to.equal(404);
      const body = await res.json();
      expect(body).to.deep.equal({ error: "Market not found" });
    });
  });

  describe("unauthorized", () => {
    it("returns 401 with default message", async () => {
      const res = unauthorized();
      expect(res.status).to.equal(401);
      const body = await res.json();
      expect(body).to.deep.equal({ error: "Unauthorized" });
    });

    it("returns 401 with custom message", async () => {
      const res = unauthorized("Admin auth required");
      expect(res.status).to.equal(401);
      const body = await res.json();
      expect(body).to.deep.equal({ error: "Admin auth required" });
    });
  });

  describe("serverError", () => {
    it("returns 500 with error message from Error", async () => {
      const res = serverError(new Error("Database down"));
      expect(res.status).to.equal(500);
      const body = await res.json();
      expect(body).to.deep.equal({ error: "Database down" });
    });

    it("returns 500 with sanitized error for string", async () => {
      const res = serverError("crash");
      expect(res.status).to.equal(500);
      const body = await res.json();
      expect(body).to.have.property("error");
    });
  });
});
