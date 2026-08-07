export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { assertDb } from "@/lib/db/client";
import { marketProposals } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ok, badRequest, notFound, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/admin-guard";

/**
 * POST /api/admin/proposals/[id]/reject
 *
 * Rejects a market proposal with a review note / rejection reason. Admin only.
 */
export const POST = apiHandler(async (req: NextRequest, context: { params?: Promise<Record<string, string>> } = {}) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const params = await context.params;
  const idStr = params?.id;
  if (!idStr) return badRequest("Proposal ID or pubkey required");

  const body = await req.json().catch(() => ({}));
  const rejectionReason = body.rejectionReason || body.reviewNote || body.reason || "Rejected by admin";

  try {
    const db = assertDb();
    const id = Number(idStr);

    let proposal;
    if (!isNaN(id)) {
      [proposal] = await db.select().from(marketProposals).where(eq(marketProposals.id, id)).limit(1);
    } else {
      [proposal] = await db.select().from(marketProposals).where(eq(marketProposals.proposalPubkey, idStr)).limit(1);
    }

    if (!proposal) {
      return notFound("Market proposal not found");
    }

    if (proposal.status !== "pending") {
      return badRequest(`Proposal is already ${proposal.status}`);
    }

    const [updated] = await db
      .update(marketProposals)
      .set({
        status: "rejected",
        reviewer: guard.identity.wallet,
        reviewNote: rejectionReason,
        rejectionReason,
        reviewedAt: new Date(),
      })
      .where(eq(marketProposals.id, proposal.id))
      .returning();

    return ok({
      ok: true,
      proposal: updated,
      message: "Proposal rejected",
    });
  } catch (err) {
    return serverError(err);
  }
});
