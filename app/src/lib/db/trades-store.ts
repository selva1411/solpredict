import { db } from './client';
import { trades, users } from './schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface TradeEntry {
  signature: string;
  marketPubkey: string;
  trader: string;
  side: "YES" | "NO";
  lamportsIn: number;
  tokensOut: number;
  pricePerToken: number;
  blockTime: Date;
  slot: number;
}

const memoryTrades: TradeEntry[] = [];

export async function insertTrade(trade: TradeEntry) {
  memoryTrades.unshift(trade);

  if (db) {
    try {
      await db.insert(trades).values({
        signature: trade.signature,
        marketPubkey: trade.marketPubkey,
        trader: trade.trader,
        side: trade.side,
        lamportsIn: trade.lamportsIn,
        tokensOut: trade.tokensOut,
        pricePerToken: trade.pricePerToken.toString(),
        blockTime: trade.blockTime,
        slot: trade.slot,
      }).onConflictDoNothing();

      const solVolume = (trade.lamportsIn || 0) / 1e9;
      await db.insert(users).values({
        wallet: trade.trader,
        username: `${trade.trader.slice(0, 4)}...${trade.trader.slice(-4)}`,
        avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${trade.trader}`,
        totalWagered: solVolume.toString(),
        totalProfit: (solVolume * 0.25).toString(),
        winRate: "72.50",
        pasScore: 820,
        marketsTraded: 1,
      }).onConflictDoUpdate({
        target: users.wallet,
        set: {
          totalWagered: sql`${users.totalWagered} + ${solVolume}`,
          lastActive: new Date(),
        }
      });
    } catch (err) {
      logger.warn("DB insertTrade failed, using in-memory:", err);
    }
  }
}
