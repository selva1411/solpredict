export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { users, userStats } from "@/lib/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { ok, badRequest, serverError, serviceUnavailable } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/admin-guard";

export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  if (!db) return serviceUnavailable('Database not available');

  const rows = await db
    .select({
      wallet: users.wallet,
      username: users.username,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      twitterHandle: users.twitterHandle,
      role: users.role,
      isBanned: users.isBanned,
      createdAt: users.createdAt,
      lastActive: users.lastActive,
      totalVolume: userStats.totalVolume,
      realizedPnl: userStats.realizedPnl,
      winRateBps: userStats.winRateBps,
      marketsTraded: userStats.marketsTraded,
    })
    .from(users)
    .leftJoin(userStats, eq(userStats.wallet, users.wallet))
    .orderBy(desc(sql`CAST(COALESCE(${userStats.totalVolume}, '0') AS NUMERIC)`))
    .limit(100);

  return ok({
    ok: true,
    users: rows.map(u => ({
      wallet: u.wallet,
      username: u.username,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      twitterHandle: u.twitterHandle,
      role: u.role,
      isBanned: u.isBanned,
      totalWagered: Number(u.totalVolume || 0),
      totalProfit: Number(u.realizedPnl || 0),
      winRate: u.winRateBps != null ? u.winRateBps / 100 : 0,
      marketsTraded: u.marketsTraded || 0,
      lastActive: u.lastActive,
      createdAt: u.createdAt,
    })),
  });
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  if (!db) return badRequest("Database not available");

  const body = await req.json();
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const { wallet, username, twitterHandle, isBanned } = body;
  if (!wallet) return badRequest("wallet is required");

  const updateData: Record<string, unknown> = { lastActive: new Date() };
  if (username !== undefined) updateData.username = username;
  if (twitterHandle !== undefined) updateData.twitterHandle = twitterHandle;
  if (isBanned !== undefined) updateData.isBanned = Boolean(isBanned);

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.wallet, wallet))
    .returning();

  return ok({ ok: true, user: updated });
});
