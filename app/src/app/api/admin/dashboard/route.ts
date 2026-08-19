export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { getAdminDashboard } from '@/lib/data/admin';
import { ok, serverError } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';
import { requireAdmin } from '@/lib/admin-guard';

export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const { stats } = await getAdminDashboard();
    return ok({ ok: true, stats });
  } catch (err) {
    return serverError(err);
  }
});
