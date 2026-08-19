export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { getCommentThread, insertComment } from '@/lib/data/comments';
import { commentPostSchema } from '@/lib/schemas';
import { z } from 'zod';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';
import { requireUser } from '@/lib/user-guard';

// Accepts both field-name conventions from the UI.
const commentBodySchema = commentPostSchema.extend({
  author: z.string().min(32).max(44).optional(),
}).refine(
  (v) => Boolean(v.authorWallet || v.author),
  { message: "authorWallet (or author) is required" },
);

export const GET = apiHandler(async (_req: NextRequest, context) => {
  const params = await context.params!;
  const marketPubkey = params.id;
  if (!marketPubkey) return badRequest('Market ID required');

  try {
    const { comments, total } = await getCommentThread(marketPubkey);
    return ok({ ok: true, comments, total });
  } catch (err) {
    return serverError(err);
  }
}, { cacheMaxAge: 10 });

export const POST = apiHandler(async (req: NextRequest, context) => {
  const params = await context.params!;
  const marketPubkey = params.id;
  if (!marketPubkey) return badRequest('Market ID required');

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest('Invalid JSON body');

  const parsed = commentBodySchema.safeParse(body);
  if (!parsed.success) return badRequest('Invalid comment data');

  // The comment must be authored by the wallet that signed the request — a
  // client can never post as another user (closes the IDOR hole).
  const authorWallet = parsed.data.authorWallet || parsed.data.author!;
  const auth = await requireUser(req, authorWallet);
  if (!auth.ok) return auth.response;

  try {
    const { authorUsername, content, parentId } = parsed.data;
    const inserted = await insertComment({
      marketPubkey,
      authorWallet: auth.identity.wallet,
      authorUsername: authorUsername ?? null,
      content: content.trim(),
      parentId: parentId ?? null,
    });
    return ok({ ok: true, comment: inserted }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
});