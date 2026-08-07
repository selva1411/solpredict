export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { assertDb } from "@/lib/db/client";
import { marketsCache, treasuryLedger } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ok, badRequest, notFound, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

const RECLAIM_COOLDOWN_MS = 7 * 24 * 3600 * 1000;

/**
 * POST /api/markets/[id]/reclaim
 *
 * Reclaims rent deposit for a settled/cancelled market after the 7-day cooldown.
 */
export const POST = apiHandler(async (req: NextRequest, context: { params?: Promise<Record<string, string>> } = {}) => {
  const params = await context.params;
  const marketPubkey = params?.id;
  if (!marketPubkey) return badRequest("Market ID required");

  const creator = req.headers.get("x-wallet");
  if (!creator || creator.length < 32) {
    return badRequest("x-wallet header required");
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

    const rentLamports = market.rentDepositLamports ?? 24_000_000;

    // Update market record
    await db
      .update(marketsCache)
      .set({
        rentReclaimedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(marketsCache.marketPubkey, marketPubkey));

    // Audit in treasury ledger
    await db.insert(treasuryLedger).values({
      direction: "out",
      kind: "rent",
      amount: rentLamports,
      marketPubkey,
      actor: creator,
      note: `Rent deposit reclaimed by creator ${creator}`,
    });

    return ok({
      ok: true,
      rentLamports,
      rentSol: rentLamports / 1e9,
      marketPubkey,
      message: "Rent deposit reclaimed successfully",
    });
  } catch (err) {
    return serverError(err);
  }
});
