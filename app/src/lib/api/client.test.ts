import { describe, it, expect } from "vitest";
import { contracts, apiFetch, ApiError } from "./client";

describe("contracts", () => {
  it("validates cachedMarketList", () => {
    const r = contracts.cachedMarketList.safeParse({
      ok: true,
      markets: [{ marketPubkey: "abc", marketId: 1, question: "Q", status: "open", yesPoolSol: 1.5, noPoolSol: 2, endTs: "2026-01-01T00:00:00Z" }],
    });
    expect(r.success).toBe(true);
  });

  it("defaults markets to [] when omitted", () => {
    const r = contracts.cachedMarketList.safeParse({ ok: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.markets).toEqual([]);
  });

  it("rejects malformed market list", () => {
    const r = contracts.cachedMarketList.safeParse({ ok: true, markets: [{ question: "missing pubkey" }] });
    expect(r.success).toBe(false);
  });

  it("validates market stats", () => {
    const r = contracts.marketStats.safeParse({
      ok: true,
      stats: { totalMarkets: 1, openMarkets: 1, settledMarkets: 0, cancelledMarkets: 0, totalVolume: "0", totalLiquidity: "0", totalTrades: 0, volume24h: "0", trades24h: 0, totalTraders: 0, activeTraders24h: 0 },
    });
    expect(r.success).toBe(true);
  });
});

describe("apiFetch", () => {
  it("throws ApiError on non-ok response with error message", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: "Database not available" }), { status: 503 });
    await expect(apiFetch("cachedMarketList", "/api/markets/cached")).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      message: "Database not available",
    });
  });

  it("throws ApiError on contract mismatch", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: true, markets: "not-an-array" }), { status: 200 });
    await expect(apiFetch("cachedMarketList", "/api/markets/cached")).rejects.toThrow(ApiError);
  });

  it("returns validated data on success", async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ ok: true, markets: [] }), { status: 200 });
    const data = await apiFetch("cachedMarketList", "/api/markets/cached");
    expect(data.ok).toBe(true);
    expect(data.markets).toEqual([]);
  });
});
