import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { trades, users, priceHistory, marketsCache, notifications } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { serverError, ok, badRequest } from "@/lib/api-response";
import { apiHandler, requireServiceKey } from "@/lib/api-handler";
import { toError } from "@/lib/errors";
import { syncTradeSchema } from "@/lib/schemas";
import { logAudit } from "@/lib/audit";

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");
  const parsed = syncTradeSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));
  }

  const { marketPubkey, trader, side, lamportsIn, tokensOut, signature, pricePerToken, yesPoolSol, noPoolSol, yesPct } = parsed.data;

  const solAmount = lamportsIn / 1e9;
  const price = pricePerToken ?? (solAmount > 0 && tokensOut > 0 ? solAmount / tokensOut : 0);

  if (db && signature) {
    await db.insert(trades).values({
      signature,
      marketPubkey,
      trader,
      side,
      lamportsIn,
      tokensOut,
      pricePerToken: price.toString(),
      blockTime: new Date(),
      slot: 0,
    }).onConflictDoNothing();

    await db.insert(users).values({
      wallet: trader,
      username: `${trader.slice(0, 4)}...${trader.slice(-4)}`,
      avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${trader}`,
      totalWagered: Math.abs(solAmount).toString(),
      totalWon: "0",
      totalProfit: "0",
      marketsTraded: 1,
      winRate: "50.00",
      pasScore: 75,
      lastActive: new Date(),
    }).onConflictDoUpdate({
      target: users.wallet,
      set: {
        totalWagered: sql`${users.totalWagered} + ${Math.abs(solAmount)}`,
        marketsTraded: sql`${users.marketsTraded} + 1`,
        lastActive: new Date(),
      },
    });

    if (yesPct !== undefined) {
      await db.insert(priceHistory).values({
        marketPubkey,
        timestamp: new Date(),
        yesPct: String(yesPct),
        yesPoolSol: String(yesPoolSol ?? 0),
        noPoolSol: String(noPoolSol ?? 0),
        totalVolume: String((yesPoolSol ?? 0) + (noPoolSol ?? 0)),
      });
    }

    if (yesPoolSol !== undefined && noPoolSol !== undefined) {
      await db.update(marketsCache).set({
        yesPoolSol: String(yesPoolSol),
        noPoolSol: String(noPoolSol),
        updatedAt: new Date(),
      }).where(eq(marketsCache.marketPubkey, marketPubkey));
    }

    await db.insert(notifications).values({
      wallet: trader,
      type: "trade",
      marketPubkey,
      message: `${side === "YES" ? "Bought" : "Sold"} ${side} shares for ${solAmount.toFixed(4)} SOL`,
      read: false,
    }).onConflictDoNothing();
  }

  logAudit({
    action: "sync:trade",
    actor: trader,
    resource: `trade:${signature ?? "unknown"}`,
    details: { marketPubkey, side, solAmount },
    ip: req.headers.get("x-forwarded-for") ?? "unknown",
  });

  return ok({ ok: true, signature: signature ?? null });
});
