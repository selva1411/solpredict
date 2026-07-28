import { db } from './client';
import { marketsCache } from './schema';
import { eq, desc } from 'drizzle-orm';
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
}

const memoryMarkets = new Map<string, MarketCacheEntry>();

export async function upsertMarketCache(entry: MarketCacheEntry) {
  memoryMarkets.set(entry.marketPubkey, entry);

  if (db) {
    try {
      await db.insert(marketsCache).values({
        marketPubkey: entry.marketPubkey,
        marketId: entry.marketId,
        question: entry.question,
        description: entry.description,
        category: entry.category,
        status: entry.status,
        winningOutcome: entry.winningOutcome,
        yesPoolSol: entry.yesPoolSol.toString(),
        noPoolSol: entry.noPoolSol.toString(),
        yesSupply: entry.yesSupply,
        noSupply: entry.noSupply,
        endTs: entry.endTs,
        resolveTs: entry.resolveTs,
        thumbnailUrl: entry.thumbnailUrl,
        tags: entry.tags,
        updatedAt: new Date(),
      }).onConflictDoUpdate({
        target: marketsCache.marketPubkey,
        set: {
          question: entry.question,
          description: entry.description,
          category: entry.category,
          status: entry.status,
          winningOutcome: entry.winningOutcome,
          yesPoolSol: entry.yesPoolSol.toString(),
          noPoolSol: entry.noPoolSol.toString(),
          yesSupply: entry.yesSupply,
          noSupply: entry.noSupply,
          endTs: entry.endTs,
          resolveTs: entry.resolveTs,
          thumbnailUrl: entry.thumbnailUrl,
          tags: entry.tags,
          updatedAt: new Date(),
        }
      });
    } catch (err) {
      logger.warn("DB upsertMarketCache failed, using in-memory:", err);
    }
  }
}

export async function getCachedMarketsFromDb(): Promise<MarketCacheEntry[]> {
  if (db) {
    try {
      const rows = await db.select().from(marketsCache).orderBy(desc(marketsCache.updatedAt)).limit(100);
      if (rows.length > 0) return rows.map(r => ({
        marketPubkey: r.marketPubkey,
        marketId: r.marketId,
        question: r.question,
        description: r.description ?? "",
        category: r.category ?? "Crypto",
        status: r.status ?? "open",
        winningOutcome: r.winningOutcome ?? undefined,
        yesPoolSol: Number(r.yesPoolSol ?? 0),
        noPoolSol: Number(r.noPoolSol ?? 0),
        yesSupply: r.yesSupply ?? 0,
        noSupply: r.noSupply ?? 0,
        endTs: r.endTs ? new Date(r.endTs) : new Date(),
        resolveTs: r.resolveTs ? new Date(r.resolveTs) : new Date(),
        thumbnailUrl: r.thumbnailUrl ?? undefined,
        tags: r.tags ?? undefined,
        viewCount: r.viewCount ?? undefined,
      }));
    } catch {}
  }
  return Array.from(memoryMarkets.values());
}
