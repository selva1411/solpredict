export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { setPlatformPaused, setMarketStatus, logAuditEntry } from "@/lib/data/admin";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler, getClientIp } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/admin-guard";

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
    if (pauseScope === "global") {
      await setPlatformPaused(true, reason.trim());
      await logAuditEntry(
        "EMERGENCY_PAUSE_GLOBAL",
        guard.identity.wallet,
        "global",
        { reason: reason.trim(), scope: "global" },
        ip,
      );

      return ok({
        ok: true,
        scope: "global",
        paused: true,
        reason: reason.trim(),
        message: "GLOBAL EMERGENCY PAUSE ACTIVATED. All state-changing operations are now blocked.",
      });
    }

    if (!marketPubkey) return badRequest("marketPubkey required for market scope pause");

    await setMarketStatus(marketPubkey, "paused");
    await logAuditEntry(
      "EMERGENCY_PAUSE_MARKET",
      guard.identity.wallet,
      marketPubkey,
      { reason: reason.trim(), scope: "market", marketPubkey },
      ip,
    );

    return ok({
      ok: true,
      scope: "market",
      marketPubkey,
      paused: true,
      reason: reason.trim(),
      message: `Market ${marketPubkey} paused successfully.`,
    });
  } catch (err) {
    return serverError(err);
  }
});
