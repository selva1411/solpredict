import { db } from './client';
import { marketsCache, trades, priceHistory, marketOutcomes } from './schema';
import { eq, desc, asc, sql, and, ilike, or, lte } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { getMarketPda } from '@/lib/pda';
import * as anchor from '@coral-xyz/anchor';
import { ENV } from '@/lib/env';

export interface MarketCacheEntry {
  marketPubkey: string;
  marketId: number;
  question: string;
  description: string;
  category: string;
  status: string;
  winningOutcome?: string;
  endTs: Date;
  resolveTs: Date;
  thumbnailUrl?: string;
  tags?: string[];
  viewCount?: number;
  watchlistCount?: number;
  volume24h?: number;
  traders?: number;
  liquidity?: number;
}

export async function getAllMarkets(options?: {
  status?: string;
  category?: string;
  limit?: number;
  offset?: number;
  search?: string;
  sortBy?: 'volume' | 'newest' | 'ending' | 'popular';
}): Promise<MarketCacheEntry[]> {
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
        orderBy = desc(sql`CAST(${marketsCache.totalVolume} AS NUMERIC)`);
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

    const tradeStatsMap = new Map<string, { volume: number; volume24h: number; traders: number }>();
    try {
      const tradeStats = await db.execute(sql`
        SELECT
          market_pubkey,
          COALESCE(SUM(ABS(lamports_in)), 0) / 1e9 as total_volume,
          COALESCE(SUM(CASE WHEN block_time > NOW() - INTERVAL '24 hours' THEN ABS(lamports_in) ELSE 0 END), 0) / 1e9 as volume_24h,
          COUNT(DISTINCT trader) as trader_count
        FROM trades
        GROUP BY market_pubkey
      `);
      for (const row of tradeStats.rows as Record<string, unknown>[]) {
        const mKey = String(row.market_pubkey ?? "");
        const vol = Number(row.total_volume ?? 0);
        const vol24h = Number(row.volume_24h ?? 0);
        const tCount = Number(row.trader_count ?? 0);
        tradeStatsMap.set(mKey, { volume: vol, volume24h: vol24h, traders: tCount });
      }
    } catch {}

    return rows.map(r => {
      const vol = Number(r.totalVolume ?? 0);
      const tStats = tradeStatsMap.get(r.marketPubkey);

      return {
        marketPubkey: r.marketPubkey,
        marketId: r.marketId,
        question: r.question,
        description: r.description ?? '',
        category: r.category ?? 'Crypto',
        status: r.status ?? 'open',
        winningOutcome: r.winningOutcome ?? undefined,
        endTs: r.endTs ? new Date(r.endTs) : new Date(),
        resolveTs: r.resolveTs ? new Date(r.resolveTs) : new Date(),
        thumbnailUrl: r.thumbnailUrl ?? undefined,
        tags: r.tags ?? undefined,
        viewCount: r.viewCount ?? 0,
        watchlistCount: r.watchlistCount ?? 0,
        liquidity: vol,
        volume24h: tStats?.volume24h ?? 0,
        traders: tStats?.traders ?? 0,
      };
    });
  } catch (e) {
    logger.warn("getAllMarkets failed:", e);
    return [];
  }
}

export async function getMarketByPubkey(pubkey: string): Promise<MarketCacheEntry | null> {
  const list = await getAllMarkets({ limit: 100 });
  return list.find(m => m.marketPubkey === pubkey) ?? null;
}

export async function getMarketById(marketId: string | number): Promise<MarketCacheEntry | null> {
  const list = await getAllMarkets({ limit: 100 });
  const idNum = Number(marketId);
  return list.find(m => m.marketId === idNum) ?? null;
}

export async function createMarketInDb(data: {
  marketPubkey?: string;
  question: string;
  description: string;
  category?: string;
  endTs: Date;
  resolveTs?: Date;
  thumbnailUrl?: string;
  tags?: string[];
}) {
  if (!db) return null;
  const countRes = await db.select({ count: sql<number>`COUNT(*)::int` }).from(marketsCache);
  const nextId = (countRes[0]?.count || 0) + 1;
  const pubkey = data.marketPubkey || getMarketPda(new anchor.BN(nextId), ENV.programId).toBase58();

  const [inserted] = await db.insert(marketsCache).values({
    marketPubkey: pubkey,
    marketId: nextId,
    question: data.question,
    description: data.description,
    category: data.category || 'Crypto',
    status: 'open',
    endTs: data.endTs,
    resolveTs: data.resolveTs || data.endTs,
    thumbnailUrl: data.thumbnailUrl,
    tags: data.tags,
  }).returning();

  return inserted;
}

export async function updateMarketInDb(marketPubkey: string, data: Partial<{
  question: string;
  description: string;
  category: string;
  status: string;
  winningOutcome: string;
  thumbnailUrl: string;
  tags: string[];
  viewCount: number;
}>) {
  if (!db) return false;
  try {
    await db.update(marketsCache).set({
      ...data,
      updatedAt: new Date(),
    }).where(eq(marketsCache.marketPubkey, marketPubkey));
    return true;
  } catch (e) {
    logger.warn("updateMarketInDb failed:", e);
    return false;
  }
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

export async function incrementViewCount(marketPubkey: string) {
  if (!db) return;
  try {
    await db.update(marketsCache).set({
      viewCount: sql`COALESCE(${marketsCache.viewCount}, 0) + 1`,
    }).where(eq(marketsCache.marketPubkey, marketPubkey));
  } catch {}
}

export async function getMarketPriceHistory(marketPubkey: string, limit = 120): Promise<Array<{ timestamp: Date; yesPct: number }>> {
  if (!db) return [];
  try {
    const rows = await db.select({
      timestamp: priceHistory.timestamp,
      priceBps: priceHistory.priceBps,
    }).from(priceHistory)
      .where(and(
        eq(priceHistory.marketPubkey, marketPubkey),
        lte(priceHistory.timestamp, new Date()),
      ))
      .orderBy(desc(priceHistory.timestamp))
      .limit(limit);
    return rows.map(r => ({
      timestamp: r.timestamp ?? new Date(),
      yesPct: (r.priceBps ?? 5000) / 100,
    })).reverse();
  } catch (e) {
    logger.warn("getMarketPriceHistory failed:", e);
    return [];
  }
}

export async function updateMarketPools(marketPubkey: string, yesPoolSol: number, noPoolSol: number) {
  if (!db) return;
  try {
    await db.update(marketsCache).set({
      totalVolume: (yesPoolSol + noPoolSol).toString(),
      updatedAt: new Date(),
    }).where(eq(marketsCache.marketPubkey, marketPubkey));
  } catch {}
}

export async function deleteMarketFromDb(marketPubkey: string) {
  if (!db) return false;
  try {
    await db.delete(marketsCache).where(eq(marketsCache.marketPubkey, marketPubkey));
    return true;
  } catch {
    return false;
  }
}

export async function getCachedMarketsFromDb(): Promise<MarketCacheEntry[]> {
  return getAllMarkets();
}
