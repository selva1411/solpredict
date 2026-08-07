export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { marketsCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ok, badRequest, notFound, serviceUnavailable } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/admin-guard";

export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  if (!db) return serviceUnavailable('Database not available');
  const rows = await db.select().from(marketsCache).orderBy(marketsCache.marketId);
  return ok({
    ok: true,
    markets: rows.map(r => ({
      marketPubkey: r.marketPubkey,
      marketId: r.marketId,
      question: r.question,
      description: r.description,
      category: r.category,
      status: r.status,
      winningOutcome: r.winningOutcome,
      totalVolume: Number(r.totalVolume || 0),
      endTs: r.endTs,
      resolveTs: r.resolveTs,
      thumbnailUrl: r.thumbnailUrl,
      tags: r.tags,
      viewCount: r.viewCount,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    })),
  });
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  if (!db) return badRequest("Database not available");

  const body = await req.json();
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const { marketPubkey, question, description, category, status, winningOutcome, thumbnailUrl, tags } = body;
  if (!marketPubkey) return badRequest("marketPubkey is required");

  const existing = await db.select().from(marketsCache).where(eq(marketsCache.marketPubkey, marketPubkey)).limit(1);
  if (existing.length === 0) return notFound("Market not found in cache");

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (question !== undefined) updateData.question = question;
  if (description !== undefined) updateData.description = description;
  if (category !== undefined) updateData.category = category;
  if (status !== undefined) updateData.status = status;
  if (winningOutcome !== undefined) updateData.winningOutcome = String(winningOutcome).toLowerCase();
  if (thumbnailUrl !== undefined) updateData.thumbnailUrl = thumbnailUrl;
  if (tags !== undefined) updateData.tags = tags;

  const [updated] = await db
    .update(marketsCache)
    .set(updateData)
    .where(eq(marketsCache.marketPubkey, marketPubkey))
    .returning();

  return ok({ ok: true, market: updated });
});
