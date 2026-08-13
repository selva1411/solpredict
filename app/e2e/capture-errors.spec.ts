import { test, Page } from "@playwright/test";

function collectErrors(page: Page) {
  const errors: { type: string; text: string }[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      errors.push({ type: msg.type(), text: msg.text().slice(0, 300) });
    }
  });
  page.on("pageerror", (err) => errors.push({ type: "pageerror", text: err.message.slice(0, 300) }));
  page.on("requestfailed", (req) => errors.push({ type: "requestfailed", text: `${req.url().slice(0, 150)} :: ${req.failure()?.errorText}` }));
  return errors;
}

test("capture console errors on market page", async ({ page, request }) => {
  const resp = await request.get("/api/markets/cached?limit=1");
  const body = await resp.json();
  const market = body.markets?.[0];
  test.skip(!market, "no markets");
  const href = `/market/${market.marketPubkey}`;
  const errors = collectErrors(page);
  await page.goto(href, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForTimeout(8000);
  console.log("=== ERRORS FOUND ===");
  for (const e of errors) console.log(`[${e.type}] ${e.text}`);
  console.log(`=== TOTAL: ${errors.length} ===`);
});
