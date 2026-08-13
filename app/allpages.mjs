import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true, chromiumSandbox: false });
const page = await browser.newPage();
const pages = ["/","/markets","/discover","/leaderboard","/dashboard","/portfolio","/watchlist","/rewards","/create","/admin","/admin/markets","/admin/users","/admin/settings","/admin/treasury","/admin/dashboard","/activity","/profile/HSQr49JyRnJAXocYCAHWtd75eAheZ9tBLudUFNMFZPBy","/gateway","/docs/getting-started"];
for (const p of pages) {
  const errors = [];
  const onErr = m => { if (m.type()==="error" && !m.text().includes("ERR_CONNECTION")) errors.push(m.text().slice(0,200)); };
  const onPageErr = e => errors.push("PAGEERROR: "+e.message.slice(0,200));
  page.on("console", onErr); page.on("pageerror", onPageErr);
  const res = await page.goto("http://localhost:3000"+p, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(e=>errors.push("NAV: "+e.message.slice(0,80)));
  await page.waitForTimeout(2500);
  const title = await page.title();
  const status = (res && res.status) ? res.status() : "ERR";
  console.log(`[${status}] ${p} title="${title}" consoleErrors=${errors.length}`);
  errors.slice(0,3).forEach(e=>console.log("     -", e));
  page.removeListener("console", onErr); page.removeListener("pageerror", onPageErr);
}
await browser.close();
