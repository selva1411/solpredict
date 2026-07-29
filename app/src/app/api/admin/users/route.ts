import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { trades } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async () => {
  if (!db) return ok({ ok: true, users: [] });

  const rows = await db
    .select()
    .from(users)
    .orderBy(desc(users.totalWagered))
    .limit(100);

  return ok({
    ok: true,
    users: rows.map(u => ({
      wallet: u.wallet,
      username: u.username,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      twitterHandle: u.twitterHandle,
      totalWagered: Number(u.totalWagered || 0),
      totalProfit: Number(u.totalProfit || 0),
      totalWon: Number(u.totalWon || 0),
      marketsTraded: u.marketsTraded || 0,
      winRate: Number(u.winRate || 0),
      pasScore: u.pasScore || 50,
      lastActive: u.lastActive,
      createdAt: u.createdAt,
    })),
  });
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  if (!db) return badRequest("Database not available");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const { wallet, username, twitterHandle } = body;
  if (!wallet) return badRequest("wallet is required");

  await db
    .update(users)
    .set({
      ...(username !== undefined && { username }),
      ...(twitterHandle !== undefined && { twitterHandle }),
      lastActive: new Date(),
    })
    .where(eq(users.wallet, wallet));

  return ok({ ok: true, wallet });
});

export const DELETE = apiHandler(async (req: NextRequest) => {
  if (!db) return badRequest("Database not available");

  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet");
  if (!wallet) return badRequest("wallet query param required");

  await db.delete(users).where(eq(users.wallet, wallet));
  return ok({ ok: true, wallet });
});
