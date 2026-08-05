import { db } from './client';
import { users, trades } from './schema';
import { desc, sql, eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function getLeaderboardFromDb(
  limit = 50,
  sortBy: 'volume' | 'profit' | 'winRate' = 'volume',
  period?: 'daily' | 'weekly' | 'monthly' | 'all'
) {
  if (!db) return [];

  try {
    // If period filtering needed, use trade data with time window
    if (period && period !== 'all') {
      const interval = period === 'daily' ? '24 hours' : period === 'weekly' ? '7 days' : '30 days';
      const tradeAgg = await db.execute(sql`
        SELECT
          t.trader,
          COALESCE(SUM(ABS(t.lamports_in)), 0) / 1e9 as total_volume,
          COALESCE(MAX(CAST(u.total_profit AS NUMERIC)), 0) as total_profit,
          COUNT(*) as trade_count,
          COUNT(DISTINCT t.market_pubkey) as markets_count,
          u.username,
          u.avatar_url,
          u.bio,
          u.win_rate,
          u.pas_score
        FROM trades t
        LEFT JOIN users u ON u.wallet = t.trader
        WHERE t.block_time > NOW() - INTERVAL ${sql.raw(`'${interval}'`)}
        GROUP BY t.trader, u.username, u.avatar_url, u.bio, u.win_rate, u.pas_score
        ORDER BY total_volume DESC
        LIMIT ${limit}
      `);

      return (tradeAgg.rows as Record<string, unknown>[]).map((row, i) => {
        const wallet = String(row.trader ?? '');
        return {
          rank: i + 1,
          wallet,
          username: String(row.username || `${wallet.slice(0, 4)}...${wallet.slice(-4)}`),
          avatarUrl: String(row.avatar_url || `https://api.dicebear.com/7.x/identicon/svg?seed=${wallet}`),
          bio: String(row.bio || ''),
          totalWagered: Number(row.total_volume ?? 0),
          totalProfit: Number(row.total_profit ?? 0),
          winRate: Number(row.win_rate ?? 0),
          pasScore: Number(row.pas_score ?? 0),
          marketsTraded: Number(row.markets_count ?? 0),
        };
      });
    }

    // All-time: use users table
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
        winRate: Number(u.winRate || 0),
        pasScore: u.pasScore || 0,
        marketsTraded: u.marketsTraded || 0,
      }));
    }

    // Fallback: aggregate directly from trades if users table is empty
    const tradeAggregation = await db.select({
      trader: trades.trader,
      totalLamports: sql<number>`SUM(ABS(${trades.lamportsIn}))`,
      tradeCount: sql<number>`COUNT(*)`,
      marketsCount: sql<number>`COUNT(DISTINCT ${trades.marketPubkey})`,
    }).from(trades).groupBy(trades.trader).orderBy(sql`SUM(ABS(${trades.lamportsIn})) DESC`).limit(limit);

    return tradeAggregation.map((t, i) => {
      const volumeSol = Number(t.totalLamports || 0) / 1e9;
      return {
        rank: i + 1,
        wallet: t.trader,
        username: `${t.trader.slice(0, 4)}...${t.trader.slice(-4)}`,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${t.trader}`,
        bio: '',
        totalWagered: Number(volumeSol.toFixed(4)),
        totalProfit: 0,
        winRate: 0,
        pasScore: 0,
        marketsTraded: Number(t.marketsCount || 0),
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
    if (rows.length === 0) return null;
    const u = rows[0];
    return {
      wallet: u.wallet,
      username: u.username || `${u.wallet.slice(0, 4)}...${u.wallet.slice(-4)}`,
      avatarUrl: u.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${u.wallet}`,
      bio: u.bio || '',
      twitterHandle: u.twitterHandle || '',
      totalWagered: Number(u.totalWagered || 0),
      totalWon: Number(u.totalWon || 0),
      totalProfit: Number(u.totalProfit || 0),
      marketsTraded: u.marketsTraded || 0,
      winRate: Number(u.winRate || 0),
      pasScore: u.pasScore || 0,
      createdAt: u.createdAt,
      lastActive: u.lastActive,
    };
  } catch {
    return null;
  }
}

export async function updateUserProfile(wallet: string, data: Partial<{
  username: string;
  avatarUrl: string;
  bio: string;
  twitterHandle: string;
}>) {
  if (!db) return false;
  try {
    const existing = await db.select().from(users).where(eq(users.wallet, wallet)).limit(1);
    if (existing.length === 0) {
      await db.insert(users).values({ wallet, ...data, lastActive: new Date() });
    } else {
      await db.update(users).set({ ...data, lastActive: new Date() }).where(eq(users.wallet, wallet));
    }
    return true;
  } catch {
    return false;
  }
}

export async function getAllUsersFromDb(limit = 100, offset = 0) {
  if (!db) return { users: [], total: 0 };
  try {
    const rows = await db.select().from(users).orderBy(desc(users.lastActive)).limit(limit).offset(offset);
    const [countRes] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(users);
    return {
      users: rows.map(u => ({
        wallet: u.wallet,
        username: u.username || `${u.wallet.slice(0, 4)}...${u.wallet.slice(-4)}`,
        avatarUrl: u.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${u.wallet}`,
        totalWagered: Number(u.totalWagered || 0),
        totalProfit: Number(u.totalProfit || 0),
        marketsTraded: u.marketsTraded || 0,
        winRate: Number(u.winRate || 0),
        lastActive: u.lastActive,
        createdAt: u.createdAt,
      })),
      total: countRes?.count || 0,
    };
  } catch {
    return { users: [], total: 0 };
  }
}
