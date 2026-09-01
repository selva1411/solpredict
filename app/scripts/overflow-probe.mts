import { chromium } from "@playwright/test";

const browser = await chromium.launch({ args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 768, height: 900 } });
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const offenders = await page.evaluate(() => {
  const vw = window.innerWidth;
  const out: Array<{ tag: string; cls: string; right: number }> = [];
  for (const el of Array.from(document.querySelectorAll("*"))) {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 && r.right < vw + 60) {
      out.push({ tag: el.tagName, cls: String(el.className).slice(0, 90), right: Math.round(r.right) });
    }
  }
  return { vw, sw: document.documentElement.scrollWidth, out: out.sort((a, b) => b.right - a.right).slice(0, 12) };
});
console.log(JSON.stringify(offenders, null, 1));
await browser.close();
