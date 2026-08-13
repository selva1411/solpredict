import { test, expect, Page } from "@playwright/test";

/**
 * Verifies the market detail page actually renders meaningful content
 * (question, order book, pool data) — not just that it doesn't crash.
 */

test("market detail renders question + order book + pool data", async ({ page, request }) => {
  const resp = await request.get("/api/markets/cached?limit=1");
  const body = await resp.json();
  const market = body.markets?.[0];
  test.skip(!market, "no markets in DB");
  const href = `/market/${market.marketPubkey}`;

  await page.goto(href, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForTimeout(6000);

  const bodyText = await page.locator("body").innerText();
  const question = market.question as string;

  // Question should be present (either exact or truncated). The detail page
  // renders the question with CSS text-transform: uppercase, so innerText
  // returns it uppercased — compare case-insensitively.
  const questionPart = question.slice(0, 40);
  expect(bodyText.toUpperCase()).toContain(questionPart.slice(0, 25).toUpperCase());

  // Order book section present (text-transform may uppercase it)
  expect(bodyText.toUpperCase()).toContain("CLOB ORDER BOOK");

  // Pool inventory labels
  expect(bodyText.toUpperCase()).toContain("TOTAL LIQUIDITY");
  expect(bodyText.toUpperCase()).toContain("YES POOL INVENTORY");
  expect(bodyText.toUpperCase()).toContain("NO POOL INVENTORY");

  // Trade-related controls (Buy / Sell)
  const hasBuy = bodyText.includes("Buy") || bodyText.includes("BUY");
  const hasSell = bodyText.includes("Sell") || bodyText.includes("SELL");
  expect(hasBuy || hasSell).toBe(true);
});

test("market detail shows question from on-chain account", async ({ page, request }) => {
  const resp = await request.get("/api/markets/cached?limit=1");
  const body = await resp.json();
  const market = body.markets?.[0];
  test.skip(!market, "no markets in DB");
  await page.goto(`/market/${market.marketPubkey}`, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForTimeout(4000);
  const bodyText = await page.locator("body").innerText();
  // The question itself should render (the DB cache mirrors on-chain state).
  // CSS text-transform uppercases it — compare case-insensitively.
  const question = (market.question as string).slice(0, 30);
  expect(bodyText.toUpperCase()).toContain(question.toUpperCase());
});
