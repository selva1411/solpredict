import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/lib/db/schema";
import { eq, and } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.log("[PriceAlert] No DATABASE_URL — skipping");
  process.exit(0);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });
const POLL_MS = 30_000;

async function checkAlerts() {
  try {
    const alerts = await db
      .select()
      .from(schema.priceAlerts)
      .where(and(eq(schema.priceAlerts.active, true), eq(schema.priceAlerts.triggered, false)));

    if (alerts.length === 0) return;

    const marketPubkeys = [...new Set(alerts.map(a => a.marketPubkey))];

    for (const pubkey of marketPubkeys) {
      const res = await fetch(`http://127.0.0.1:${process.env.NEXT_PORT || "3000"}/api/markets/cached`);
      if (!res.ok) continue;
      const body = await res.json();
      const market = (body.markets || []).find((m: { marketPubkey: string }) => m.marketPubkey === pubkey);
      if (!market) continue;

      const yesPoolSol = parseFloat(market.yesPoolSol || "0");
      const noPoolSol = parseFloat(market.noPoolSol || "0");
      const totalPool = yesPoolSol + noPoolSol;
      const currentPrice = totalPool > 0 ? yesPoolSol / totalPool : 0.5;

      const marketAlerts = alerts.filter(a => a.marketPubkey === pubkey);
      for (const alert of marketAlerts) {
        const target = parseFloat(alert.targetPrice);
        const above = alert.comparison === "above";
        const triggered = above ? currentPrice >= target : currentPrice <= target;

        if (triggered) {
          await db.update(schema.priceAlerts)
            .set({ triggered: true, triggeredAt: new Date() })
            .where(eq(schema.priceAlerts.id, alert.id));

          await db.insert(schema.notifications).values({
            wallet: alert.wallet,
            type: "settlement",
            marketPubkey: pubkey,
            message: `Price alert triggered: ${market.question} reached ${(currentPrice * 100).toFixed(1)}% (target: ${above ? "above" : "below"} ${(target * 100).toFixed(1)}%)`,
            read: false,
          }).onConflictDoNothing();
        }
      }
    }
  } catch { /* not critical */ }
}

console.log(`[PriceAlert] Checker started (poll every ${POLL_MS / 1000}s)`);
checkAlerts();
setInterval(checkAlerts, POLL_MS);
