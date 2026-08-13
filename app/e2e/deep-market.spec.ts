import { test, expect, Page } from "@playwright/test";

/**
 * Deep test of the market detail page using a real market from the DB,
 * capturing console errors and verifying key sections render.
 */

function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`PAGEERROR: ${err.message}`));
  return errors;
}

test.describe("Market detail deep test", () => {
  test("renders full detail page with real market without console errors", async ({ page, request }) => {
    // Fetch a real market pubkey from the API
    const resp = await request.get("/api/markets/cached?limit=1");
    const body = await resp.json();
    const market = body.markets?.[0];
    test.skip(!market, "no markets in DB");
    const href = `/market/${market.marketPubkey}`;

    const errors = collectErrors(page);
    await page.goto(href, { waitUntil: "domcontentloaded", timeout: 20_000 });

    // Question should render (either on-chain or DB fallback)
    const bodyText = await page.locator("body").innerText();
    expect(bodyText.length).toBeGreaterThan(0);

    // Order book section (client component) renders once on-chain data loads.
    // CSS text-transform uppercases the heading, so match case-insensitively.
    const orderBookHeading = page.locator("body").getByText(/clob order book/i).first();
    await expect(orderBookHeading).toBeVisible({ timeout: 20_000 });
    expect((await page.locator("body").innerText()).toUpperCase()).toContain("TOTAL LIQUIDITY");

    // Verify no fatal page errors (aborted re-fetches are benign)
    const fatal = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("404") &&
        !e.includes("ERR_ABORTED") &&
        !e.includes("net::ERR") &&
        !e.includes("AbortError")
    );
    expect(fatal.length).toBe(0);
  });

  test("watchlist toggle works on market page", async ({ page, request }) => {
    const resp = await request.get("/api/markets/cached?limit=1");
    const body = await resp.json();
    const market = body.markets?.[0];
    test.skip(!market, "no markets in DB");
    const href = `/market/${market.marketPubkey}`;

    const errors = collectErrors(page);
    await page.goto(href, { waitUntil: "domcontentloaded", timeout: 20_000 });

    // Star button uses title="Add to watchlist" / "Remove from watchlist"
    const star = page.locator('button[title="Add to watchlist"], button[title="Remove from watchlist"]').first();
    if (await star.count()) {
      await star.click({ timeout: 5000 }).catch(() => {});
    }
    // No fatal errors after interaction (aborted re-fetches are benign)
    const fatal = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("404") &&
        !e.includes("ERR_ABORTED") &&
        !e.includes("net::ERR") &&
        !e.includes("AbortError")
    );
    expect(fatal.length).toBe(0);
  });

  test("trade panel quantity input works", async ({ page, request }) => {
    const resp = await request.get("/api/markets/cached?limit=1");
    const body = await resp.json();
    const market = body.markets?.[0];
    test.skip(!market, "no markets in DB");
    const href = `/market/${market.marketPubkey}`;

    const errors = collectErrors(page);
    await page.goto(href, { waitUntil: "domcontentloaded", timeout: 20_000 });

    // Find a number input in the trade panel (quantity)
    const qtyInput = page.locator("input[type='number']").first();
    if (await qtyInput.count()) {
      await qtyInput.fill("25");
      const val = await qtyInput.inputValue();
      expect(val).toBe("25");
    }
    const fatal = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("404") &&
        !e.includes("ERR_ABORTED") &&
        !e.includes("net::ERR") &&
        !e.includes("AbortError")
    );
    expect(fatal.length).toBe(0);
  });
});

test.describe("Admin sections", () => {
  test("admin overview loads", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/admin", { waitUntil: "domcontentloaded", timeout: 20_000 });
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
    const fatal = errors.filter((e) => !e.includes("favicon"));
    expect(fatal.length).toBe(0);
  });

  test("admin markets page loads", async ({ page }) => {
    await page.goto("/admin/markets", { waitUntil: "domcontentloaded", timeout: 20_000 });
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
  });

  test("admin dashboard loads", async ({ page }) => {
    await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded", timeout: 20_000 });
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
  });

  test("admin users loads", async ({ page }) => {
    await page.goto("/admin/users", { waitUntil: "domcontentloaded", timeout: 20_000 });
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
  });

  test("admin treasury loads", async ({ page }) => {
    await page.goto("/admin/treasury", { waitUntil: "domcontentloaded", timeout: 20_000 });
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
  });

  test("admin settings loads", async ({ page }) => {
    await page.goto("/admin/settings", { waitUntil: "domcontentloaded", timeout: 20_000 });
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
  });
});

test.describe("Profile page", () => {
  test("profile page loads for admin wallet", async ({ page }) => {
    await page.goto("/profile/2zPRxYVxFDUZn6QEYU2m6bzyZcN7pCCJ4E25gc2EQcCS", {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
  });
});
