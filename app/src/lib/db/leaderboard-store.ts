import { db } from './client';
import { users, leaderboardSnapshots } from './schema';
import { desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface LeaderboardUser {
  wallet: string;
  username: string | null;
  avatarUrl: string | null;
  totalWagered: string | null;
  totalProfit: string | null;
  winRate: string | null;
  pasScore: number | null;
  marketsTraded: number | null;
  lastActive: Date | null;
}

export async function getLeaderboardData(): Promise<LeaderboardUser[]> {
  if (db) {
    try {
      return await db.select().from(users).orderBy(desc(users.pasScore)).limit(100);
    } catch {}
  }
  return [];
}

export async function recordLeaderboardSnapshot() {
  if (!db) return;
  try {
    const topUsers = await db.select({
      wallet: users.wallet,
      pasScore: users.pasScore,
      winRate: users.winRate,
      marketsCount: users.marketsTraded,
      profitSol: users.totalProfit,
    }).from(users).orderBy(desc(users.pasScore)).limit(20);

    for (const user of topUsers) {
      await db.insert(leaderboardSnapshots).values({
        wallet: user.wallet,
        pasScore: user.pasScore,
        winRate: user.winRate,
        marketsCount: user.marketsCount ?? 0,
        profitSol: user.profitSol,
        snapshotDate: new Date().toISOString().split("T")[0],
        period: "daily",
        rank: 0,
      }).onConflictDoNothing();
    }
  } catch (err) {
    logger.warn("Failed to record leaderboard snapshot:", err);
  }
}
