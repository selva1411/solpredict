import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { marketComments } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';

export const GET = apiHandler(async (_req: NextRequest, context) => {
  const params = await context.params!;
  const marketPubkey = params.id;
  if (!marketPubkey) return badRequest('Market ID required');

  if (!db) return ok({ ok: true, comments: [] });

  try {
    const allComments = await db.select().from(marketComments)
      .where(eq(marketComments.marketPubkey, marketPubkey))
      .orderBy(desc(marketComments.createdAt));

    // Build threaded structure: top-level comments with nested replies
    const topLevel = allComments.filter(c => !c.parentId);
    const replies = allComments.filter(c => !!c.parentId);

    const thread = topLevel.map(comment => ({
      ...comment,
      upvotes: comment.upvotes ?? 0,
      replies: replies
        .filter(r => r.parentId === comment.id)
        .map(r => ({ ...r, upvotes: r.upvotes ?? 0 })),
    }));

    return ok({ ok: true, comments: thread, total: allComments.length });
  } catch (err) {
    return serverError(err);
  }
}, { cacheMaxAge: 10 });

export const POST = apiHandler(async (req: NextRequest, context) => {
  const params = await context.params!;
  const marketPubkey = params.id;
  if (!marketPubkey) return badRequest('Market ID required');

  try {
    const body = await req.json();
    // Accept both field name conventions
    const { author, authorWallet, authorUsername, content, parentId } = body;
    const resolvedAuthor = author || authorWallet;

    if (!resolvedAuthor || !content?.trim()) {
      return badRequest('author/authorWallet and content are required');
    }
    if (content.length > 2000) {
      return badRequest('Comment too long (max 2000 chars)');
    }

    if (!db) {
      // Return optimistic response when DB not configured
      return ok({
        ok: true,
        comment: {
          id: Date.now(),
          marketPubkey,
          authorWallet: resolvedAuthor,
          content: content.trim(),
          parentId: parentId ?? null,
          upvotes: 0,
          createdAt: new Date(),
        },
      }, { status: 201 });
    }

    const [inserted] = await db.insert(marketComments).values({
      marketPubkey,
      authorWallet: resolvedAuthor,
      authorUsername: authorUsername ?? null,
      content: content.trim(),
      parentId: parentId ?? null,
      upvotes: 0,
      createdAt: new Date(),
    }).returning();

    return ok({ ok: true, comment: inserted }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
});

// PATCH — upvote a comment
export const PATCH = apiHandler(async (req: NextRequest, context) => {
  const params = await context.params!;
  const marketPubkey = params.id;
  if (!marketPubkey) return badRequest('Market ID required');

  try {
    const body = await req.json();
    const { commentId } = body;
    if (!commentId) return badRequest('commentId is required');

    if (!db) return ok({ ok: true });

    await db.update(marketComments)
      .set({ upvotes: sql`COALESCE(${marketComments.upvotes}, 0) + 1` })
      .where(eq(marketComments.id, Number(commentId)));

    return ok({ ok: true });
  } catch (err) {
    return serverError(err);
  }
});
