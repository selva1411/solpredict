export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getWatchlistKeys, toggleWatch, removeWatch } from "@/lib/data/watchlist";
import { badRequest, ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { watchlistGetSchema, watchlistPostSchema } from "@/lib/schemas";
import { requireUser } from "@/lib/user-guard";

export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  if (!wallet) return badRequest("Missing wallet parameter");

  const parsed = watchlistGetSchema.safeParse({ wallet });
  if (!parsed.success) return badRequest("Invalid wallet format");

  const auth = await requireUser(req, parsed.data.wallet);
  if (!auth.ok) return auth.response;

  try {
    const keys = await getWatchlistKeys(auth.identity.wallet);
    return ok({ ok: true, keys });
  } catch (err) {
    return serverError(err);
  }
});

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const parsed = watchlistPostSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request data");

  const auth = await requireUser(req, parsed.data.wallet);
  if (!auth.ok) return auth.response;

  try {
    const { marketPubkey } = parsed.data;
    const isWatched = await toggleWatch(auth.identity.wallet, marketPubkey);
    return ok({ ok: true, action: isWatched ? "added" : "removed", isWatched });
  } catch (err) {
    return serverError(err);
  }
});

// DELETE removes a specific watchlist entry unconditionally (used by the
// self-heal to purge dead market pubkeys from the DB copy so they don't
// reappear on the next wallet connect). Unlike POST it is not a toggle.
export const DELETE = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const parsed = watchlistPostSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request data");

  const auth = await requireUser(req, parsed.data.wallet);
  if (!auth.ok) return auth.response;

  try {
    const { marketPubkey } = parsed.data;
    await removeWatch(auth.identity.wallet, marketPubkey);
    return ok({ ok: true, action: "removed", isWatched: false });
  } catch (err) {
    return serverError(err);
  }
});