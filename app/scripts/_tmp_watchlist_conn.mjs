import { chromium } from "playwright";

const base = "http://localhost:3000";
const WALLET = "2zPRxYVxFDUZn6QEYU2m6bzyZcN7pCCJ4E25gc2EQcCS";

const browser = await chromium.launch({
  executablePath: "/home/selva/.local/bin/google-chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 140));
});

// Mock a connected Phantom wallet (duck-typed publicKey is enough for watchlist paths).
await page.addInitScript(
  ({ walletB58 }) => {
    window.__mockWallet = {
      isPhantom: true,
      get publicKey() {
        return {
          toBase58: () => walletB58,
          equals: (o) => o?.toBase58?.() === walletB58,
        };
      },
      async connect() { this._connected = true; },
      async disconnect() {},
    };
    localStorage.setItem("solpredict-wallet", walletB58);
  },
  { walletB58: WALLET }
);

// Route: go to the market detail page, toggle watchlist OFF then ON, then check DB.
const MARKET = "7m4wbCZfdGiPgqciLsrtwZUzXyEW33Wa52hWooh1aANp";

await page.goto(`${base}/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(5000);

// The page fetches from the DB on mount (wallet loaded from localStorage via
// solpredict-wallet). Check what localStorage has after load:
const afterLoad = await page.evaluate(() => localStorage.getItem("solpredict-watchlist"));
console.log("watchlist localStorage after market page load:", afterLoad);

// Try toggling via the star button
const star = page.locator('button[title*="watchlist"], button[aria-label*="watchlist"], svg.star, [data-testid="watchlist-toggle"]').first();
if (await star.isVisible().catch(() => false)) {
  await star.click();
  await page.waitForTimeout(2500);
  const afterToggle = await page.evaluate(() => localStorage.getItem("solpredict-watchlist"));
  console.log("watchlist localStorage after star toggle:", afterToggle);
} else {
  console.log("no star button found (title check)");
}

const dbCheck = await fetch(`${base}/api/watchlist?wallet=${WALLET}`).then((r) => r.json());
console.log("DB watchlist after interaction:", JSON.stringify(dbCheck.keys ?? []));
console.log("\nconsole errors:", consoleErrors.length ? consoleErrors.join(" | ") : "(none)");
await browser.close();
