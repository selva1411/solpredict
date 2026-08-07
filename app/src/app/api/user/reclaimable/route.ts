export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { assertDb } from "@/lib/db/client";
import { marketsCache } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

const RECLAIM_COOLDOWN_MS = 7 * 24 * 3600 * 1000; // 7 days post-settlement

/**
 * GET /api/user/reclaimable?wallet=
 *
 * Returns markets created by the wallet with rent deposit eligibility & reason per spec §3.3.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  if (!wallet || wallet.length < 32) {
    return badRequest("Valid wallet address required");
  }

  try {
    const db = assertDb();
    const rows = await db
      .select()
      .from(marketsCache)
      .where(eq(marketsCache.creator, wallet));

    const now = Date.now();

    const reclaimableMarkets = rows.map((m) => {
      const isSettledOrCancelled = m.status === "settled" || m.status === "cancelled";
      const alreadyReclaimed = m.rentReclaimedAt !== null && m.rentReclaimedAt !== undefined;
      const settledAtTs = m.settledAt ? new Date(m.settledAt).getTime() : 0;
      const cooldownPassed = now > settledAtTs + RECLAIM_COOLDOWN_MS;

      let eligible = false;
      let reason = "";

      if (alreadyReclaimed) {
        reason = "Rent deposit already reclaimed";
      } else if (!isSettledOrCancelled) {
        reason = `Market must be settled or cancelled (current: ${m.status})`;
      } else if (!cooldownPassed) {
        const remainingHours = Math.ceil((settledAtTs + RECLAIM_COOLDOWN_MS - now) / (3600 * 1000));
        reason = `7-day cooldown active (${remainingHours} hours remaining)`;
      } else {
        eligible = true;
        reason = "Eligible for rent reclamation";
      }

      // Default rent deposit for Anchor market accounts is ~0.024 SOL (24,000,000 lamports)
      const rentLamports = m.rentDepositLamports ?? 24_000_000;

      return {
        marketPubkey: m.marketPubkey,
        question: m.question,
        status: m.status,
        rentLamports,
        rentSol: rentLamports / 1e9,
        eligible,
        reason,
        settledAt: m.settledAt,
        rentReclaimedAt: m.rentReclaimedAt,
      };
    });

    return ok({
      ok: true,
      markets: reclaimableMarkets,
      totalReclaimableSol: reclaimableMarkets
        .filter((m) => m.eligible)
        .reduce((sum, m) => sum + m.rentSol, 0),
    });
  } catch (err) {
    return serverError(err);
  }
});
