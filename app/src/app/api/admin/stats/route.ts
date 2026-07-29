import { db } from "@/lib/db/client";
import { marketsCache, trades, users, marketComments } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async () => {
  if (!db) {
    return ok({
      ok: true,
      stats: {
        totalMarkets: 0,
        openMarkets: 0,
        settledMarkets: 0,
        totalTrades: 0,
        totalUsers: 0,
        totalVolume: 0,
        totalComments: 0,
        avgWinRate: 0,
      },
    });
  }

  const [marketStats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      open: sql<number>`COUNT(*) FILTER (WHERE status = 'open')::int`,
      settled: sql<number>`COUNT(*) FILTER (WHERE status = 'settled')::int`,
      totalVolume: sql<number>`COALESCE(SUM(CAST(yes_pool_sol AS NUMERIC) + CAST(no_pool_sol AS NUMERIC)), 0)`,
    })
    .from(marketsCache);

  const [tradeStats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
    })
    .from(trades);

  const [userStats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      avgWinRate: sql<number>`COALESCE(AVG(CAST(win_rate AS NUMERIC)), 0)`,
    })
    .from(users);

  const [commentStats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
    })
    .from(marketComments);

  return ok({
    ok: true,
    stats: {
      totalMarkets: marketStats?.total || 0,
      openMarkets: marketStats?.open || 0,
      settledMarkets: marketStats?.settled || 0,
      totalTrades: tradeStats?.total || 0,
      totalUsers: userStats?.total || 0,
      totalVolume: Number(marketStats?.totalVolume || 0),
      totalComments: commentStats?.total || 0,
      avgWinRate: Number(userStats?.avgWinRate || 0),
    },
  });
});
