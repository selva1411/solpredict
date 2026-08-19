export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getMarketList } from "@/lib/data/markets";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/admin-guard";
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

/**
 * POST /api/markets
 *
 * Direct DB market creation — ADMIN ONLY. Markets are normally created via
 * the on-chain initialize_market / approve_market flow and mirrored by the
 * indexer; this route exists for admin seeding and must never be callable by
 * unauthenticated clients (the previous version let anyone inject markets,
 * with a race-prone COUNT(*)+1 market id and a client-chosen pubkey).
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const db = getDb();
  if (!db) return serverError("Database not configured");

  try {
    const body = await req.json().catch(() => null);
    if (!body) return ok({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    const { question, description, category, endTs, resolveTs, thumbnailUrl, tags, marketPubkey } = body;

    if (!question || !endTs) {
      return ok({ ok: false, error: "question and endTs are required" }, { status: 400 });
    }

    const countRes = await db.select({ count: sql<number>`COUNT(*)::int` }).from(marketsCache);
    const nextId = (countRes[0]?.count ?? 0) + 1;
    // market_pubkey must be the REAL PDA for this id — a client-supplied
    // pubkey is never trusted.
    const pubkey = getMarketPda(new anchor.BN(nextId), ENV.programId).toBase58();

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
