export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { assertDb } from "@/lib/db/client";
import { disputes, marketsCache, treasuryLedger } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

  try {
    const db = assertDb();
    const disputeId = Number(disputeIdStr);

    const [dispute] = await db
      .select()
      .from(disputes)
      .where(eq(disputes.id, disputeId))
      .limit(1);

    if (!dispute) return notFound("Dispute not found");
    if (dispute.status !== "open" && dispute.status !== "pending") {
      return badRequest(`Dispute is already ${dispute.status}`);
    }

    const resolutionNote = note || `Dispute ${action} by admin`;
    const bondLamports = dispute.bondLamports ?? 100_000_000; // 0.1 SOL

    if (action === "upheld") {
      const finalOutcome = (winningOutcome || dispute.claimedOutcome || "YES").toLowerCase();

      // Update dispute record
      await db
        .update(disputes)
        .set({
          status: "upheld",
          resolution: resolutionNote,
          resolutionNote,
          resolver: guard.identity.wallet,
          resolvedBy: guard.identity.wallet,
          resolvedAt: new Date(),
        })
        .where(eq(disputes.id, disputeId));

      // Update market status and winning outcome
      await db
        .update(marketsCache)
        .set({
          status: "settled",
          winningOutcome: finalOutcome,
          updatedAt: new Date(),
        })
        .where(eq(marketsCache.marketPubkey, dispute.marketPubkey));

      // Treasury ledger entry for bond refund
      await db.insert(treasuryLedger).values({
        direction: "out",
        kind: "bond_forfeit", // refund to disputer
        amount: bondLamports,
        marketPubkey: dispute.marketPubkey,
        actor: dispute.disputer,
        note: `Dispute upheld: bond refunded + reward issued for market ${dispute.marketPubkey}`,
      });

      return ok({
        ok: true,
        action: "upheld",
        disputeId,
        winningOutcome: finalOutcome,
        message: "Dispute upheld. Market settled outcome updated, bond refunded to disputer.",
      });
    } else {
      // Dispute rejected
      await db
        .update(disputes)
        .set({
          status: "rejected",
          resolution: resolutionNote,
          resolutionNote,
          resolver: guard.identity.wallet,
          resolvedBy: guard.identity.wallet,
          resolvedAt: new Date(),
        })
        .where(eq(disputes.id, disputeId));

      // Restore market status to settled
      await db
        .update(marketsCache)
        .set({
          status: "settled",
          updatedAt: new Date(),
        })
        .where(eq(marketsCache.marketPubkey, dispute.marketPubkey));

      // Treasury ledger entry for forfeited bond
      await db.insert(treasuryLedger).values({
        direction: "in",
        kind: "bond_forfeit",
        amount: bondLamports,
        marketPubkey: dispute.marketPubkey,
        actor: dispute.disputer,
        note: `Dispute rejected: bond forfeited to treasury for market ${dispute.marketPubkey}`,
      });

      return ok({
        ok: true,
        action: "rejected",
        disputeId,
        message: "Dispute rejected. Bond forfeited to treasury, market un-frozen.",
      });
    }
  } catch (err) {
    return serverError(err);
  }
});
