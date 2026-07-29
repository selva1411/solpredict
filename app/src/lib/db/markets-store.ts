import { db } from './client';
import { marketsCache } from './schema';
import { eq, desc, asc, sql, and, ilike, or } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface MarketCacheEntry {
  marketPubkey: string;
  marketId: number;
  question: string;
  description: string;
  category: string;
  status: string;
  winningOutcome?: string;
  yesPoolSol: number;
  noPoolSol: number;
  yesSupply: number;
  noSupply: number;
  endTs: Date;
  resolveTs: Date;
  thumbnailUrl?: string;
  tags?: string[];
  viewCount?: number;
  volume24h?: number;
  traders?: number;
  liquidity?: number;
}

const CATEGORY_NAMES = ["Crypto", "Sports", "Politics", "Tech", "Other"];

export async function getAllMarkets(options?: {
  status?: string;
  category?: string;
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: 'volume' | 'newest' | 'ending' | 'popular';
}) {
  if (!db) return [];

  try {
    const conditions = [];

    if (options?.status) {
      conditions.push(eq(marketsCache.status, options.status));
    }
    if (options?.category && options.category !== 'All') {
      conditions.push(eq(marketsCache.category, options.category));
    }
    if (options?.search) {
      conditions.push(
        or(
          ilike(marketsCache.question, `%${options.search}%`),
          ilike(marketsCache.description, `%${options.search}%`)
        )
      );
    }

    let orderBy;
    switch (options?.sortBy) {
      case 'volume':
      case 'popular':
        orderBy = desc(sql`CAST(${marketsCache.yesPoolSol} AS NUMERIC) + CAST(${marketsCache.noPoolSol} AS NUMERIC)`);
        break;
      case 'ending':
        orderBy = asc(marketsCache.endTs);
        break;
      case 'newest':
      default:
        orderBy = desc(marketsCache.createdAt);
    }

    const rows = await db.select()
      .from(marketsCache)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(orderBy)
      .limit(options?.limit || 50)
      .offset(options?.offset || 0);

    return rows.map(r => {
      const yesPool = Number(r.yesPoolSol ?? 0);
      const noPool = Number(r.noPoolSol ?? 0);
      const liquidity = yesPool + noPool;
      return {
        marketPubkey: r.marketPubkey,
        marketId: r.marketId,
        question: r.question,
        description: r.description ?? '',
        category: r.category ?? 'Crypto',
        status: r.status ?? 'open',
        winningOutcome: r.winningOutcome ?? undefined,
        yesPoolSol: yesPool,
        noPoolSol: noPool,
        yesSupply: r.yesSupply ?? 0,
        noSupply: r.noSupply ?? 0,
        endTs: r.endTs ? new Date(r.endTs) : new Date(),
        resolveTs: r.resolveTs ? new Date(r.resolveTs) : new Date(),
        thumbnailUrl: r.thumbnailUrl ?? undefined,
        tags: r.tags ?? undefined,
        viewCount: r.viewCount ?? 0,
        liquidity,
        volume24h: liquidity,
        traders: Math.max(1, Math.floor(liquidity / 15) + 1),
      };
    });
  } catch (e) {
    logger.warn("getAllMarkets failed:", e);
    return [];
  }
}

export async function getMarketById(id: string): Promise<MarketCacheEntry | null> {
  if (!db) return null;
  try {
    const rows = await db.select().from(marketsCache).where(
      or(eq(marketsCache.marketPubkey, id), eq(sql`CAST(${marketsCache.marketId} AS TEXT)`, id))
    ).limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      marketPubkey: r.marketPubkey,
      marketId: r.marketId,
      question: r.question,
      description: r.description ?? '',
      category: r.category ?? 'Crypto',
      status: r.status ?? 'open',
      winningOutcome: r.winningOutcome ?? undefined,
      yesPoolSol: Number(r.yesPoolSol ?? 0),
      noPoolSol: Number(r.noPoolSol ?? 0),
      yesSupply: r.yesSupply ?? 0,
      noSupply: r.noSupply ?? 0,
      endTs: r.endTs ? new Date(r.endTs) : new Date(),
      resolveTs: r.resolveTs ? new Date(r.resolveTs) : new Date(),
      thumbnailUrl: r.thumbnailUrl ?? undefined,
      tags: r.tags ?? undefined,
      viewCount: r.viewCount ?? 0,
    };
  } catch {
    return null;
  }
}

export async function getMarketStats() {
  if (!db) {
    return { totalMarkets: 0, openMarkets: 0, totalVolume: '0', volume24h: '0' };
  }
  try {
    const [stats] = await db.select({
      totalMarkets: sql<number>`COUNT(*)::int`,
      openMarkets: sql<number>`COUNT(*) FILTER (WHERE status = 'open')::int`,
      totalVolume: sql<string>`COALESCE(SUM(CAST(yes_pool_sol AS NUMERIC) + CAST(no_pool_sol AS NUMERIC)), 0)::text`,
    }).from(marketsCache);

    return {
      totalMarkets: stats?.totalMarkets || 0,
      openMarkets: stats?.openMarkets || 0,
      totalVolume: stats?.totalVolume || '0',
      volume24h: stats?.totalVolume || '0',
    };
  } catch {
    return { totalMarkets: 0, openMarkets: 0, totalVolume: '0', volume24h: '0' };
  }
}

export async function createMarketInDb(data: {
  question: string;
  description: string;
  category?: string;
  endTs: Date;
  thumbnailUrl?: string;
  tags?: string[];
}) {
  if (!db) return null;
  const countRes = await db.select({ count: sql<number>`COUNT(*)::int` }).from(marketsCache);
  const nextId = (countRes[0]?.count || 0) + 1;
  const dummyPubkey = `mkt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const [inserted] = await db.insert(marketsCache).values({
    marketPubkey: dummyPubkey,
    marketId: nextId,
    question: data.question,
    description: data.description,
    category: data.category || 'Crypto',
    status: 'open',
    yesPoolSol: '0',
    noPoolSol: '0',
    yesSupply: 0,
    noSupply: 0,
    endTs: data.endTs,
    resolveTs: data.endTs,
    thumbnailUrl: data.thumbnailUrl,
    tags: data.tags,
  }).returning();

  return inserted;
}

export async function settleMarketInDb(marketIdOrPubkey: string, outcome: 'YES' | 'NO' | 'yes' | 'no' | 'cancel') {
  if (!db) return false;
  const outcomeNormalized = outcome.toLowerCase();
  const statusStr = outcomeNormalized === 'cancel' ? 'cancelled' : 'settled';

  await db.update(marketsCache)
    .set({
      status: statusStr,
      winningOutcome: statusStr === 'settled' ? outcomeNormalized : undefined,
      updatedAt: new Date(),
    })
    .where(or(eq(marketsCache.marketPubkey, marketIdOrPubkey), eq(sql`CAST(${marketsCache.marketId} AS TEXT)`, marketIdOrPubkey)));

  return true;
}

export async function getCachedMarketsFromDb(): Promise<MarketCacheEntry[]> {
  return getAllMarkets();
}
