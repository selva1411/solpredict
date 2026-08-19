import { db } from '@/lib/db/client';
import { disputes, marketsCache } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';

export async function getMarketDisputes(marketPubkey: string) {
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select()
    .from(disputes)
    .where(eq(disputes.marketPubkey, marketPubkey))
    .orderBy(desc(disputes.createdAt));

  return rows.map((d) => ({
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
  }));
}

export interface NewDispute {
  marketPubkey: string;
  disputer: string;
  claimedOutcome: string;
  reason: string;
  evidenceUrl: string | null;
  bondLamports: number;
}

/**
 * Insert a dispute and freeze the market in 'disputed' status so reward
 * claims are paused pending review.
 */
export async function submitDispute(input: NewDispute) {
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .insert(disputes)
    .values({
      marketPubkey: input.marketPubkey,
      disputer: input.disputer,
      claimedOutcome: input.claimedOutcome,
      reason: input.reason,
      evidenceUrl: input.evidenceUrl,
      evidence: input.evidenceUrl,
      bondLamports: input.bondLamports,
      status: "open",
      createdAt: new Date(),
    })
    .returning();

  await db
    .update(marketsCache)
    .set({ status: "disputed", updatedAt: new Date() })
    .where(eq(marketsCache.marketPubkey, input.marketPubkey));

  return row;
}

export async function getDisputesByStatus(status?: string, limit = 100) {
  if (!db) throw new Error("Database not available");
  const rows = await db.select().from(disputes)
    .where(status ? eq(disputes.status, status) : undefined)
    .orderBy(desc(disputes.createdAt))
    .limit(limit);

  const marketKeys = [...new Set(rows.map((d) => d.marketPubkey))];
  const markets = marketKeys.length
    ? await db.select().from(marketsCache).where(
        and(...marketKeys.map((k) => eq(marketsCache.marketPubkey, k)))
      )
    : [];

  const marketByKey = new Map(markets.map((m) => [m.marketPubkey, m]));

  return {
    total: rows.length,
    disputes: rows.map((d) => ({
      id: d.id,
      marketPubkey: d.marketPubkey,
      marketQuestion: marketByKey.get(d.marketPubkey)?.question ?? null,
      disputer: d.disputer,
      reason: d.reason,
      evidence: d.evidence,
      status: d.status,
      resolution: d.resolution,
      resolvedBy: d.resolvedBy,
      createdAt: d.createdAt,
      resolvedAt: d.resolvedAt,
    })),
  };
}

export async function resolveDispute(id: number, status: string, resolution: string, resolvedBy: string) {
  if (!db) throw new Error("Database not available");
  const [existing] = await db.select().from(disputes).where(eq(disputes.id, id)).limit(1);
  if (!existing) return null;

  const [row] = await db.update(disputes)
    .set({
      status,
      resolution: resolution.trim() || existing.resolution,
      resolvedBy,
      resolvedAt: status === 'pending' ? null : new Date(),
    })
    .where(eq(disputes.id, id))
    .returning();
  return row;
}
