export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getMarketList } from "@/lib/data/markets";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { getDb } from "@/lib/db/client";
import { marketsCache } from "@/lib/db/schema";
import { getMarketPda } from "@/lib/pda";
import { ENV } from "@/lib/env";
import * as anchor from "@coral-xyz/anchor";
import { sql } from "drizzle-orm";

export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") ?? undefined;
  const status = searchParams.get("status") ?? "open";
  const search = searchParams.get("search") ?? undefined;
  const sort = searchParams.get("sort") ?? "newest";
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));

  try {
    const { markets, total } = await getMarketList({
      category,
      status,
      search,
      sort,
      page,
      limit,
    });

    return ok({
      ok: true,
      markets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return serverError(err);
  }
}, { cacheMaxAge: 10 });

export const POST = apiHandler(async (req: NextRequest) => {
  const db = getDb();
  if (!db) return serverError("Database not configured");

  try {
    const body = await req.json();
    const { question, description, category, endTs, resolveTs, thumbnailUrl, tags, marketPubkey } = body;

    if (!question || !endTs) {
      return ok({ ok: false, error: "question and endTs are required" }, { status: 400 });
    }

    const countRes = await db.select({ count: sql<number>`COUNT(*)::int` }).from(marketsCache);
    const nextId = (countRes[0]?.count ?? 0) + 1;
    const pubkey = marketPubkey || getMarketPda(new anchor.BN(nextId), ENV.programId).toBase58();

    const [inserted] = await db.insert(marketsCache).values({
      marketPubkey: pubkey,
      marketId: nextId,
      question: String(question),
      description: description ? String(description) : null,
      category: category ? String(category) : "Crypto",
      status: "open",
      endTs: new Date(endTs),
      resolveTs: resolveTs ? new Date(resolveTs) : new Date(endTs),
      thumbnailUrl: thumbnailUrl ?? null,
      tags: tags ?? null,
    }).returning();

    return ok({ ok: true, market: inserted }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
});
