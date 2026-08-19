import { db } from '@/lib/db/client';
import { rewards, trades, userStats, marketsCache } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export async function getClaimable(wallet: string) {
  if (!db) return { claimableLamports: 0, items: [] };

  const items = await db
    .select()
    .from(rewards)
    .where(
      and(
        eq(rewards.wallet, wallet),
        eq(rewards.status, 'claimable'),
      ),
    );

  const claimableLamports = items.reduce((sum, r) => sum + (r.amount ?? 0), 0);

  return {
    claimableLamports,
    claimableSol: claimableLamports / 1e9,
    items: items.map(r => ({
      id: r.id,
      epoch: r.epoch,
      kind: r.kind,
      amountLamports: r.amount ?? 0,
      amountSol: (r.amount ?? 0) / 1e9,
      status: r.status,
    })),
  };
}

export async function getEpochHistory(wallet: string) {
  if (!db) return [];

  return db
    .select()
    .from(rewards)
    .where(eq(rewards.wallet, wallet))
    .orderBy(desc(rewards.createdAt));
}

export async function getQuestProgress(wallet: string) {
  if (!db) return [];

  // Quest progress is derived from REAL trades and userStats. Categories come
  // from markets_cache (trades has no category column — the previous query
  // referenced a nonexistent column and failed at runtime). No fabricated
  // reward amounts are returned: nothing is displayed as payable unless it
  // actually exists in the rewards table.
  const [statsRow, tradeCountRow, catCountRow] = await Promise.all([
    db?.select().from(userStats).where(eq(userStats.wallet, wallet)).limit(1),
    db?.select({ count: sql<number>`COUNT(*)::int` }).from(trades).where(eq(trades.trader, wallet)),
    db?.select({ count: sql<number>`COUNT(DISTINCT m.category)::int` })
      .from(trades)
      .innerJoin(marketsCache, eq(marketsCache.marketPubkey, trades.marketPubkey))
      .where(eq(trades.trader, wallet)),
  ]);

  const stats = statsRow?.[0];
  const tradeCount = tradeCountRow?.[0]?.count ?? 0;
  const categoriesTraded = catCountRow?.[0]?.count ?? 0;
  const totalVolume = Number(stats?.totalVolume ?? 0);

  return [
    {
      id: 'first_trade',
      title: 'First Blood',
      description: 'Execute your first trade on SolPredict',
      current: Math.min(1, tradeCount),
      target: 1,
      completed: tradeCount >= 1,
    },
    {
      id: 'volume_10',
      title: 'High Roller',
      description: 'Reach 10 SOL in total trading volume',
      current: Math.min(10, totalVolume),
      target: 10,
      completed: totalVolume >= 10,
    },
    {
      id: 'explorer',
      title: 'Category Explorer',
      description: 'Trade markets across 3 different categories',
      current: Math.min(3, categoriesTraded),
      target: 3,
      completed: categoriesTraded >= 3,
    },
  ];
}
