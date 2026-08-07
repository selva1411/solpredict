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
 * POST /api/admin/emergency/unpause
 *
 * Unpauses protocol globally or per-market. Admin only.
 * Body: { scope: 'global' | 'market', marketPubkey?: string }
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => ({}));
  const { scope, marketPubkey } = body as {
    scope?: "global" | "market";
    marketPubkey?: string;
  };

  const pauseScope = scope || "global";
  const ip = getClientIp(req);

  try {
    const db = assertDb();

    if (pauseScope === "global") {
      const existing = await db.select().from(platformConfig).limit(1);
      if (existing.length > 0) {
        await db
          .update(platformConfig)
          .set({
            paused: false,
            pauseReason: null,
            updatedAt: new Date(),
          })
          .where(eq(platformConfig.id, existing[0].id));
      }

      await db.insert(auditLog).values({
        action: "EMERGENCY_UNPAUSE_GLOBAL",
        actor: guard.identity.wallet,
        resource: "global",
        details: { scope: "global" },
        ip,
      });

      return ok({
        ok: true,
        scope: "global",
        paused: false,
        message: "GLOBAL EMERGENCY UNPAUSED. Protocol operations resumed.",
      });
    } else {
      if (!marketPubkey) return badRequest("marketPubkey required for market scope unpause");

      await db
        .update(marketsCache)
        .set({
          status: "open",
          updatedAt: new Date(),
        })
        .where(eq(marketsCache.marketPubkey, marketPubkey));

      await db.insert(auditLog).values({
        action: "EMERGENCY_UNPAUSE_MARKET",
        actor: guard.identity.wallet,
        resource: marketPubkey,
        details: { scope: "market", marketPubkey },
        ip,
      });

      return ok({
        ok: true,
        scope: "market",
        marketPubkey,
        paused: false,
        message: `Market ${marketPubkey} unpaused.`,
      });
    }
  } catch (err) {
    return serverError(err);
  }
});
