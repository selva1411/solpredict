export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { setPlatformPaused, setMarketStatus, logAuditEntry } from "@/lib/data/admin";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler, getClientIp } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/admin-guard";

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
    if (pauseScope === "global") {
      await setPlatformPaused(false, null);
      await logAuditEntry(
        "EMERGENCY_UNPAUSE_GLOBAL",
        guard.identity.wallet,
        "global",
        { scope: "global" },
        ip,
      );

      return ok({
        ok: true,
        scope: "global",
        paused: false,
        message: "GLOBAL EMERGENCY UNPAUSED. Protocol operations resumed.",
      });
    }

    if (!marketPubkey) return badRequest("marketPubkey required for market scope unpause");

    await setMarketStatus(marketPubkey, "open");
    await logAuditEntry(
      "EMERGENCY_UNPAUSE_MARKET",
      guard.identity.wallet,
      marketPubkey,
      { scope: "market", marketPubkey },
      ip,
    );

    return ok({
      ok: true,
      scope: "market",
      marketPubkey,
      paused: false,
      message: `Market ${marketPubkey} unpaused.`,
    });
  } catch (err) {
    return serverError(err);
  }
});
