import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("page loads and shows header", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=PREDICT-X").first()).toBeVisible();
    await expect(page.locator("text=Predict the future")).toBeVisible();
    await expect(page.locator("text=Win the future")).toBeVisible();
  });

  test("shows stats cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=24h Volume").first()).toBeVisible();
    await expect(page.locator("text=Open Markets").first()).toBeVisible();
  });

  test("shows Start Trading button", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Start Trading").first()).toBeVisible();
  });

  test("navigates to /markets on button click", async ({ page }) => {
    await page.goto("/");
    await page.locator("text=Start Trading").first().click();
    await expect(page).toHaveURL(/\/markets/);
  });

  test("shows trending section", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Trending Now").first()).toBeVisible();
  });

  test("shows Why PREDICT-X section", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Why PREDICT-X").first()).toBeVisible();
  });
});

test.describe("API health", () => {
  test("GET /api/health returns 200", async ({ request }) => {
    const resp = await request.get("/api/health");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.ok).toBe(true);
    expect(body.checks).toBeDefined();
    expect(body.checks.db.queryWorks).toBe(true);
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
