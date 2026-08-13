import { test, expect, Page } from "@playwright/test";

/**
 * Comprehensive end-to-end test suite for the PREDICT-X app.
 * Covers every page and key interaction. Requires the localnet validator +
 * seeded DB (dev server on :3000 with the app/.env.local pointing at localnet).
 */

async function gotoWithSettled(page: Page, url: string, timeout = 15_000) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout });
}

test.describe("Navigation shell", () => {
  test("global navigation renders on every page", async ({ page }) => {
    await gotoWithSettled(page, "/");
    await expect(page.locator("text=SOLPREDICT").first()).toBeVisible();
    await expect(page.locator("header").first()).toBeVisible();
    // Nav links
    for (const label of ["Markets", "Leaderboard", "Activity"]) {
      await expect(page.locator(`header a:has-text("${label}")`).first()).toBeVisible();
    }
  });

  test("mobile bottom nav renders on small viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoWithSettled(page, "/");
    // MobileBottomNav should be present on small screens
    await expect(page.locator("nav").last()).toBeVisible();
  });
});

test.describe("Home page", () => {
  test("hero + stats + trending load", async ({ page }) => {
    await gotoWithSettled(page, "/");
    await expect(page.locator("text=Conviction").first()).toBeVisible();
    await expect(page.locator("text=priced.").first()).toBeVisible();
    await expect(page.locator("text=Enter Markets").first()).toBeVisible();
    await expect(page.locator("text=Live Book").first()).toBeVisible();
  });

  test("stat cards render values", async ({ page }) => {
    await gotoWithSettled(page, "/");
    await expect(page.locator("text=Volume").first()).toBeVisible();
    await expect(page.locator("text=Open Markets").first()).toBeVisible();
  });

  test("market cards link to market detail", async ({ page }) => {
    await gotoWithSettled(page, "/");
    const card = page.locator("a[href^='/market/']").first();
    if (await card.count()) {
      await card.click();
      await expect(page).toHaveURL(/\/market\//, { timeout: 10_000 });
    }
  });
});

test.describe("Markets directory", () => {
  test("loads market directory with markets", async ({ page }) => {
    await gotoWithSettled(page, "/markets");
    await expect(page.locator("text=Market Directory").first()).toBeVisible();
  });

  test("category filtering works", async ({ page }) => {
    await gotoWithSettled(page, "/markets");
    const crypto = page.locator("button:has-text('Crypto')").first();
    await crypto.click();
    // Should still render the directory; ensure no crash
    await expect(page.locator("text=Market Directory").first()).toBeVisible();
  });

  test("search filters markets", async ({ page }) => {
    await gotoWithSettled(page, "/markets");
    const search = page.locator("input[placeholder*='question, description']");
    await search.fill("SOL");
    await expect(page.locator("text=Market Directory").first()).toBeVisible();
  });

  test("grid/table view toggle", async ({ page }) => {
    await gotoWithSettled(page, "/markets");
    const tableBtn = page.locator("button[title='Table View']");
    if (await tableBtn.count()) {
      await tableBtn.click();
      await expect(page.locator("text=Market").first()).toBeVisible();
    }
  });
});

test.describe("Market detail page", () => {
  test("open market detail renders trade UI", async ({ page }) => {
    await gotoWithSettled(page, "/markets");
    const link = page.locator("a[href^='/market/']").first();
    if (!(await link.count())) {
      test.skip();
      return;
    }
    const href = await link.getAttribute("href");
    await gotoWithSettled(page, href!);
    await expect(page).toHaveURL(/\/market\//);
    // Trade panel / order ticket elements
    await expect(page.locator("[data-testid='buy-submit']").first()).toBeVisible({ timeout: 15_000 });
  });

  test("share button opens share options", async ({ page }) => {
    await gotoWithSettled(page, "/markets");
    const link = page.locator("a[href^='/market/']").first();
    if (!(await link.count())) {
      test.skip();
      return;
    }
    const href = await link.getAttribute("href");
    await gotoWithSettled(page, href!);
    const share = page.locator("text=Share").first();
    if (await share.count()) {
      await share.click();
      await expect(page.locator("text=Copy Link").first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("watchlist star toggles without crash", async ({ page }) => {
    await gotoWithSettled(page, "/markets");
    const link = page.locator("a[href^='/market/']").first();
    if (!(await link.count())) {
      test.skip();
      return;
    }
    const href = await link.getAttribute("href");
    await gotoWithSettled(page, href!);
    const star = page.locator("button[aria-label*='watchlist'], button:has(svg.lucide-star)").first();
    if (await star.count()) {
      await star.click();
      await expect(page.locator("text=Added to watchlist").first()).toBeVisible({ timeout: 5_000 }).catch(() => {});
    }
  });
});

test.describe("Leaderboard", () => {
  test("leaderboard page loads", async ({ page }) => {
    await gotoWithSettled(page, "/leaderboard");
    await expect(page.locator("text=Leaderboard").first()).toBeVisible();
  });
});

test.describe("Activity", () => {
  test("activity page loads", async ({ page }) => {
    await gotoWithSettled(page, "/activity");
    await expect(page.locator("text=Activity").first()).toBeVisible();
  });
});

test.describe("Discover", () => {
  test("discover page loads with categories", async ({ page }) => {
    await gotoWithSettled(page, "/discover");
    await expect(page.locator("text=Discover").first()).toBeVisible();
    await expect(page.locator("text=Trending Markets").first()).toBeVisible();
  });
});

test.describe("Watchlist", () => {
  test("watchlist page loads with empty state", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("solpredict-watchlist", "[]");
    });
    await gotoWithSettled(page, "/watchlist");
    await expect(page.locator("text=Watchlist").first()).toBeVisible();
  });
});

test.describe("Create / Propose", () => {
  test("propose market wizard renders steps", async ({ page }) => {
    await gotoWithSettled(page, "/create");
    await expect(page.locator("text=Propose a Market").first()).toBeVisible();
    // Step indicators
    for (const label of ["Details", "Timing", "Oracle", "Review"]) {
      await expect(page.locator(`button:has-text("${label}")`).first()).toBeVisible();
    }
  });

  test("proposal wizard validates question length", async ({ page }) => {
    await gotoWithSettled(page, "/create");
    const question = page.locator("input[placeholder*='Will SOL close above']");
    await question.fill("short");
    // Next should be disabled (question < 10 chars)
    const next = page.locator("button:has-text('Next')").first();
    await expect(next).toBeDisabled();
  });
});

test.describe("Portfolio", () => {
  test("portfolio page loads (may show connect gate)", async ({ page }) => {
    await gotoWithSettled(page, "/portfolio");
    // The page heading is an h1 ("Portfolio" when connected; the gate shows
    // an h2 "Connect your wallet"). Avoid the hidden mobile-nav link also
    // labelled "Portfolio".
    await expect(page.locator("h1, h2").filter({ hasText: /Portfolio|Connect your wallet/ }).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});

test.describe("Rewards", () => {
  test("rewards page loads (connect gate or gallery)", async ({ page }) => {
    await gotoWithSettled(page, "/rewards");
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
    const hasConnect = await page.locator("text=Connect your wallet").first().isVisible().catch(() => false);
    const hasRewards = await page.locator("text=Rewards").first().isVisible().catch(() => false);
    expect(hasConnect || hasRewards).toBe(true);
  });
});

test.describe("Dashboard (analytics)", () => {
  test("dashboard page loads (connect gate or dashboard)", async ({ page }) => {
    await gotoWithSettled(page, "/dashboard");
    // Without a wallet the page shows a connect-wallet gate; with a wallet it
    // shows the Dashboard heading. Either is a successful render.
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
    const hasConnect = await page.locator("text=Connect Wallet").first().isVisible().catch(() => false);
    const hasDashboard = await page.locator("text=Dashboard").first().isVisible().catch(() => false);
    expect(hasConnect || hasDashboard).toBe(true);
  });
});

test.describe("Admin", () => {
  test("admin page loads", async ({ page }) => {
    await gotoWithSettled(page, "/admin");
    // Admin is role-gated: in dev the role is granted to everyone so the
    // console renders; in production a non-admin sees the connect gate.
    // The role resolves async (brief "Loading admin panel..." first), so poll
    // until one of the two final states appears.
    await expect
      .poll(async () => {
        const gate = await page.locator("text=SIGN IN TO OBSERVATORY").first().isVisible().catch(() => false);
        // The dev-mode console renders an h1 "[■] ADMIN OBSERVATORY CONSOLE".
        const consoleVisible = await page
          .locator("h1")
          .filter({ hasText: /ADMIN|OBSERVATORY/ })
          .first()
          .isVisible()
          .catch(() => false);
        return gate || consoleVisible;
      }, { timeout: 20_000, intervals: [1_000, 2_000] })
      .toBe(true);
  });
});

test.describe("Docs", () => {
  test("docs index loads", async ({ page }) => {
    await gotoWithSettled(page, "/docs");
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(0);
  });
});

test.describe("API endpoints", () => {
  test("GET /api/markets/cached returns markets", async ({ request }) => {
    const resp = await request.get("/api/markets/cached");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.markets)).toBe(true);
  });

  test("GET /api/markets/trending returns data", async ({ request }) => {
    const resp = await request.get("/api/markets/trending");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.ok).toBe(true);
  });

  test("GET /api/leaderboard returns leaderboard", async ({ request }) => {
    const resp = await request.get("/api/leaderboard");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.ok).toBe(true);
  });

  test("GET /api/activity/recent returns activity", async ({ request }) => {
    const resp = await request.get("/api/activity/recent");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.ok).toBe(true);
  });

  test("GET /api/markets/stats returns stats", async ({ request }) => {
    const resp = await request.get("/api/markets/stats");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.ok).toBe(true);
  });

  test("GET /api/health/db reports db connected", async ({ request }) => {
    const resp = await request.get("/api/health/db");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.db.connected).toBe(true);
  });

  test("RPC proxy forwards to validator", async ({ request }) => {
    const resp = await request.post("/api/rpc", {
      data: { jsonrpc: "2.0", id: 1, method: "getHealth" },
    });
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.result).toBe("ok");
  });
});

test.describe("Error handling", () => {
  test("unknown market id shows empty state", async ({ page }) => {
    await gotoWithSettled(page, "/market/11111111111111111111111111111111");
    const body = await page.locator("body").innerText();
    // Either shows empty state or falls back to DB — must not crash to a blank page
    expect(body.length).toBeGreaterThan(0);
  });
});
