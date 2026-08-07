export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { assertDb } from "@/lib/db/client";
import { marketProposals } from "@/lib/db/schema";
import { proposeMarketBodySchema } from "@/lib/api/contracts";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

/**
 * POST /api/markets/propose
 *
 * Submits a new market proposal. Validates question length, category, close timestamp,
 * and oracle feed format per spec §3.1.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const parsed = proposeMarketBodySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return badRequest(`Validation failed: ${issue.path.join(".")} — ${issue.message}`);
  }

  const { question, description, category, closeTs, oracleFeedId, outcomes } = parsed.data;

  // Validate closeTs is in the future (at least 1 hour from now)
  const minFuture = Date.now() + 3600 * 1000;
  if (closeTs * 1000 < minFuture) {
    return badRequest("End timestamp must be at least 1 hour in the future");
  }

  // Validate unique outcome labels if provided
  if (outcomes && outcomes.length > 0) {
    const uniqueLabels = new Set(outcomes.map((o) => o.trim().toLowerCase()));
    if (uniqueLabels.size !== outcomes.length) {
      return badRequest("Outcome labels must be unique");
    }
  }

  // Validate 64-char hex oracle feed ID format if provided
  if (oracleFeedId && !/^[0-9a-fA-F]{64}$/.test(oracleFeedId)) {
    return badRequest("Oracle feed ID must be a 64-character hex string");
  }

  const proposer = req.headers.get("x-wallet");
  if (!proposer || proposer.length < 32) {
    return badRequest("x-wallet header required to propose a market");
  }

  try {
    const db = assertDb();
    const proposalPubkey = req.headers.get("x-proposal-pubkey") || `prop_${Date.now()}_${proposer.slice(0, 8)}`;

    const [proposal] = await db
      .insert(marketProposals)
      .values({
        proposalPubkey,
        proposer,
        question,
        description: description ?? null,
        category: category ?? "Crypto",
        oracleFeedId: oracleFeedId ?? null,
        endTs: new Date(closeTs * 1000),
        resolveTs: new Date(closeTs * 1000 + 3600 * 1000), // default +1h for resolution
        bondLamports: 100_000_000, // 0.1 SOL proposal bond
        status: "pending",
      })
      .returning();

    return ok({
      ok: true,
      proposal,
      bondLamports: 100_000_000,
      instructions: "Sign and submit propose_market transaction on-chain",
    }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
});
