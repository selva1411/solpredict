export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { reviewProposal } from "@/lib/data/admin";
import { ok, badRequest, notFound, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireAdmin } from "@/lib/admin-guard";

/**
 * POST /api/admin/proposals/[id]/approve
 *
 * Approves a market proposal. Admin only.
 */
export const POST = apiHandler(async (req: NextRequest, context: { params?: Promise<Record<string, string>> } = {}) => {
  const guard = await requireAdmin(req);
  if (!guard.ok) return guard.response;

  const params = await context.params;
  const idStr = params?.id;
  if (!idStr) return badRequest("Proposal ID or pubkey required");

  const body = await req.json().catch(() => ({}));
  const reviewNote = String(body.reviewNote || body.note || "Approved by admin");

  try {
    const result = await reviewProposal({
      idOrPubkey: idStr,
      status: "approved",
      reviewer: guard.identity.wallet,
      note: reviewNote,
    });

    if (result === null) return notFound("Market proposal not found");
    if ("error" in result) return badRequest(result.error || "Proposal cannot be approved");

    return ok({
      ok: true,
      proposal: result.proposal,
      message: "Proposal approved successfully",
    });
  } catch (err) {
    return serverError(err);
  }
});
