export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { getDisputesByStatus, resolveDispute } from '@/lib/data/disputes';
import { ok, badRequest, serverError, notFound } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';
import { requireAdmin } from '@/lib/admin-guard';

export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const status = req.nextUrl.searchParams.get('status') ?? undefined;
    const { total, disputes } = await getDisputesByStatus(status);
    return ok({ ok: true, total, disputes });
  } catch (err) {
    return serverError(err);
  }
}, { cacheMaxAge: 10 });

export const PATCH = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') return badRequest('Invalid JSON body');

    const { id, status, resolution } = body as { id?: number; status?: string; resolution?: string };
    if (!id) return badRequest('id is required');

    const allowed = ['pending', 'resolved', 'rejected'];
    if (!status || !allowed.includes(status)) return badRequest(`status must be one of ${allowed.join(', ')}`);

    const row = await resolveDispute(Number(id), status, resolution?.trim() ?? '', guard.identity.wallet);
    if (!row) return notFound('Dispute not found');

    return ok({ ok: true, dispute: row });
  } catch (err) {
    return serverError(err);
  }
});
