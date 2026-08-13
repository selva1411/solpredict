export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { serverError, ok } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';
import { getRecentActivity } from '@/lib/data/users';

export const GET = apiHandler(async (req: NextRequest) => {
  try {
    const wallet = req.nextUrl.searchParams.get("wallet")?.trim() ?? null;
    const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || "50"), 200);

    const activities = await getRecentActivity(wallet, limit);
    return ok({ ok: true, activities });
  } catch (err) {
    return serverError(err);
  }
}, { cacheMaxAge: 15, cacheTags: ["activity"] });
