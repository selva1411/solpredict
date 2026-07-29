import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { marketsCache, trades, users } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';
import { ok, serverError } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';

export const GET = apiHandler(async (_req: NextRequest) => {
  if (!db) return serverError('Database not configured');

  const [marketStats] = await db.select({
    totalMarkets: sql<number>`COUNT(*)::int`,
    openMarkets: sql<number>`COUNT(*) FILTER (WHERE status = 'open')::int`,
    settledMarkets: sql<number>`COUNT(*) FILTER (WHERE status = 'settled')::int`,
    cancelledMarkets: sql<number>`COUNT(*) FILTER (WHERE status = 'cancelled')::int`,
    totalVolume: sql<string>`COALESCE(SUM(CAST(yes_pool_sol AS NUMERIC) + CAST(no_pool_sol AS NUMERIC)), 0)::text`,
    totalLiquidity: sql<string>`COALESCE(SUM(CAST(yes_pool_sol AS NUMERIC) + CAST(no_pool_sol AS NUMERIC)), 0)::text`,
  }).from(marketsCache);

  const [tradeStats] = await db.select({
    totalTrades: sql<number>`COUNT(*)::int`,
    volume24h: sql<string>`COALESCE(SUM(CASE WHEN block_time > NOW() - INTERVAL '24 hours' THEN lamports_in ELSE 0 END) / 1e9, 0)::text`,
    trades24h: sql<number>`COUNT(*) FILTER (WHERE block_time > NOW() - INTERVAL '24 hours')::int`,
  }).from(trades);

  const [userStats] = await db.select({
    totalTraders: sql<number>`COUNT(*)::int`,
    activeTraders24h: sql<number>`COUNT(*) FILTER (WHERE last_active > NOW() - INTERVAL '24 hours')::int`,
  }).from(users);

  return ok({
    ok: true,
    stats: {
      totalMarkets: marketStats?.totalMarkets || 0,
      openMarkets: marketStats?.openMarkets || 0,
      settledMarkets: marketStats?.settledMarkets || 0,
      cancelledMarkets: marketStats?.cancelledMarkets || 0,
      totalVolume: marketStats?.totalVolume || '0',
      totalLiquidity: marketStats?.totalLiquidity || '0',
      totalTrades: tradeStats?.totalTrades || 0,
      volume24h: tradeStats?.volume24h || '0',
      trades24h: tradeStats?.trades24h || 0,
      totalTraders: userStats?.totalTraders || 0,
      activeTraders24h: userStats?.activeTraders24h || 0,
    },
  });
}, { cacheMaxAge: 10, cacheTags: ['platform-stats'] });
