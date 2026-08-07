export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { marketsCache, trades, users, marketComments, userStats } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { ok, serviceUnavailable } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/admin-guard";

export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  if (!db) {
    return serviceUnavailable('Database not available');
  }

  const [marketStats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      open: sql<number>`COUNT(*) FILTER (WHERE status = 'open')::int`,
      settled: sql<number>`COUNT(*) FILTER (WHERE status = 'settled')::int`,
      totalLiquidity: sql<number>`COALESCE(SUM(CAST(total_volume AS NUMERIC)), 0)`,
    })
    .from(marketsCache);

  const [tradeStats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      totalVolume: sql<number>`COALESCE(SUM(ABS(lamports_in)), 0) / 1e9`,
    })
    .from(trades);

  const [userAgg] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      avgWinRate: sql<number>`COALESCE(AVG(win_rate_bps), 0) / 100`,
    })
    .from(userStats);

  const [commentStats] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
    })
    .from(marketComments);

  const dailyVolumeResult = await db.execute(sql`
    SELECT to_char(DATE(block_time), 'YYYY-MM-DD') as date,
           COALESCE(SUM(ABS(lamports_in)), 0) / 1e9 as volume
    FROM trades
    WHERE block_time > NOW() - INTERVAL '30 days'
    GROUP BY DATE(block_time)
    ORDER BY date ASC
  `);

  const dailyVolume = (dailyVolumeResult.rows as Record<string, unknown>[]).map(r => ({
    date: String(r.date),
    volume: Number(r.volume || 0),
  }));

  const categoryBreakdown = await db.select({
    category: marketsCache.category,
    count: sql<number>`COUNT(*)::int`,
    volume: sql<number>`COALESCE(SUM(CAST(${marketsCache.totalVolume} AS NUMERIC)), 0)`,
  }).from(marketsCache).groupBy(marketsCache.category);

  return ok({
    ok: true,
    stats: {
      totalMarkets: marketStats?.total || 0,
      openMarkets: marketStats?.open || 0,
      settledMarkets: marketStats?.settled || 0,
      totalTrades: tradeStats?.total || 0,
      totalUsers: userAgg?.total || 0,
      totalVolume: Number(tradeStats?.totalVolume || 0),
      totalLiquidity: Number(marketStats?.totalLiquidity || 0),
      avgWinRate: Number(userAgg?.avgWinRate || 0),
      totalComments: commentStats?.total || 0,
      dailyVolume,
      categoryBreakdown,
    },
  });
});
