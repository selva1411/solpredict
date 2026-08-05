import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { marketsCache, trades, users, marketComments } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { ok, serverError } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';
import { requireAdmin } from '@/lib/admin-guard';

export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  if (!db) {
    return ok({
      ok: true,
      stats: {
        markets: { total: 0, open: 0, resolved: 0, totalVolume: 0, totalLiquidity: 0 },
        trades: { total: 0, volume24h: 0 },
        users: { total: 0 },
        comments: { total: 0 },
      },
      recent: { markets: [], trades: [], topTraders: [] },
      charts: { dailyVolume: [], categoryBreakdown: [] },
    });
  }

  try {
    const [
      marketStats,
      tradeStats,
      userStats,
      commentStats,
      recentMarkets,
      recentTrades,
      topTraders,
    ] = await Promise.all([
      db.select({
        total: sql<number>`COUNT(*)::int`,
        open: sql<number>`COUNT(*) FILTER (WHERE status = 'open')::int`,
        resolved: sql<number>`COUNT(*) FILTER (WHERE status = 'settled')::int`,
        totalLiquidity: sql<number>`COALESCE(SUM(CAST(yes_pool_sol AS NUMERIC) + CAST(no_pool_sol AS NUMERIC)), 0)`,
      }).from(marketsCache),

      db.select({
        total: sql<number>`COUNT(*)::int`,
        volume24h: sql<number>`COALESCE(SUM(ABS(lamports_in)) FILTER (WHERE block_time > NOW() - INTERVAL '24 hours'), 0) / 1e9`,
        totalVolume: sql<number>`COALESCE(SUM(ABS(lamports_in)), 0) / 1e9`,
      }).from(trades),

      db.select({ total: sql<number>`COUNT(*)::int` }).from(users),
      db.select({ total: sql<number>`COUNT(*)::int` }).from(marketComments),

      // Recent 5 markets
      db.select({
        marketPubkey: marketsCache.marketPubkey,
        question: marketsCache.question,
        category: marketsCache.category,
        status: marketsCache.status,
        yesPoolSol: marketsCache.yesPoolSol,
        noPoolSol: marketsCache.noPoolSol,
        createdAt: marketsCache.createdAt,
      }).from(marketsCache)
        .orderBy(sql`created_at DESC`)
        .limit(5),

      // Recent 10 trades
      db.select({
        id: trades.id,
        signature: trades.signature,
        marketPubkey: trades.marketPubkey,
        trader: trades.trader,
        side: trades.side,
        lamportsIn: trades.lamportsIn,
        blockTime: trades.blockTime,
      }).from(trades)
        .orderBy(sql`block_time DESC`)
        .limit(10),

      // Top 10 traders by volume
      db.select({
        wallet: users.wallet,
        username: users.username,
        volume: users.totalWagered,
        pnl: users.totalProfit,
        winRate: users.winRate,
      }).from(users)
        .orderBy(sql`CAST(total_wagered AS NUMERIC) DESC`)
        .limit(10),
    ]);

    // Daily volume for last 30 days
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

    // Category breakdown
    const categoryBreakdown = await db.select({
      category: marketsCache.category,
      count: sql<number>`COUNT(*)::int`,
      volume: sql<number>`COALESCE(SUM(CAST(yes_pool_sol AS NUMERIC) + CAST(no_pool_sol AS NUMERIC)), 0)`,
    }).from(marketsCache)
      .groupBy(marketsCache.category);

    return ok({
      ok: true,
      stats: {
        markets: {
          total: marketStats[0]?.total || 0,
          open: marketStats[0]?.open || 0,
          resolved: marketStats[0]?.resolved || 0,
          totalVolume: Number(tradeStats[0]?.totalVolume || 0),
          totalLiquidity: Number(marketStats[0]?.totalLiquidity || 0),
        },
        trades: {
          total: tradeStats[0]?.total || 0,
          volume24h: Number(tradeStats[0]?.volume24h || 0),
        },
        users: { total: userStats[0]?.total || 0 },
        comments: { total: commentStats[0]?.total || 0 },
      },
      recent: {
        markets: recentMarkets,
        trades: recentTrades,
        topTraders,
      },
      charts: {
        dailyVolume,
        categoryBreakdown,
      },
    });
  } catch (err) {
    return serverError(err);
  }
});
