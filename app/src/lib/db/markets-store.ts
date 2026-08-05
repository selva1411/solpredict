import { db } from './client';
import { marketsCache, trades, priceHistory } from './schema';
import { eq, desc, asc, sql, and, ilike, or, lte } from 'drizzle-orm';
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

    // Fetch real volume and trader count per market from trades table.
    // volume_24h is a true 24h window; total_volume is all-time.
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
    } catch {
      // trades table may be empty — that's fine
    }

    return rows.map(r => {
      const yesPool = Number(r.yesPoolSol ?? 0);
      const noPool = Number(r.noPoolSol ?? 0);
      const liquidity = yesPool + noPool;
      const tStats = tradeStatsMap.get(r.marketPubkey);

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
        watchlistCount: r.watchlistCount ?? 0,
        liquidity,
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
  if (!db) return null;
  try {
    const rows = await db.select().from(marketsCache).where(
      eq(marketsCache.marketPubkey, pubkey)
    ).limit(1);

    if (rows.length === 0) return null;
    const r = rows[0];

    // Get trade stats for this specific market
    let volume = 0;
    let volume24h = 0;
    let traderCount = 0;
    try {
      const stats = await db.execute(sql`
        SELECT
          COALESCE(SUM(ABS(lamports_in)), 0) / 1e9 as total_volume,
          COALESCE(SUM(CASE WHEN block_time > NOW() - INTERVAL '24 hours' THEN ABS(lamports_in) ELSE 0 END), 0) / 1e9 as volume_24h,
          COUNT(DISTINCT trader) as trader_count
        FROM trades
        WHERE market_pubkey = ${pubkey}
      `);
      if (stats.rows.length > 0) {
        volume = Number((stats.rows[0] as any).total_volume ?? 0);
        volume24h = Number((stats.rows[0] as any).volume_24h ?? 0);
        traderCount = Number((stats.rows[0] as any).trader_count ?? 0);
      }
    } catch {}

    const yesPool = Number(r.yesPoolSol ?? 0);
    const noPool = Number(r.noPoolSol ?? 0);

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
      watchlistCount: r.watchlistCount ?? 0,
      liquidity: yesPool + noPool,
      volume24h,
      traders: traderCount,
    };
  } catch (e) {
    logger.warn("getMarketByPubkey failed:", e);
    return null;
  }
}

export async function getMarketById(id: string): Promise<MarketCacheEntry | null> {
  if (!db) return null;
  try {
    const rows = await db.select().from(marketsCache).where(
      or(eq(marketsCache.marketPubkey, id), eq(sql`CAST(${marketsCache.marketId} AS TEXT)`, id))
    ).limit(1);

    if (rows.length === 0) return null;
    return getMarketByPubkey(rows[0].marketPubkey);
  } catch {
    return null;
  }
}

export async function getMarketStats() {
  if (!db) {
    return { totalMarkets: 0, openMarkets: 0, totalVolume: '0', totalLiquidity: '0', volume24h: '0', totalTraders: 0 };
  }
  try {
    const [stats] = await db.select({
      totalMarkets: sql<number>`COUNT(*)::int`,
      openMarkets: sql<number>`COUNT(*) FILTER (WHERE status = 'open')::int`,
      totalLiquidity: sql<string>`COALESCE(SUM(CAST(yes_pool_sol AS NUMERIC) + CAST(no_pool_sol AS NUMERIC)), 0)::text`,
    }).from(marketsCache);

    let tradeVolume = 0;
    let tradeVolume24h = 0;
    let totalTraders = 0;
    try {
      const tradeRes = await db.execute(sql`
        SELECT
          COALESCE(SUM(ABS(lamports_in)), 0) / 1e9 as total_vol,
          COALESCE(SUM(CASE WHEN block_time > NOW() - INTERVAL '24 hours' THEN ABS(lamports_in) ELSE 0 END), 0) / 1e9 as vol_24h,
          COUNT(DISTINCT trader) as traders
        FROM trades
      `);
      if (tradeRes.rows.length > 0) {
        const row = tradeRes.rows[0] as any;
        tradeVolume = Number(row.total_vol || 0);
        tradeVolume24h = Number(row.vol_24h || 0);
        totalTraders = Number(row.traders || 0);
      }
    } catch {}

    const poolLiquidity = Number(stats?.totalLiquidity || 0);
    const combinedVolume = tradeVolume > 0 ? tradeVolume : poolLiquidity;

    return {
      totalMarkets: stats?.totalMarkets || 0,
      openMarkets: stats?.openMarkets || 0,
      totalVolume: combinedVolume.toFixed(2),
      totalLiquidity: poolLiquidity.toFixed(2),
      volume24h: tradeVolume24h.toFixed(2),
      totalTraders,
    };
  } catch (e) {
    logger.warn("getMarketStats failed:", e);
    return { totalMarkets: 0, openMarkets: 0, totalVolume: '0', totalLiquidity: '0', volume24h: '0', totalTraders: 0 };
  }
}

export async function getMarketsCount(options?: { status?: string; category?: string }) {
  if (!db) return 0;
  try {
    const conditions = [];
    if (options?.status) conditions.push(eq(marketsCache.status, options.status));
    if (options?.category && options.category !== 'All') conditions.push(eq(marketsCache.category, options.category));

    const [result] = await db.select({
      count: sql<number>`COUNT(*)::int`,
    }).from(marketsCache).where(conditions.length > 0 ? and(...conditions) : undefined);

    return result?.count || 0;
  } catch {
    return 0;
  }
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
  yesPoolSol?: number;
  noPoolSol?: number;
}) {
  if (!db) return null;
  const countRes = await db.select({ count: sql<number>`COUNT(*)::int` }).from(marketsCache);
  const nextId = (countRes[0]?.count || 0) + 1;
  const pubkey = data.marketPubkey || generateMockPubkey();

  const [inserted] = await db.insert(marketsCache).values({
    marketPubkey: pubkey,
    marketId: nextId,
    question: data.question,
    description: data.description,
    category: data.category || 'Crypto',
    status: 'open',
    yesPoolSol: (data.yesPoolSol || 0).toString(),
    noPoolSol: (data.noPoolSol || 0).toString(),
    yesSupply: 0,
    noSupply: 0,
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
  yesPoolSol: string;
  noPoolSol: string;
  yesSupply: number;
  noSupply: number;
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
      yesPct: priceHistory.yesPct,
    }).from(priceHistory)
      .where(and(
        eq(priceHistory.marketPubkey, marketPubkey),
        lte(priceHistory.timestamp, new Date()),
      ))
      .orderBy(desc(priceHistory.timestamp))
      .limit(limit);
    return rows.map(r => ({
      timestamp: r.timestamp ?? new Date(),
      yesPct: Number(r.yesPct ?? 50),
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
      yesPoolSol: yesPoolSol.toString(),
      noPoolSol: noPoolSol.toString(),
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

// Re-export for backward compatibility
export async function getCachedMarketsFromDb(): Promise<MarketCacheEntry[]> {
  return getAllMarkets();
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/**
 * Generate a valid-looking base58 public key (44 chars) for markets that are
 * created DB-side without a real on-chain address yet. This avoids the
 * `mkt_...` fake keys which collapsed to PublicKey.default in the UI.
 */
export function generateMockPubkey(): string {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  // Manual base58 encode without BigInt (ES2020-lower target).
  let n = 0;
  let bits = 0;
  let out = "";
  for (const b of bytes) {
    // Work in 53-bit safe chunks using a running decimal accumulator.
    n = n * 256 + b;
    bits += 8;
    while (bits >= 58) {
      bits -= 58;
      const idx = Math.floor((n / Math.pow(2, bits)) % 58);
      out += BASE58_ALPHABET[idx];
    }
  }
  if (bits > 0) {
    const idx = Math.floor(n * Math.pow(2, 58 - bits) % 58);
    out += BASE58_ALPHABET[idx];
  }
  // Pad to 44 chars (Solana pubkey length) with leading base58 digit.
  while (out.length < 44) out = "1" + out;
  return out.slice(0, 44);
}
