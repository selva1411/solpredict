export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getMarketDisputes, submitDispute } from "@/lib/data/disputes";
import { ok, badRequest, serverError, notFound } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { disputeBodySchema } from "@/lib/api/contracts";
import { getMarket } from "@/lib/data/markets";
import { requireUser } from "@/lib/user-guard";

export const GET = apiHandler(async (_req: NextRequest, context: { params?: Promise<Record<string, string>> } = {}) => {
  const params = await context.params;
  const marketPubkey = params?.id;
  if (!marketPubkey) return badRequest("Market ID required");

  try {
    const disputes = await getMarketDisputes(marketPubkey);
    return ok({ ok: true, disputes });
  } catch (err) {
    return serverError(err);
  }
}, { cacheMaxAge: 10 });

export const POST = apiHandler(async (req: NextRequest, context: { params?: Promise<Record<string, string>> } = {}) => {
  const params = await context.params;
  const marketPubkey = params?.id;
  if (!marketPubkey) return badRequest("Market ID required");

  const disputer = req.headers.get("x-wallet");
  if (!disputer || disputer.length < 32) {
    return badRequest("x-wallet header required to dispute settlement");
  }

  // The dispute must be filed by the wallet that signed the request — a
  // client can never file a dispute as another user.
  const auth = await requireUser(req, disputer);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const parsed = disputeBodySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return badRequest(`Validation failed: ${issue.path.join(".")} — ${issue.message}`);
  }

  const { claimedOutcome, evidenceUrl, reason } = parsed.data;

  try {
    const market = await getMarket(marketPubkey);
    if (!market) return notFound("Market not found");

    if (market.status !== "settled") {
      return badRequest(`Only settled markets can be disputed. Current status: ${market.status}`);
    }

    // Dispute window check: 24h (86400s) after settledAt
    const settledAtTs = market.settledAt ? new Date(market.settledAt).getTime() : Date.now();
    const disputeWindowMs = 86400 * 1000;
    if (Date.now() > settledAtTs + disputeWindowMs) {
      return badRequest("Dispute window has expired (must dispute within 24 hours of settlement)");
    }

    const row = await submitDispute({
      marketPubkey,
      disputer: auth.identity.wallet,
      claimedOutcome,
      reason,
      evidenceUrl: evidenceUrl ?? null,
      bondLamports: 100_000_000, // 0.1 SOL dispute bond
    });

    return ok(
      {
        ok: true,
        dispute: row,
        message: "Dispute submitted successfully. Market reward claims are now frozen pending review.",
      },
      { status: 201 }
    );
  } catch (err) {
    return serverError(err);
  }
});
