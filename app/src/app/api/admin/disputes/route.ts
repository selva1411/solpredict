export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { disputes, marketsCache } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { ok, badRequest, serverError, serviceUnavailable, notFound } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';
import { requireAdmin } from '@/lib/admin-guard';

export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  if (!db) return serviceUnavailable('Database not available');

  try {
    const status = req.nextUrl.searchParams.get('status');
    const rows = await db.select().from(disputes)
      .where(status ? eq(disputes.status, status) : undefined)
      .orderBy(desc(disputes.createdAt))
      .limit(100);

    const marketKeys = [...new Set(rows.map((d) => d.marketPubkey))];
    const markets = marketKeys.length
      ? await db.select().from(marketsCache).where(
          and(...marketKeys.map((k) => eq(marketsCache.marketPubkey, k)))
        )
      : [];

    const marketByKey = new Map(markets.map((m) => [m.marketPubkey, m]));

    return ok({
      ok: true,
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
    });
  } catch (err) {
    return serverError(err);
  }
}, { cacheMaxAge: 10 });

export const PATCH = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  if (!db) return serviceUnavailable('Database not available');

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

    const { id, status, resolution } = body as { id?: number; status?: string; resolution?: string };
    if (!id) return badRequest('id is required');

    const allowed = ['pending', 'resolved', 'rejected'];
    if (!status || !allowed.includes(status)) return badRequest(`status must be one of ${allowed.join(', ')}`);

    const [existing] = await db.select().from(disputes).where(eq(disputes.id, Number(id))).limit(1);
    if (!existing) return notFound('Dispute not found');

    const [row] = await db.update(disputes)
      .set({
        status,
        resolution: resolution?.trim() || existing.resolution,
        resolvedBy: guard.identity.wallet,
        resolvedAt: status === 'pending' ? null : new Date(),
      })
      .where(eq(disputes.id, Number(id)))
      .returning();

    return ok({ ok: true, dispute: row });
  } catch (err) {
    return serverError(err);
  }
});
