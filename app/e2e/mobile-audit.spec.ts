import { test, expect, Page } from "@playwright/test";

const PAGES = [
  "/", "/markets", "/dashboard", "/portfolio", "/activity", "/watchlist", "/discover", "/create", "/rewards", "/docs/help", "/leaderboard", "/gateway",
  "/market/7m4wbCZfdGiPgqciLsrtwZUzXyEW33Wa52hWooh1aANp",
  "/admin", "/admin/dashboard", "/admin/markets", "/admin/users", "/admin/treasury", "/admin/settings",
];

async function checkOverflow(page: Page, path: string, width: number) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForTimeout(2500);
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const vw = window.innerWidth;
    const offenders: string[] = [];
    // find elements wider than viewport
    document.querySelectorAll("body *").forEach((el) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width > vw + 1 || r.right > vw + 1) {
        const cls = ((el as HTMLElement).className || "").toString().slice(0, 90);
        const tag = el.tagName.toLowerCase();
        if (tag === "svg" || tag === "path") return;
        offenders.push(`${tag}.${cls} w=${Math.round(r.width)} right=${Math.round(r.right)}`);
      }
    });
    return { scrollW: doc.scrollWidth, vw, offenders: offenders.slice(0, 8) };
  });
  const ok = overflow.scrollW <= overflow.vw + 1;
  console.log(`[mob] ${path}@${width}: scrollW=${overflow.scrollW} vw=${overflow.vw} ok=${ok}`);
  if (overflow.offenders.length) {
    console.log(`[mob] ${path} offenders:`);
    overflow.offenders.forEach((o) => console.log(`  - ${o}`));
  }
  expect(overflow.scrollW, `${path}@${width} overflow -> ${overflow.offenders.join(" | ")}`).toBeLessThanOrEqual(overflow.vw + 1);
}

test.describe("Mobile responsive audit", () => {
  for (const w of [390, 768]) {
    for (const path of PAGES) {
      test(`${path} @${w}px has no horizontal overflow`, async ({ page }) => {
        await checkOverflow(page, path, w);
      });
    }
  }
});
