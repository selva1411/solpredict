import { db } from './client';
import { marketsCache, trades, users, marketComments, leaderboardSnapshots, watchlist } from './schema';
import { eq, desc, sql as drizzleSql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { getAllMarkets, type MarketCacheEntry } from './markets-store';

export type { MarketCacheEntry };

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

export interface CommentEntry {
  id?: number;
  marketPubkey: string;
  authorWallet: string;
  authorUsername?: string;
  authorAvatar?: string;
  content: string;
  parentId?: number;
  upvotes?: number;
  createdAt?: Date;
}

export async function upsertMarketCache(entry: MarketCacheEntry) {
  if (!db) return;

  try {
    await db.insert(marketsCache).values({
      marketPubkey: entry.marketPubkey,
      marketId: entry.marketId,
      question: entry.question,
      description: entry.description,
      category: entry.category,
      status: entry.status,
      winningOutcome: entry.winningOutcome,
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
        updatedAt: new Date(),
      }
    });
  } catch (e) {
    logger.warn("upsertMarketCache failed:", e);
  }
}

export async function getCachedMarketsFromDb(): Promise<MarketCacheEntry[]> {
  return getAllMarkets();
}

export async function insertTrade(trade: TradeEntry) {
  if (!db) return;

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

    // Upsert trader into users table for persistent leaderboard tracking.
    // Volume uses ABS so sells never subtract from accumulated volume.
    const solVolume = Math.abs(trade.lamportsIn || 0) / 1e9;
    await db.insert(users).values({
      wallet: trade.trader,
      lastActive: new Date(),
    }).onConflictDoUpdate({
      target: users.wallet,
      set: {
        lastActive: new Date(),
      }
    });
  } catch (e) {
    logger.warn("insertTrade failed:", e);
  }
}

export async function getMarketComments(marketPubkey: string): Promise<CommentEntry[]> {
  if (!db) return [];

  try {
    const rows = await db.select().from(marketComments)
      .where(eq(marketComments.marketPubkey, marketPubkey))
      .orderBy(desc(marketComments.createdAt));

    return rows.map(r => ({
      id: r.id,
      marketPubkey: r.marketPubkey,
      authorWallet: r.authorWallet,
      authorUsername: r.authorUsername || `${r.authorWallet.slice(0, 4)}...`,
      authorAvatar: r.authorAvatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${r.authorWallet}`,
      content: r.content,
      parentId: r.parentId || undefined,
      upvotes: r.upvotes || 0,
      createdAt: r.createdAt || new Date(),
    }));
  } catch (e) {
    logger.warn("getMarketComments failed:", e);
    return [];
  }
}

export async function addMarketComment(comment: CommentEntry): Promise<CommentEntry> {
  if (!db) {
    throw new Error("Database not configured");
  }

  try {
    const [inserted] = await db.insert(marketComments).values({
      marketPubkey: comment.marketPubkey,
      authorWallet: comment.authorWallet,
      authorUsername: comment.authorUsername,
      authorAvatar: comment.authorAvatar,
      content: comment.content,
      parentId: comment.parentId,
      upvotes: 0,
    }).returning();

    return {
      id: inserted.id,
      marketPubkey: inserted.marketPubkey,
      authorWallet: inserted.authorWallet,
      authorUsername: inserted.authorUsername || undefined,
      authorAvatar: inserted.authorAvatar || undefined,
      content: inserted.content,
      parentId: inserted.parentId || undefined,
      upvotes: inserted.upvotes || 0,
      createdAt: inserted.createdAt || new Date(),
    };
  } catch (e) {
    logger.warn("addMarketComment failed:", e);
    throw e;
  }
}

export async function upvoteComment(commentId: number): Promise<boolean> {
  if (!db) return false;
  try {
    await db.update(marketComments).set({
      upvotes: drizzleSql`COALESCE(${marketComments.upvotes}, 0) + 1`,
    }).where(eq(marketComments.id, commentId));
    return true;
  } catch {
    return false;
  }
}

export async function recordLeaderboardSnapshot() {
  if (!db) return;
  try {
    const { userStats } = await import('./schema');
    const topUsers = await db.select().from(userStats).orderBy(desc(userStats.totalVolume)).limit(50);
    const todayStr = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < topUsers.length; i++) {
      const u = topUsers[i];
      const wins = u.wins ?? 0;
      const losses = u.losses ?? 0;
      const settled = u.marketsResolved ?? wins + losses;
      const pasScore = settled > 0 ? Math.round((wins / settled) * 100) : null;
      await db.insert(leaderboardSnapshots).values({
        wallet: u.wallet,
        period: 'daily',
        rank: i + 1,
        profitSol: (u.realizedPnl || '0').toString(),
        winRate: (u.winRateBps ? (u.winRateBps / 100).toString() : '0'),
        pasScore,
        marketsCount: u.marketsTraded || 0,
        snapshotDate: todayStr,
      });
    }
  } catch (e) {
    logger.warn("recordLeaderboardSnapshot failed:", e);
  }
}

export async function getLeaderboardData() {
  if (!db) return [];

  try {
    const { userStats } = await import('./schema');
    const rows = await db.select({
      wallet: userStats.wallet,
      totalVolume: userStats.totalVolume,
      realizedPnl: userStats.realizedPnl,
      winRateBps: userStats.winRateBps,
      marketsTraded: userStats.marketsTraded,
      marketsResolved: userStats.marketsResolved,
      wins: userStats.wins,
      losses: userStats.losses,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(userStats)
    .leftJoin(users, eq(users.wallet, userStats.wallet))
    .orderBy(desc(drizzleSql`CAST(${userStats.totalVolume} AS NUMERIC)`))
    .limit(20);

    if (rows.length > 0) {
      return rows.map((u, i) => {
        const wins = u.wins ?? 0;
        const losses = u.losses ?? 0;
        const settled = u.marketsResolved ?? wins + losses;
        const pasScore = settled > 0 ? Math.round((wins / settled) * 100) : null;
        return {
        rank: i + 1,
        wallet: u.wallet,
        username: u.username || `${u.wallet.slice(0, 4)}...${u.wallet.slice(-4)}`,
        avatarUrl: u.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${u.wallet}`,
        totalWagered: Number(u.totalVolume || 0),
        totalProfit: Number(u.realizedPnl || 0),
        winRate: u.winRateBps != null ? u.winRateBps / 100 : 0,
        pasScore,
        marketsTraded: u.marketsTraded || 0,
        };
      });
    }

    // 2. Aggregate from trades table
    const tradeAggregation = await db.select({
      trader: trades.trader,
      totalLamports: drizzleSql<number>`SUM(ABS(${trades.lamportsIn}))`,
      tradeCount: drizzleSql<number>`COUNT(*)`,
    }).from(trades).groupBy(trades.trader).orderBy(drizzleSql`SUM(ABS(${trades.lamportsIn})) DESC`).limit(20);

    if (tradeAggregation.length > 0) {
      return tradeAggregation.map((t, i) => {
        const volumeSol = Number(t.totalLamports || 0) / 1e9;
        return {
          rank: i + 1,
          wallet: t.trader,
          username: `${t.trader.slice(0, 4)}...${t.trader.slice(-4)}`,
          avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${t.trader}`,
          totalWagered: Number(volumeSol.toFixed(2)),
          totalProfit: 0,
          winRate: 0,
          pasScore: null,
          marketsTraded: Number(t.tradeCount || 0),
        };
      });
    }

    return [];
  } catch (e) {
    logger.warn("getLeaderboardData failed:", e);
    return [];
  }
}
