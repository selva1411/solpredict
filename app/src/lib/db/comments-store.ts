import { db } from './client';
import { marketComments } from './schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

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

const memoryComments: CommentEntry[] = [];

let nextCommentId = 1;

export async function getMarketComments(marketPubkey: string): Promise<CommentEntry[]> {
  if (db) {
    try {
      const rows = await db.select()
        .from(marketComments)
        .where(eq(marketComments.marketPubkey, marketPubkey))
        .orderBy(marketComments.createdAt);
      if (rows.length > 0) return rows.map(r => ({
        ...r,
        authorUsername: r.authorUsername ?? undefined,
        authorAvatar: r.authorAvatar ?? undefined,
        parentId: r.parentId ?? undefined,
        upvotes: r.upvotes ?? undefined,
        createdAt: r.createdAt ?? undefined,
      }));
    } catch {}
  }
  return memoryComments.filter(c => c.marketPubkey === marketPubkey);
}

export async function addMarketComment(comment: Omit<CommentEntry, 'id' | 'createdAt'>): Promise<CommentEntry> {
  const entry: CommentEntry = {
    ...comment,
    id: nextCommentId++,
    createdAt: new Date(),
  };
  memoryComments.push(entry);

  if (db) {
    try {
      await db.insert(marketComments).values({
        marketPubkey: entry.marketPubkey,
        authorWallet: entry.authorWallet,
        authorUsername: entry.authorUsername,
        authorAvatar: entry.authorAvatar,
        content: entry.content,
        parentId: entry.parentId,
        createdAt: entry.createdAt,
      });
    } catch (err) {
      logger.warn("DB addMarketComment failed, using in-memory:", err);
    }
  }

  return entry;
}
