export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { adminSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { ok, badRequest, serviceUnavailable, serverError } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';
import { requireAdmin } from '@/lib/admin-guard';

export const GET = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  if (!db) {
    return serviceUnavailable('Database not available');
  }

  try {
    const rows = await db.select().from(adminSettings);
    const settingsMap: Record<string, string> = {};
    rows.forEach(r => { settingsMap[r.key] = r.value; });

    return ok({
      ok: true,
      // Raw map for dynamic rendering by the settings page
      settings: settingsMap,
      // Structured for backward compat with existing consumers
      structured: {
        feeBps: Number(settingsMap.feeBps || 200),
        adminWallet: settingsMap.adminWallet || process.env.ADMIN_WALLET || '',
        platformName: settingsMap.platformName || 'PREDICT-X',
        maintenanceMode: settingsMap.maintenanceMode === 'true',
        maxMarketDuration: Number(settingsMap.maxMarketDuration || 2592000),
        minMarketDuration: Number(settingsMap.minMarketDuration || 300),
      },
    });
  } catch (e) {
    return serverError(e);
  }
});

export const PATCH = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  if (!db) return badRequest("Database not available");

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const wallet = req.headers.get("x-wallet") || "";
  const allowedKeys = [
    'feeBps', 'adminWallet', 'platformName', 'maintenanceMode',
    'maxMarketDuration', 'minMarketDuration', 'minLiquiditySol',
    'resolutionDelaySec', 'disputePeriodSec', 'twitterShareEnabled',
  ];

  for (const [key, value] of Object.entries(body)) {
    if (!allowedKeys.includes(key)) continue;
    const strValue = String(value);
    
    const existing = await db.select().from(adminSettings).where(eq(adminSettings.key, key)).limit(1);
    if (existing.length > 0) {
      await db.update(adminSettings).set({
        value: strValue,
        updatedBy: wallet,
        updatedAt: new Date(),
      }).where(eq(adminSettings.key, key));
    } else {
      await db.insert(adminSettings).values({
        key,
        value: strValue,
        updatedBy: wallet,
        updatedAt: new Date(),
      });
    }
  }

  return ok({ ok: true });
});

/** POST: upsert a single key-value pair */
export const POST = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;
  if (!db) return badRequest("Database not available");

  const body = await req.json().catch(() => null);
  if (!body?.key) return badRequest("key is required");

  const wallet = req.headers.get("x-wallet") || "";
  const { key, value } = body;

  const existing = await db.select().from(adminSettings).where(eq(adminSettings.key, key)).limit(1);
  if (existing.length > 0) {
    await db.update(adminSettings).set({
      value: String(value ?? ''),
      updatedBy: wallet,
      updatedAt: new Date(),
    }).where(eq(adminSettings.key, key));
  } else {
    await db.insert(adminSettings).values({
      key,
      value: String(value ?? ''),
      updatedBy: wallet,
      updatedAt: new Date(),
    });
  }

  return ok({ ok: true });
});

