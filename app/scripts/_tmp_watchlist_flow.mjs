import { chromium } from "playwright";

const base = "http://localhost:3000";
const WALLET = "2zPRxYVxFDUZn6QEYU2m6bzyZcN7pCCJ4E25gc2EQcCS"; // CLI admin keypair

const browser = await chromium.launch({
  executablePath: "/home/selva/.local/bin/google-chrome",
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 140));
});

// First: DB should have a watchlist row for this wallet (we POSTed earlier via curl).
// Verify via API directly:
const api = await fetch(`${base}/api/watchlist?wallet=${WALLET}`);
const apiJson = await api.json();
console.log("DB watchlist for wallet:", JSON.stringify(apiJson.keys ?? []));

// Simulate a connected wallet by seeding localStorage + a minimal wallet adapter isn't easy;
// instead test what the WATCHLIST PAGE does with localStorage as an anonymous user.
await page.addInitScript(({ keys }) => {
  localStorage.setItem("solpredict-watchlist", JSON.stringify(keys));
}, { keys: apiJson.keys ?? [] });

await page.goto(base + "/watchlist", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForTimeout(6000);

const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, " ").slice(0, 500);
console.log("\n===== WATCHLIST PAGE =====");
console.log(text);

const finalLocal = await page.evaluate(() => localStorage.getItem("solpredict-watchlist"));
console.log("\nlocalStorage watchlist after page load:", finalLocal);
console.log("\nconsole errors:", consoleErrors.length ? consoleErrors.join(" | ") : "(none)");
await browser.close();
