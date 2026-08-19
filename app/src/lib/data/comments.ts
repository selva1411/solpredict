import { db } from '@/lib/db/client';
import { marketComments } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

export async function getCommentThread(marketPubkey: string) {
  if (!db) throw new Error("Database not available");
  const allComments = await db.select().from(marketComments)
    .where(eq(marketComments.marketPubkey, marketPubkey))
    .orderBy(desc(marketComments.createdAt));

  const topLevel = allComments.filter(c => !c.parentId);
  const replies = allComments.filter(c => !!c.parentId);

  return {
    comments: topLevel.map(comment => ({
      ...comment,
      upvotes: comment.upvotes ?? 0,
      replies: replies
        .filter(r => r.parentId === comment.id)
        .map(r => ({ ...r, upvotes: r.upvotes ?? 0 })),
    })),
    total: allComments.length,
  };
}

export interface NewComment {
  marketPubkey: string;
  authorWallet: string;
  authorUsername: string | null;
  content: string;
  parentId: number | null;
}

export async function insertComment(input: NewComment) {
  if (!db) throw new Error("Database not available");
  const [inserted] = await db.insert(marketComments).values({
    marketPubkey: input.marketPubkey,
    authorWallet: input.authorWallet,
    authorUsername: input.authorUsername,
    content: input.content.trim(),
    parentId: input.parentId,
    upvotes: 0,
    createdAt: new Date(),
  }).returning();
  return inserted;
}

export async function upvoteCommentById(commentId: number) {
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .update(marketComments)
    .set({ upvotes: sql`COALESCE(${marketComments.upvotes}, 0) + 1` })
    .where(eq(marketComments.id, commentId))
    .returning();
  return row ?? null;
}
