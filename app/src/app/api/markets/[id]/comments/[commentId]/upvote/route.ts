import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { upvoteComment } from "@/lib/db/store";
import { ok, notFound, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const POST = apiHandler(async (_req: NextRequest, context) => {
  if (!db) return serverError("Database not configured");
  const params = await context?.params;
  const commentId = Number(params?.commentId);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return notFound("Comment ID required");
  }
  const success = await upvoteComment(commentId);
  return ok({ ok: success });
});
