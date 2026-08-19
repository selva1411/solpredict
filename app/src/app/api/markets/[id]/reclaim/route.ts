export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { assertDb } from "@/lib/db/client";
import { marketsCache, treasuryLedger } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ok, badRequest, notFound } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { verifyRentReclaimSignature } from "@/lib/indexer/onchain";

const RECLAIM_COOLDOWN_MS = 7 * 24 * 3600 * 1000;

/**
 * POST /api/markets/[id]/reclaim
 *
 * Records a rent-deposit reclaim for a settled/cancelled market after the
 * 7-day cooldown. The reclaim is ONLY recorded after the market account has
 * actually been closed on-chain (balance 0) — the transaction that closed it
 * must be submitted as `signature` and is verified via RPC. The ledger entry
 * is written only after that verification succeeds; the endpoint never claims
 * a reclaim that did not happen.
 */
export const POST = apiHandler(async (req: NextRequest, context: { params?: Promise<Record<string, string>> } = {}) => {
  const params = await context.params;
  const marketPubkey = params?.id;
  if (!marketPubkey) return badRequest("Market ID required");

  const creator = req.headers.get("x-wallet");
  if (!creator || creator.length < 32) {
    return badRequest("x-wallet header required");
  }

  const body = await req.json().catch(() => ({}));
  const signature = typeof body?.signature === "string" ? body.signature.trim() : "";
  if (!signature) {
    return badRequest(
      "signature (the confirmed transaction that closed the market account) is required to record a reclaim",
    );
  }

  try {
    const db = assertDb();
    const [market] = await db
      .select()
      .from(marketsCache)
      .where(eq(marketsCache.marketPubkey, marketPubkey))
      .limit(1);

    if (!market) return notFound("Market not found");

    if (market.status !== "settled" && market.status !== "cancelled") {
      return badRequest(`Market must be settled or cancelled. Current status: ${market.status}`);
    }

    if (market.rentReclaimedAt) {
      return badRequest("Rent deposit has already been reclaimed for this market");
    }

    const settledAtTs = market.settledAt ? new Date(market.settledAt).getTime() : 0;
    if (Date.now() < settledAtTs + RECLAIM_COOLDOWN_MS) {
      return badRequest("7-day cooldown period has not elapsed yet");
    }

    // The market account must be verifiably closed on-chain before the DB and
    // ledger reflect the reclaim.
    const verified = await verifyRentReclaimSignature(signature, marketPubkey);

    const rentLamports = market.rentDepositLamports ?? 0;

    await db
      .update(marketsCache)
      .set({
        rentReclaimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(marketsCache.marketPubkey, marketPubkey));

    await db.insert(treasuryLedger).values({
      signature: verified.signature,
      direction: "out",
      kind: "rent",
      amount: rentLamports,
      marketPubkey,
      actor: creator,
      note: `Rent deposit reclaimed by creator ${creator} (market account closed on-chain)`,
    });

    return ok({
      ok: true,
      rentLamports,
      rentSol: rentLamports / 1e9,
      marketPubkey,
      verified: true,
      message: "Rent deposit reclaimed successfully (market account closed on-chain)",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return ok({ ok: false, error: msg }, { status: 400 } as ResponseInit);
  }
});
