export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { upvoteCommentById } from "@/lib/data/comments";
import { ok, notFound, serverError, unauthorized } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireUser } from "@/lib/user-guard";

export const POST = apiHandler(async (req: NextRequest, context) => {
  const params = await context?.params;
  const commentId = Number(params?.commentId);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return notFound("Comment ID required");
  }

  // Upvotes are per-user actions: require a verified wallet so a script can't
  // spam upvotes anonymously.
  const auth = await requireUser(req);
  if (!auth.ok) return auth.response;

  try {
    const row = await upvoteCommentById(commentId);
    if (!row) return notFound("Comment not found");
    return ok({ ok: true });
  } catch (err) {
    return serverError(err);
  }
});