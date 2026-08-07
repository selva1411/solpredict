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

export async function getPlatformStats(): Promise<PlatformStats> {
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
      totalLiquidity: sql<string>`COALESCE(SUM(CAST(${marketsCache.totalVolume} AS NUMERIC)), 0)`,
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

export async function getLeaderboard(
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

    return {
      rank: i + 1,
      wallet,
      username: r.username || `${wallet.slice(0, 4)}...${wallet.slice(-4)}`,
      avatarUrl: r.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${wallet}`,
      bio: r.bio || '',
      totalWagered: Number(r.totalVolume ?? 0),
      totalProfit: Number(r.realizedPnl ?? 0),
      winRate,
      winRateBps: r.winRateBps,
      marketsTraded: r.marketsTraded ?? 0,
      tradeCount: r.tradeCount ?? 0,
      wins,
      losses,
    };
  });
}
