export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { resolveDisputeAdmin } from "@/lib/data/admin";
import { ok, badRequest, notFound, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/admin-guard";

/**
 * POST /api/admin/disputes/[id]/resolve
 *
 * Resolves a settlement dispute.
 * Body: { action: 'upheld' | 'rejected', winningOutcome?: 'YES' | 'NO', note?: string }
 *
 * If upheld -> refund bond + reward disputer, update market winning outcome, set status back to settled.
 * If rejected -> forfeit bond to treasury ledger, restore market status to settled.
 */
export const POST = apiHandler(async (req: NextRequest, context: { params?: Promise<Record<string, string>> } = {}) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const params = await context.params;
  const disputeIdStr = params?.id;
  if (!disputeIdStr) return badRequest("Dispute ID required");

  const body = await req.json().catch(() => ({}));
  const { action, winningOutcome, note } = body as {
    action?: "upheld" | "rejected";
    winningOutcome?: "YES" | "NO" | "yes" | "no";
    note?: string;
  };

  if (!action || (action !== "upheld" && action !== "rejected")) {
    return badRequest("action must be 'upheld' or 'rejected'");
  }

  const noteValue: string = typeof note === "string" ? note : "";

  try {
    const result = await resolveDisputeAdmin({
      disputeId: Number(disputeIdStr),
      action,
      winningOutcome,
      note: noteValue,
      resolver: guard.identity.wallet,
    });

    if (result === null) return notFound("Dispute not found");
    if ("error" in result) return badRequest(result.error || "Dispute cannot be resolved");

    return ok({
      ok: true,
      action: result.action,
      disputeId: Number(disputeIdStr),
      winningOutcome: result.winningOutcome,
      message:
        result.action === "upheld"
          ? "Dispute upheld. Market settled outcome updated, bond refunded to disputer."
          : "Dispute rejected. Bond forfeited to treasury, market un-frozen.",
    });
  } catch (err) {
    return serverError(err);
  }
});
