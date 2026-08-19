import { test, expect } from "@playwright/test";

const PAGES = [
  "/",
  "/markets",
  "/markets?status=all",
  "/leaderboard",
  "/dashboard",
  "/portfolio",
  "/activity",
  "/watchlist",
  "/discover",
  "/create",
  "/rewards",
  "/docs/help",
  "/profile/5wsehpAiwU7yUYj3YVef1iKU7N1GBECKYnoEHyoM7nX7",
  "/market/7m4wbCZfdGiPgqciLsrtwZUzXyEW33Wa52hWooh1aANp",
  "/market/5CSWPdHwK5enRVTkA9AfnG8RBv3uHp7ULJhEVQkhudPg",
];

test.describe("All pages render without console errors", () => {
  for (const path of PAGES) {
    test(`page renders: ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });

      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForTimeout(5_000);
      const body = await page.locator("body").innerText();
      expect(body.length).toBeGreaterThan(20);

      const fatal = errors.filter(
        (e) =>
          !e.includes("favicon") &&
          !e.includes("React DevTools") &&
          !e.includes("Failed to load resource") &&
          !e.includes("ERR_ABORTED") &&
          !e.includes("AbortError") &&
          !e.includes("Blockhash") &&
          !e.includes("failed, attempting database fallback") &&
          // dev-mode artifact: instant redirect() on /dashboard races
          // Next.js instrumentation, which calls performance.measure with a
          // negative timestamp ("DashboardPage cannot have a negative time
          // stamp"). Production builds do not run this instrumentation.
          !e.includes("cannot have a negative time stamp") &&
          // expected for settled/DB-only boards in the directory
          !e.includes("fetchNull")
      );
      console.log(`[probe] ${path}: fatalErrors=${fatal.length}`);
      if (fatal.length > 0) {
        console.log(`[probe] ${path} errors: ${[...new Set(fatal)].slice(0, 5).join(" || ")}`);
      }
      expect(fatal, [...new Set(fatal)].join(" | ")).toEqual([]);
    });
  }
});
