import { db } from './client';
import { users, userStats } from './schema';
import { desc, sql, eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { getLeaderboard } from '@/lib/data/platform';
import { computePasScore } from '@/lib/pas';

export async function getLeaderboardFromDb(
  limit = 50,
  sortBy: 'volume' | 'profit' | 'winRate' = 'volume',
  period?: 'daily' | 'weekly' | 'monthly' | 'all',
  category?: string
) {
  try {
    const entries = await getLeaderboard(sortBy, period, category, limit);

    return entries.map(e => ({
      rank: e.rank,
      wallet: e.wallet,
      username: e.username,
      avatarUrl: e.avatarUrl,
      bio: e.bio || '',
      totalWagered: e.totalWagered,
      totalProfit: e.totalProfit,
      winRate: e.winRate ?? 0,
      pasScore: computePasScore(e.winRate),
      marketsTraded: e.marketsTraded,
    }));
  } catch (e) {
    logger.warn("getLeaderboardFromDb failed:", e);
    return [];
  }
}
