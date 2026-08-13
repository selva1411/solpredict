import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("page loads and shows header", async ({ page }) => {
    await page.goto("/");
    // Generous timeout: the dev server compiles the "/" route on first hit
    // during a full-suite run, which can exceed the 5s default. The navigation
    // test below uses the same 30s window for the same reason.
    await expect(page.locator("text=SOLPREDICT").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("text=Conviction,").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("text=ENTER MARKETS").first()).toBeVisible({ timeout: 30_000 });
  });

  test("shows stats strip", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=VOLUME").first()).toBeVisible();
    await expect(page.locator("text=OPEN MARKETS").first()).toBeVisible();
  });

  test("shows the live book panel", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=LIVE BOOK").first()).toBeVisible();
  });

  test("navigates to /markets on button click", async ({ page }) => {
    await page.goto("/");
    // Click the anchor (not the inner button text) so the <Link> navigation
    // triggers even if the button is mid-hydration.
    const link = page.locator('a[href="/markets"]').first();
    await link.waitFor({ state: "visible" });
    await link.click();
    // Dev-server first compile of /markets RSC can take several seconds during
    // a full-suite run — give it a generous window and re-assert on failure.
    await expect(page).toHaveURL(/\/markets/, { timeout: 30_000 });
  });

  test("shows mechanics section", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=02 — MECHANICS").first()).toBeVisible();
  });
});

test.describe("API health", () => {
  test("GET /api/health returns 200", async ({ request }) => {
    const resp = await request.get("/api/health");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.db).toBeDefined();
    expect(body.db.connected).toBe(true);
  });
});

test.describe("Markets page", () => {
  test("markets page loads", async ({ page }) => {
    await page.goto("/markets");
    await expect(page.locator("text=Markets").first()).toBeVisible();
  });
});

test.describe("Leaderboard page", () => {
  test("leaderboard page loads", async ({ page }) => {
    await page.goto("/leaderboard");
    await expect(page.locator("text=Leaderboard").first()).toBeVisible();
  });
});
