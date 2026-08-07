export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { assertDb } from "@/lib/db/client";
import { disputes, marketsCache } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ok, badRequest, serverError, notFound } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { disputeBodySchema } from "@/lib/api/contracts";

export const GET = apiHandler(async (_req: NextRequest, context: { params?: Promise<Record<string, string>> } = {}) => {
  const params = await context.params;
  const marketPubkey = params?.id;
  if (!marketPubkey) return badRequest("Market ID required");

  try {
    const db = assertDb();
    const rows = await db
      .select()
      .from(disputes)
      .where(eq(disputes.marketPubkey, marketPubkey))
      .orderBy(desc(disputes.createdAt));

    return ok({
      ok: true,
      disputes: rows.map((d) => ({
        id: d.id,
        marketPubkey: d.marketPubkey,
        disputer: d.disputer,
        claimedOutcome: d.claimedOutcome,
        reason: d.reason,
        evidenceUrl: d.evidenceUrl ?? d.evidence,
        status: d.status,
        resolution: d.resolution,
        resolutionNote: d.resolutionNote,
        createdAt: d.createdAt,
        resolvedAt: d.resolvedAt,
      })),
    });
  } catch (err) {
    return serverError(err);
  }
}, { cacheMaxAge: 10 });

export const POST = apiHandler(async (req: NextRequest, context: { params?: Promise<Record<string, string>> } = {}) => {
  const params = await context.params;
  const marketPubkey = params?.id;
  if (!marketPubkey) return badRequest("Market ID required");

  const disputer = req.headers.get("x-wallet");
  if (!disputer || disputer.length < 32) {
    return badRequest("x-wallet header required to dispute settlement");
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const parsed = disputeBodySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return badRequest(`Validation failed: ${issue.path.join(".")} — ${issue.message}`);
  }

  const { claimedOutcome, evidenceUrl, reason } = parsed.data;

  try {
    const db = assertDb();
    const [market] = await db
      .select()
      .from(marketsCache)
      .where(eq(marketsCache.marketPubkey, marketPubkey))
      .limit(1);

    if (!market) return notFound("Market not found");

    if (market.status !== "settled") {
      return badRequest(`Only settled markets can be disputed. Current status: ${market.status}`);
    }

    // Dispute window check: 24h (86400s) after settledAt
    const settledAtTs = market.settledAt ? new Date(market.settledAt).getTime() : Date.now();
    const disputeWindowMs = 86400 * 1000;
    if (Date.now() > settledAtTs + disputeWindowMs) {
      return badRequest("Dispute window has expired (must dispute within 24 hours of settlement)");
    }

    // Insert dispute record
    const [row] = await db
      .insert(disputes)
      .values({
        marketPubkey,
        disputer,
        claimedOutcome,
        reason,
        evidenceUrl: evidenceUrl ?? null,
        evidence: evidenceUrl ?? null,
        bondLamports: 100_000_000, // 0.1 SOL dispute bond
        status: "open",
        createdAt: new Date(),
      })
      .returning();

    // Flip market status to 'disputed' to freeze reward claims
    await db
      .update(marketsCache)
      .set({
        status: "disputed",
        updatedAt: new Date(),
      })
      .where(eq(marketsCache.marketPubkey, marketPubkey));

    return ok(
      {
        ok: true,
        dispute: row,
        message: "Dispute submitted successfully. Market reward claims are now frozen pending review.",
      },
      { status: 201 }
    );
  } catch (err) {
    return serverError(err);
  }
});
