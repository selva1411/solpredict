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

    // Update user stats in users table
    const solVolume = (data.lamportsIn || 0) / 1e9;
    await db.insert(users).values({
      wallet: data.trader,
      totalWagered: solVolume.toString(),
      marketsTraded: 1,
      lastActive: new Date(),
    }).onConflictDoUpdate({
      target: users.wallet,
      set: {
        totalWagered: sql`COALESCE(CAST(${users.totalWagered} AS NUMERIC), 0) + ${solVolume}`,
        marketsTraded: sql`COALESCE(${users.marketsTraded}, 0) + 1`,
        lastActive: new Date(),
      }
    });

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
    })
    .from(trades)
    .leftJoin(marketsCache, eq(trades.marketPubkey, marketsCache.marketPubkey))
    .orderBy(desc(trades.blockTime))
    .limit(limit);

    return rows.map(r => ({
      ...r,
      question: r.question || `Market Trade (${r.marketPubkey.slice(0, 4)}...)`,
    }));
  } catch (err) {
    logger.warn("getRecentTradesFromDb failed:", err);
    return [];
  }
}

export async function getTradesByMarketFromDb(marketPubkey: string) {
  if (!db) return [];
  try {
    return await db.select().from(trades).where(eq(trades.marketPubkey, marketPubkey)).orderBy(desc(trades.blockTime));
  } catch {
    return [];
  }
}

export async function getTradesByWalletFromDb(wallet: string) {
  if (!db) return [];
  try {
    return await db.select().from(trades).where(eq(trades.trader, wallet)).orderBy(desc(trades.blockTime));
  } catch {
    return [];
  }
}
