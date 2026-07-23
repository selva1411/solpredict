import { db } from './client';
import { marketsCache, trades, users, marketComments, priceHistory, leaderboardSnapshots, watchlist } from './schema';
import { eq, desc, sql as drizzleSql } from 'drizzle-orm';

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

// In-memory cache store for offline/localnet fallback
const memoryMarkets = new Map<string, MarketCacheEntry>();
const memoryTrades: TradeEntry[] = [];
const memoryComments: CommentEntry[] = [
  {
    id: 1,
    marketPubkey: "GtBWL87QoY2b9aZr5Qnxi5ft5BXujYmeihFb8pZZ2JCY",
    authorWallet: "2zPRxYVxFDUZn6QEYU2m6bzyZcN7pCCJ4E25gc2EQcCS",
    authorUsername: "SatoshiTrader",
    authorAvatar: "https://api.dicebear.com/7.x/identicon/svg?seed=Satoshi",
    content: "SOL momentum looks extremely strong after the recent breakout. YES is highly likely!",
    upvotes: 12,
    createdAt: new Date(Date.now() - 3600000),
  },
  {
    id: 2,
    marketPubkey: "GtBWL87QoY2b9aZr5Qnxi5ft5BXujYmeihFb8pZZ2JCY",
    authorWallet: "6fPimtWc71g5f6h8894Jb6k6k6",
    authorUsername: "SolanaBear",
    authorAvatar: "https://api.dicebear.com/7.x/identicon/svg?seed=Bear",
    content: "Resistance around $205 is massive. Expecting a short term pullback. Betting NO.",
    upvotes: 5,
    createdAt: new Date(Date.now() - 1800000),
  }
];

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
          yesPoolSol: entry.yesPoolSol.toString(),
          noPoolSol: entry.noPoolSol.toString(),
          yesSupply: entry.yesSupply,
          noSupply: entry.noSupply,
          status: entry.status,
          winningOutcome: entry.winningOutcome,
          updatedAt: new Date(),
        }
      });
    } catch (e) {
      console.warn("NeonDB sync warning:", e);
    }
  }
}

export async function getCachedMarketsFromDb(): Promise<MarketCacheEntry[]> {
  if (db) {
    try {
      const rows = await db.select().from(marketsCache).orderBy(desc(marketsCache.createdAt));
      if (rows.length > 0) {
        return rows.map(r => ({
          marketPubkey: r.marketPubkey,
          marketId: r.marketId,
          question: r.question,
          description: r.description || '',
          category: r.category || 'Crypto',
          status: r.status || 'open',
          winningOutcome: r.winningOutcome || undefined,
          yesPoolSol: Number(r.yesPoolSol || 0),
          noPoolSol: Number(r.noPoolSol || 0),
          yesSupply: r.yesSupply || 0,
          noSupply: r.noSupply || 0,
          endTs: r.endTs || new Date(),
          resolveTs: r.resolveTs || new Date(),
          thumbnailUrl: r.thumbnailUrl || undefined,
          tags: r.tags || undefined,
        }));
      }
    } catch (e) {
      console.warn("NeonDB fetch cached markets warning:", e);
    }
  }
  return Array.from(memoryMarkets.values());
}

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
    } catch (e) {
      console.warn("NeonDB trade insert warning:", e);
    }
  }
}

export async function getMarketComments(marketPubkey: string): Promise<CommentEntry[]> {
  if (db) {
    try {
      const rows = await db.select().from(marketComments).where(eq(marketComments.marketPubkey, marketPubkey)).orderBy(desc(marketComments.createdAt));
      if (rows.length > 0) {
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
      }
    } catch (e) {
      console.warn("NeonDB comments fetch warning:", e);
    }
  }

  return memoryComments.filter(c => c.marketPubkey === marketPubkey);
}

export async function addMarketComment(comment: CommentEntry): Promise<CommentEntry> {
  const newComment = {
    ...comment,
    id: memoryComments.length + 1,
    createdAt: new Date(),
    upvotes: 0,
  };
  memoryComments.unshift(newComment);

  if (db) {
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
      console.warn("NeonDB add comment warning:", e);
    }
  }

  return newComment;
}

export async function recordLeaderboardSnapshot() {
  if (db) {
    try {
      const topUsers = await db.select().from(users).orderBy(desc(users.totalWagered)).limit(50);
      const todayStr = new Date().toISOString().slice(0, 10);

      for (let i = 0; i < topUsers.length; i++) {
        const u = topUsers[i];
        await db.insert(leaderboardSnapshots).values({
          wallet: u.wallet,
          period: 'daily',
          rank: i + 1,
          profitSol: (u.totalProfit || '0').toString(),
          winRate: (u.winRate || '50.00').toString(),
          pasScore: u.pasScore || 75,
          marketsCount: u.marketsTraded || 1,
          snapshotDate: todayStr,
        });
      }
    } catch (e) {
      console.warn("NeonDB record leaderboard snapshot warning:", e);
    }
  }
}

export async function getLeaderboardData() {
  if (db) {
    try {
      const rows = await db.select().from(users).orderBy(desc(users.totalWagered)).limit(20);
      if (rows.length > 0) {
        // Asynchronously save snapshot into leaderboard_snapshots table in NeonDB
        recordLeaderboardSnapshot().catch(() => {});

        return rows.map((u, i) => ({
          rank: i + 1,
          wallet: u.wallet,
          username: u.username || `${u.wallet.slice(0, 4)}...${u.wallet.slice(-4)}`,
          avatarUrl: u.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${u.wallet}`,
          totalWagered: Number(u.totalWagered || 0),
          totalProfit: Number(u.totalProfit || 0),
          winRate: Number(u.winRate || 0),
          pasScore: u.pasScore || 75,
          marketsTraded: u.marketsTraded || 0,
        }));
      }
    } catch (e) {
      console.warn("NeonDB leaderboard warning:", e);
    }
  }

  // Fallback demo leaderboard
  return [
    { rank: 1, wallet: "2zPRxYVxFDUZn6QEYU2m6bzyZcN7pCCJ4E25gc2EQcCS", username: "AlphaTrader", avatarUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=Alpha", totalWagered: 145.5, totalProfit: 48.2, winRate: 78.5, pasScore: 92, marketsTraded: 42 },
    { rank: 2, wallet: "6z3wWf...Bot1", username: "Bot_Trader_1", avatarUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=Bot1", totalWagered: 98.0, totalProfit: 24.5, winRate: 65.0, pasScore: 81, marketsTraded: 88 },
    { rank: 3, wallet: "8Y6sf5...Bot2", username: "Bot_Trader_2", avatarUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=Bot2", totalWagered: 76.2, totalProfit: 18.1, winRate: 61.2, pasScore: 76, marketsTraded: 64 },
    { rank: 4, wallet: "4kLm99...Whale", username: "SolanaWhale", avatarUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=Whale", totalWagered: 320.0, totalProfit: 15.4, winRate: 54.0, pasScore: 71, marketsTraded: 19 },
    { rank: 5, wallet: "9xPq11...Oracle", username: "OracleSeeker", avatarUrl: "https://api.dicebear.com/7.x/identicon/svg?seed=Oracle", totalWagered: 45.0, totalProfit: 9.8, winRate: 58.3, pasScore: 68, marketsTraded: 15 },
  ];
}
