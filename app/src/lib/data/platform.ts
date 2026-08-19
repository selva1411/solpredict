import { cache } from 'react';
import { db } from '@/lib/db/client';
import { marketsCache, userStats, trades, users } from '@/lib/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

export interface PlatformStats {
  totalVolume: number;
  totalLiquidity: number;
  volume24h: number;
  totalTraders: number;
  openMarkets: number;
  settledMarkets: number;
  totalMarkets: number;
}

// Short-lived in-memory cache: getPlatformStats is a global aggregate that is
// recomputed on EVERY /api/markets/cached and /api/markets/stats call, and a
// single home-page load triggers it multiple times (useMarkets + usePlatformStats
// + MarketDataContext). On a remote Neon DB each aggregate scan costs hundreds
// of ms, so cache for 5s. Trades/positions writes call revalidateTag, but the
// 5s staleness is imperceptible for a stats banner.
let platformStatsCache: { at: number; stats: PlatformStats } | null = null;
const PLATFORM_STATS_TTL = 5_000;

async function loadPlatformStats(): Promise<PlatformStats> {
  if (!db) {
    return {
      totalVolume: 0,
      totalLiquidity: 0,
      volume24h: 0,
      totalTraders: 0,
      openMarkets: 0,
      settledMarkets: 0,
      totalMarkets: 0,
    };
  }

  const [marketAgg, tradeAgg, traderAgg] = await Promise.all([
    db.select({
      // Liquidity is the sum of REAL pool reserves (lamports), not volume.
      totalLiquidity: sql<string>`COALESCE(SUM(CAST(${marketsCache.yesPoolLamports} AS NUMERIC) + CAST(${marketsCache.noPoolLamports} AS NUMERIC)), 0) / 1e9`,
      openMarkets: sql<number>`COUNT(*) FILTER (WHERE ${marketsCache.status} = 'open')::int`,
      settledMarkets: sql<number>`COUNT(*) FILTER (WHERE ${marketsCache.status} = 'settled')::int`,
      totalMarkets: sql<number>`COUNT(*)::int`,
    }).from(marketsCache),
    db.select({
      totalVolume: sql<string>`COALESCE(SUM(ABS(${trades.lamportsIn})), 0) / 1e9`,
      volume24h: sql<string>`COALESCE(SUM(ABS(${trades.lamportsIn})) FILTER (WHERE ${trades.blockTime} > NOW() - INTERVAL '24 hours'), 0) / 1e9`,
    }).from(trades),
    db.select({
      count: sql<number>`COUNT(DISTINCT ${trades.trader})::int`,
    }).from(trades),
  ]);

  return {
    totalVolume: Number(tradeAgg[0]?.totalVolume ?? 0),
    totalLiquidity: Number(marketAgg[0]?.totalLiquidity ?? 0),
    volume24h: Number(tradeAgg[0]?.volume24h ?? 0),
    totalTraders: traderAgg[0]?.count ?? 0,
    openMarkets: marketAgg[0]?.openMarkets ?? 0,
    settledMarkets: marketAgg[0]?.settledMarkets ?? 0,
    totalMarkets: marketAgg[0]?.totalMarkets ?? 0,
  };
}

/**
 * Request-scoped platform stats.
 *
 * A single Next.js page load renders the tree in MULTIPLE passes (streaming
 * shell + RSC payload). The 5s module TTL cache below can be invalidated by a
 * concurrent trade sync between those passes, so one pass would render a
 * different number than the payload — producing a React hydration mismatch
 * ("server rendered text didn't match the client") on the stat tiles.
 *
 * React's `cache()` memoizes the result for the duration of the request, so
 * every pass of the same request sees the same snapshot while the module TTL
 * still dedupes across requests.
 *
 * NOTE: `cache()` only memoizes inside a React request scope. Do NOT call
 * getPlatformStats from background jobs (cron/indexer/ws) — those run outside
 * any request and would pin a stale snapshot. Use invalidatePlatformStats or a
 * direct DB query there instead.
 */
export const getPlatformStats = cache(async function getPlatformStats(): Promise<PlatformStats> {
  const now = Date.now();
  if (platformStatsCache && now - platformStatsCache.at < PLATFORM_STATS_TTL) {
    return platformStatsCache.stats;
  }
  const stats = await loadPlatformStats();
  platformStatsCache = { at: now, stats };
  return stats;
});

/** Invalidate the cached stats (called by trade/settle sync paths). */
export function invalidatePlatformStats(): void {
  platformStatsCache = null;
}

/**
 * Request-scoped leaderboard.
 *
 * Same multi-pass guarantee as getPlatformStats above: a single page load
 * renders the tree in MULTIPLE passes (streaming shell + RSC payload). If a
 * concurrent trade sync updates user_stats between those passes, the shell
 * HTML and the client-seeded payload would render a DIFFERENT top-traders
 * order — producing a React hydration mismatch on /discover ("server rendered
 * text didn't match the client"). React `cache()` memoizes for the duration
 * of the request so every pass sees one consistent snapshot.
 *
 * NOTE: request-scope only. Do NOT call from background jobs (cron/indexer/
 * ws) — outside a request scope it pins a stale snapshot. Same rule as
 * getPlatformStats.
 */
export const getLeaderboard = cache(async function getLeaderboard(
  sortBy: 'volume' | 'profit' | 'winRate' = 'volume',
  period: 'daily' | 'weekly' | 'monthly' | 'all' = 'all',
  category?: string,
  limit = 50,
) {
  if (!db) return [];

  // Select strictly from user_stats ordered by sort column with user identity join
  let orderExpr;
  switch (sortBy) {
    case 'profit':
      orderExpr = desc(sql`CAST(${userStats.realizedPnl} AS NUMERIC)`);
      break;
    case 'winRate':
      orderExpr = desc(userStats.winRateBps);
      break;
    case 'volume':
    default:
      orderExpr = desc(sql`CAST(${userStats.totalVolume} AS NUMERIC)`);
      break;
  }

  const rows = await db
    .select({
      wallet: userStats.wallet,
      totalVolume: userStats.totalVolume,
      tradeCount: userStats.tradeCount,
      marketsTraded: userStats.marketsTraded,
      marketsResolved: userStats.marketsResolved,
      wins: userStats.wins,
      losses: userStats.losses,
      winRateBps: userStats.winRateBps,
      realizedPnl: userStats.realizedPnl,
      unrealizedPnl: userStats.unrealizedPnl,
      roiBps: userStats.roiBps,
      rank: userStats.rank,
      username: users.username,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
    })
    .from(userStats)
    .leftJoin(users, eq(users.wallet, userStats.wallet))
    .orderBy(orderExpr)
    .limit(limit);

  return rows.map((r, i) => {
    const wallet = r.wallet;
    const wins = r.wins ?? 0;
    const losses = r.losses ?? 0;
    const settled = r.marketsResolved ?? (wins + losses);
    const winRate = settled > 0 ? (wins / settled) * 100 : null;
    const realized = Number(r.realizedPnl ?? 0);
    const unrealized = Number(r.unrealizedPnl ?? 0);

    return {
      rank: i + 1,
      wallet,
      username: r.username || `${wallet.slice(0, 4)}...${wallet.slice(-4)}`,
      avatarUrl: r.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${wallet}`,
      bio: r.bio || '',
      totalWagered: Number(r.totalVolume ?? 0),
      totalProfit: realized + unrealized,
      realizedPnl: realized,
      unrealizedPnl: unrealized,
      winRate,
      winRateBps: r.winRateBps,
      marketsTraded: r.marketsTraded ?? 0,
      tradeCount: r.tradeCount ?? 0,
      wins,
      losses,
    };
  });
});
