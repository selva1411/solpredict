import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { marketsCache, notifications, trades } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { serverError, ok, badRequest } from "@/lib/api-response";
import { apiHandler, requireServiceKey } from "@/lib/api-handler";
import { toError } from "@/lib/errors";
import { syncMarketSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";

export const POST = apiHandler(async (req: NextRequest) => {

  const body = await req.json();
  const parsed = syncMarketSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  }

  const { marketPubkey, marketId, question, description, category, status, yesPoolSol, noPoolSol, yesSupply, noSupply, endTs, resolveTs, winningOutcome } = parsed.data;

  try {
    if (db) {
      await db.insert(marketsCache).values({
        marketPubkey,
        marketId: marketId ?? 0,
        question,
        description: description ?? "",
        category: category ?? "Crypto",
        status: status ?? "open",
        winningOutcome: winningOutcome ?? null,
        yesPoolSol: String(yesPoolSol ?? 0),
        noPoolSol: String(noPoolSol ?? 0),
        yesSupply: yesSupply ?? 0,
        noSupply: noSupply ?? 0,
        endTs: endTs ? new Date(endTs * 1000) : new Date(Date.now() + 3600000),
        resolveTs: resolveTs ? new Date(resolveTs * 1000) : new Date(Date.now() + 7200000),
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: marketsCache.marketPubkey,
        set: {
          question,
          description: description ?? "",
          status: status ?? "open",
          winningOutcome: winningOutcome ?? null,
          yesPoolSol: String(yesPoolSol ?? 0),
          noPoolSol: String(noPoolSol ?? 0),
          yesSupply: yesSupply ?? 0,
          noSupply: noSupply ?? 0,
          updatedAt: new Date(),
        },
      });

      if (status === "settled" || status === "canceled") {
        const traders = await db.select({ wallet: trades.trader })
          .from(trades)
          .where(eq(trades.marketPubkey, marketPubkey)).catch(() => []);
        const uniqueTraders = [...new Set(traders.map(t => t.wallet))];
        for (const wallet of uniqueTraders) {
          await db.insert(notifications).values({
            wallet,
            type: status === "settled" ? "settlement" : "expiry",
            marketPubkey,
            message: status === "settled"
              ? `Market "${question}" settled. ${winningOutcome === "yes" ? "YES" : "NO"} won.`
              : `Market "${question}" was canceled. Refunds available.`,
            read: false,
          }).onConflictDoNothing().catch(() => null);
        }
      }
    }
  } catch (e) {
    console.warn("DB market sync warning:", e);
  }

  logAudit({
    action: "sync:market",
    actor: "service",
    resource: `market:${marketPubkey}`,
    details: { question, status },
    ip: req.headers.get("x-forwarded-for") ?? "unknown",
  });

  return ok({ ok: true, marketPubkey });
});
