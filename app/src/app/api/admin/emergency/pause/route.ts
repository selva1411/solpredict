export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { assertDb } from "@/lib/db/client";
import { platformConfig, auditLog, marketsCache } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/admin-guard";
import { getClientIp } from "@/lib/api-handler";

/**
 * POST /api/admin/emergency/pause
 *
 * Pauses protocol globally or per-market. Admin only.
 * Body: { scope: 'global' | 'market', marketPubkey?: string, reason: string }
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const { scope, marketPubkey, reason } = body as {
    scope?: "global" | "market";
    marketPubkey?: string;
    reason?: string;
  };

  if (!reason || reason.trim().length === 0) {
    return badRequest("reason parameter required for emergency pause");
  }

  const pauseScope = scope || "global";
  const ip = getClientIp(req);

  try {
    const db = assertDb();

    if (pauseScope === "global") {
      // Upsert platform_config single row
      const existing = await db.select().from(platformConfig).limit(1);
      if (existing.length === 0) {
        await db.insert(platformConfig).values({
          paused: true,
          pauseReason: reason.trim(),
        });
      } else {
        await db
          .update(platformConfig)
          .set({
            paused: true,
            pauseReason: reason.trim(),
            updatedAt: new Date(),
          })
          .where(eq(platformConfig.id, existing[0].id));
      }

      // Log in immutable audit log
      await db.insert(auditLog).values({
        action: "EMERGENCY_PAUSE_GLOBAL",
        actor: guard.identity.wallet,
        resource: "global",
        details: { reason: reason.trim(), scope: "global" },
        ip,
      });

      return ok({
        ok: true,
        scope: "global",
        paused: true,
        reason: reason.trim(),
        message: "GLOBAL EMERGENCY PAUSE ACTIVATED. All state-changing operations are now blocked.",
      });
    } else {
      if (!marketPubkey) return badRequest("marketPubkey required for market scope pause");

      await db
        .update(marketsCache)
        .set({
          status: "paused",
          updatedAt: new Date(),
        })
        .where(eq(marketsCache.marketPubkey, marketPubkey));

      await db.insert(auditLog).values({
        action: "EMERGENCY_PAUSE_MARKET",
        actor: guard.identity.wallet,
        resource: marketPubkey,
        details: { reason: reason.trim(), scope: "market", marketPubkey },
        ip,
      });

      return ok({
        ok: true,
        scope: "market",
        marketPubkey,
        paused: true,
        reason: reason.trim(),
        message: `Market ${marketPubkey} paused successfully.`,
      });
    }
  } catch (err) {
    return serverError(err);
  }
});
