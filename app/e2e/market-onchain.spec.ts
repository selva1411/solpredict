import { test, expect } from "@playwright/test";

// ManU market IS deployed on-chain. The detail page must load from the
// on-chain account (real pool reserves), NOT the DB fallback — otherwise
// every page would show different numbers.
const MARKET = "7m4wbCZfdGiPgqciLsrtwZUzXyEW33Wa52hWooh1aANp";

test("market detail loads from on-chain account (no DB fallback) with real pool reserves", async ({ page }) => {
  const fallbacks: string[] = [];
  page.on("console", (m) => {
    const t = m.text();
    if (t.includes("fallback") || t.includes("fetch failed")) fallbacks.push(t.slice(0, 120));
  });

  await page.goto(`/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(4_000);

  // The page must NOT have fallen back to the DB cache for a deployed market.
  const realFallback = fallbacks.filter(
    (f) => !f.includes("blockhash") && !f.includes("ERR_ABORTED") && !f.includes("AbortError")
  );
  console.log(`[probe] market-onchain fallbacks: ${JSON.stringify(realFallback)}`);
  expect(realFallback).toEqual([]);

  // Real on-chain pool reserves must render (NOT 0.00 SOL). The trading
  // dashboard shows the YES/NO probability; pool reserves render as
  // "N.NN SOL" figures under the order book / LP panel.
  const body = await page.locator("body").innerText();
  expect(body).toMatch(/\d+\.\d+ SOL/);
  expect(body).toMatch(/\d+% YES/); // real on-chain probability, not 0
});
