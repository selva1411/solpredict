export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { watchlist } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { badRequest, ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { toError } from "@/lib/errors";
import { watchlistGetSchema, watchlistPostSchema } from "@/lib/schemas";

export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  if (!wallet) return badRequest("Missing wallet parameter");

  const parsed = watchlistGetSchema.safeParse({ wallet });
  if (!parsed.success) return badRequest("Invalid wallet format");

  try {
    if (db) {
      const items = await db
        .select({ marketPubkey: watchlist.marketPubkey })
        .from(watchlist)
        .where(eq(watchlist.wallet, wallet));
      return ok({ ok: true, keys: items.map(i => i.marketPubkey) });
    }
  } catch (e) {
    console.warn("Watchlist GET error:", e);
  }
  return ok({ ok: true, keys: [] });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const parsed = watchlistPostSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid request data");

  const { wallet, marketPubkey } = parsed.data;

  try {
    if (db) {
      const existing = await db
        .select()
        .from(watchlist)
        .where(and(eq(watchlist.wallet, wallet), eq(watchlist.marketPubkey, marketPubkey)));

      if (existing.length > 0) {
        await db
          .delete(watchlist)
          .where(and(eq(watchlist.wallet, wallet), eq(watchlist.marketPubkey, marketPubkey)));
        return ok({ ok: true, action: "removed", isWatched: false });
      }

      await db.insert(watchlist).values({ wallet, marketPubkey, createdAt: new Date() });
      return ok({ ok: true, action: "added", isWatched: true });
    }
  } catch (e) {
    console.warn("Watchlist POST error:", e);
  }
  return ok({ ok: true, action: "error", isWatched: false, error: "Database unavailable" });
});
