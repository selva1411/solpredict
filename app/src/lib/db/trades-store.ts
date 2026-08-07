import { db } from './client';
import { trades, marketsCache, users } from './schema';
import { eq, desc, sql, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function recordTradeInDb(data: {
  signature: string;
  marketPubkey: string;
  trader: string;
  side: "YES" | "NO";
  lamportsIn: number;
  tokensOut: number;
  pricePerToken?: number;
  blockTime?: Date;
  slot?: number;
}) {
  if (!db) return null;

  try {
    const price = data.pricePerToken ? data.pricePerToken.toString() : '0.50';
    const [result] = await db.insert(trades).values({
      signature: data.signature,
      marketPubkey: data.marketPubkey,
      trader: data.trader,
      side: data.side,
      lamportsIn: data.lamportsIn,
      tokensOut: data.tokensOut,
      pricePerToken: price,
      blockTime: data.blockTime || new Date(),
      slot: data.slot || 0,
    }).onConflictDoNothing().returning();

    // Update user record
    const solVolume = Math.abs(data.lamportsIn || 0) / 1e9;
    await db.insert(users).values({
      wallet: data.trader,
      lastActive: new Date(),
    }).onConflictDoUpdate({
      target: users.wallet,
      set: {
        lastActive: new Date(),
      }
    });

    // Update market volume
    try {
      await db.update(marketsCache).set({
        totalVolume: sql`CAST(COALESCE(CAST(${marketsCache.totalVolume} AS NUMERIC), 0) + ${solVolume} AS TEXT)`,
        updatedAt: new Date(),
      }).where(eq(marketsCache.marketPubkey, data.marketPubkey));
    } catch {}

    return result;
  } catch (err) {
    logger.warn("recordTradeInDb failed:", err);
    return null;
  }
}

export async function getRecentTradesFromDb(limit = 20) {
  if (!db) return [];

  try {
    const rows = await db.select({
      id: trades.id,
      signature: trades.signature,
      marketPubkey: trades.marketPubkey,
      trader: trades.trader,
      side: trades.side,
      lamportsIn: trades.lamportsIn,
      tokensOut: trades.tokensOut,
      pricePerToken: trades.pricePerToken,
      blockTime: trades.blockTime,
      question: marketsCache.question,
      category: marketsCache.category,
    })
    .from(trades)
    .leftJoin(marketsCache, eq(trades.marketPubkey, marketsCache.marketPubkey))
    .orderBy(desc(trades.blockTime))
    .limit(limit);

    return rows.map(r => ({
      ...r,
      question: r.question || `Market (${r.marketPubkey.slice(0, 8)}...)`,
      category: r.category || 'Crypto',
    }));
  } catch (err) {
    logger.warn("getRecentTradesFromDb failed:", err);
    return [];
  }
}

export async function getTradesByMarketFromDb(marketPubkey: string) {
  if (!db) return [];
  try {
    return await db.select().from(trades)
      .where(eq(trades.marketPubkey, marketPubkey))
      .orderBy(desc(trades.blockTime));
  } catch {
    return [];
  }
}

export async function getTradesByWalletFromDb(wallet: string) {
  if (!db) return [];
  try {
    const rows = await db.select({
      id: trades.id,
      signature: trades.signature,
      marketPubkey: trades.marketPubkey,
      trader: trades.trader,
      side: trades.side,
      lamportsIn: trades.lamportsIn,
      tokensOut: trades.tokensOut,
      pricePerToken: trades.pricePerToken,
      blockTime: trades.blockTime,
      question: marketsCache.question,
      category: marketsCache.category,
    })
    .from(trades)
    .leftJoin(marketsCache, eq(trades.marketPubkey, marketsCache.marketPubkey))
    .where(eq(trades.trader, wallet))
    .orderBy(desc(trades.blockTime));

    return rows.map(r => ({
      ...r,
      question: r.question || `Market (${r.marketPubkey.slice(0, 8)}...)`,
      category: r.category || 'Crypto',
    }));
  } catch {
    return [];
  }
}

export async function getTradeVolume24h(): Promise<number> {
  if (!db) return 0;
  try {
    const res = await db.execute(sql`
      SELECT COALESCE(SUM(ABS(lamports_in)), 0) / 1e9 as vol
      FROM trades
      WHERE block_time > NOW() - INTERVAL '24 hours'
    `);
    return Number((res.rows[0] as any)?.vol ?? 0);
  } catch {
    return 0;
  }
}

export async function getActiveTraders24h(): Promise<number> {
  if (!db) return 0;
  try {
    const res = await db.execute(sql`
      SELECT COUNT(DISTINCT trader) as count
      FROM trades
      WHERE block_time > NOW() - INTERVAL '24 hours'
    `);
    return Number((res.rows[0] as any)?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function getTotalTradeCount(): Promise<number> {
  if (!db) return 0;
  try {
    const [res] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(trades);
    return res?.count || 0;
  } catch {
    return 0;
  }
}
