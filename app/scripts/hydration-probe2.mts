import { chromium } from "@playwright/test";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage();
let n = 0;
page.on("console", async (m) => {
  const t = m.text();
  if ((m.type() === "error" || m.type() === "trace" || /hydrat|Mismatch|mismatch/.test(t)) && n < 10) {
    n++;
    console.log(`[${m.type()}]`, t.slice(0, 1200));
    // React attaches the server/client node diff as subsequent args
    const args = m.args?.() ?? [];
    for (const a of args.slice(1, 4)) {
      try { console.log("   ARG:", JSON.stringify(await a.jsonValue()).slice(0, 900)); } catch {}
    }
    console.log("---");
  }
});
await page.goto("http://localhost:3000/", { waitUntil: "commit" });
await page.waitForTimeout(6000);
await browser.close();
