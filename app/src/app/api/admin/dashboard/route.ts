export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { marketsCache, trades, users, marketComments, userStats } from '@/lib/db/schema';
import { sql, eq, desc } from 'drizzle-orm';
import { ok, serverError, serviceUnavailable } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';
import { requireAdmin } from '@/lib/admin-guard';

export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  if (!db) {
    return serviceUnavailable('Database not available');
  }

  try {
    const [
      marketStats,
      tradeStats,
      userCount,
      commentStats,
      recentMarkets,
      recentTrades,
      topTraders,
    ] = await Promise.all([
      db.select({
        total: sql<number>`COUNT(*)::int`,
        open: sql<number>`COUNT(*) FILTER (WHERE status = 'open')::int`,
        resolved: sql<number>`COUNT(*) FILTER (WHERE status = 'settled')::int`,
        totalLiquidity: sql<number>`COALESCE(SUM(CAST(total_volume AS NUMERIC)), 0)`,
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
        totalVolume: marketsCache.totalVolume,
        createdAt: marketsCache.createdAt,
      }).from(marketsCache)
        .orderBy(desc(marketsCache.createdAt))
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
        .orderBy(desc(trades.blockTime))
        .limit(10),

      // Top 10 traders by volume from user_stats
      db.select({
        wallet: userStats.wallet,
        username: users.username,
        volume: userStats.totalVolume,
        pnl: userStats.realizedPnl,
        winRateBps: userStats.winRateBps,
      }).from(userStats)
        .leftJoin(users, eq(users.wallet, userStats.wallet))
        .orderBy(desc(sql`CAST(user_stats.total_volume AS NUMERIC)`))
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
    }).from(marketsCache)
      .groupBy(marketsCache.category);

    return ok({
      ok: true,
      stats: {
        markets: {
          total: marketStats[0]?.total ?? 0,
          open: marketStats[0]?.open ?? 0,
          resolved: marketStats[0]?.resolved ?? 0,
          totalLiquidity: Number(marketStats[0]?.totalLiquidity ?? 0),
        },
        trades: {
          total: tradeStats[0]?.total ?? 0,
          volume24h: Number(tradeStats[0]?.volume24h ?? 0),
          totalVolume: Number(tradeStats[0]?.totalVolume ?? 0),
        },
        users: {
          total: userCount[0]?.total ?? 0,
        },
        comments: {
          total: commentStats[0]?.total ?? 0,
        },
        recentMarkets: recentMarkets.map(m => ({
          ...m,
          totalVolume: Number(m.totalVolume ?? 0),
        })),
        recentTrades,
        topTraders: topTraders.map(t => ({
          wallet: t.wallet,
          username: t.username,
          volume: Number(t.volume ?? 0),
          pnl: Number(t.pnl ?? 0),
          winRate: t.winRateBps != null ? t.winRateBps / 100 : null,
        })),
        dailyVolume,
        categoryBreakdown,
      },
    });
  } catch (err) {
    return serverError(err);
  }
});
