import { NextRequest } from "next/server";
import { getMarketComments, addMarketComment } from "@/lib/db/store";
import { badRequest, ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { commentPostSchema } from "@/lib/schemas";

export const GET = apiHandler(async (req: NextRequest, context) => {
  const params = await context?.params;
  const marketPubkey = params?.id ?? "";
  const comments = await getMarketComments(marketPubkey);
  return ok({ ok: true, comments });
});

export const POST = apiHandler(async (req: NextRequest, context) => {
  const params = await context?.params;
  const marketPubkey = params?.id ?? "";
  const body = await req.json();

  const parsed = commentPostSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; "));

  const { authorWallet, authorUsername, content, parentId } = parsed.data;

  const created = await addMarketComment({
    marketPubkey, authorWallet, authorUsername, content, parentId,
  });
  return ok({ ok: true, comment: created });
});
