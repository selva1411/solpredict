export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { getAdminSettings, upsertAdminSetting } from '@/lib/data/admin';
import { ok, badRequest, serverError } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';
import { requireAdmin } from '@/lib/admin-guard';

const ALLOWED_KEYS = [
  'feeBps', 'adminWallet', 'platformName', 'maintenanceMode',
  'maxMarketDuration', 'minMarketDuration', 'minLiquiditySol',
  'resolutionDelaySec', 'disputePeriodSec', 'twitterShareEnabled',
];

export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  try {
    const { settings, structured } = await getAdminSettings();
    return ok({
      ok: true,
      settings,
      structured,
    });
  } catch (e) {
    return serverError(e);
  }
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const wallet = req.headers.get("x-wallet") || guard.identity.wallet;

  try {
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.includes(key)) continue;
      await upsertAdminSetting(key, String(value), wallet);
    }
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
});

/** POST: upsert a single key-value pair */
export const POST = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body?.key) return badRequest("key is required");

  const wallet = req.headers.get("x-wallet") || guard.identity.wallet;

  try {
    await upsertAdminSetting(body.key, String(body.value ?? ''), wallet);
    return ok({ ok: true });
  } catch (e) {
    return serverError(e);
  }
});
