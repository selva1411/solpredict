import { db } from './client';
import { users, trades } from './schema';
import { desc, sql, eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function getLeaderboardFromDb(limit = 50, sortBy: 'volume' | 'profit' | 'winRate' = 'volume') {
  if (!db) return [];

  try {
    let orderBy;
    switch (sortBy) {
      case 'profit':
        orderBy = desc(sql`CAST(${users.totalProfit} AS NUMERIC)`);
        break;
      case 'winRate':
        orderBy = desc(sql`CAST(${users.winRate} AS NUMERIC)`);
        break;
      case 'volume':
      default:
        orderBy = desc(sql`CAST(${users.totalWagered} AS NUMERIC)`);
    }

    const rows = await db.select().from(users).orderBy(orderBy).limit(limit);

    if (rows.length > 0) {
      return rows.map((u, i) => ({
        rank: i + 1,
        wallet: u.wallet,
        username: u.username || `${u.wallet.slice(0, 4)}...${u.wallet.slice(-4)}`,
        avatarUrl: u.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${u.wallet}`,
        bio: u.bio || '',
        totalWagered: Number(u.totalWagered || 0),
        totalProfit: Number(u.totalProfit || 0),
        winRate: Number(u.winRate || 50),
        pasScore: u.pasScore || 75,
        marketsTraded: u.marketsTraded || 0,
      }));
    }

    // Aggregate directly from trades if users table has no snapshot records yet
    const tradeAggregation = await db.select({
      trader: trades.trader,
      totalLamports: sql<number>`SUM(${trades.lamportsIn})`,
      tradeCount: sql<number>`COUNT(*)`,
    }).from(trades).groupBy(trades.trader).orderBy(sql`SUM(${trades.lamportsIn}) DESC`).limit(limit);

    return tradeAggregation.map((t, i) => {
      const volumeSol = Number(t.totalLamports || 0) / 1e9;
      return {
        rank: i + 1,
        wallet: t.trader,
        username: `${t.trader.slice(0, 4)}...${t.trader.slice(-4)}`,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${t.trader}`,
        bio: '',
        totalWagered: Number(volumeSol.toFixed(2)),
        totalProfit: 0,
        winRate: 50,
        pasScore: 75,
        marketsTraded: Number(t.tradeCount || 0),
      };
    });
  } catch (err) {
    logger.warn("getLeaderboardFromDb failed:", err);
    return [];
  }
}

export async function getUserProfileFromDb(wallet: string) {
  if (!db) return null;
  try {
    const rows = await db.select().from(users).where(eq(users.wallet, wallet)).limit(1);
    return rows[0] || null;
  } catch {
    return null;
  }
}
