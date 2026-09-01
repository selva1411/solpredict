import fs from "node:fs";
import { chromium } from "@playwright/test";

const libs = `${process.env.HOME}/.browser-libs/usr/lib/x86_64-linux-gnu`;
const browser = await chromium.launch({
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
page.on("console", (m) => {
  const t = m.text();
  if (/hydrat|mismatch|did not match|<TA>|diff/i.test(t)) {
    console.log("CONSOLE:", t.slice(0, 2500));
    console.log("---");
  }
});
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 600)));
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
await browser.close();
if (!fs.existsSync("/tmp")) console.log("(fs ok)");
