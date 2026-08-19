export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { getReclaimableMarkets } from "@/lib/data/markets";
import { walletSchema } from "@/lib/schemas";
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
  if (!wallet) return badRequest("Valid wallet address required");

  const parsed = walletSchema.safeParse(wallet);
  if (!parsed.success) return badRequest("Valid wallet address required");

  try {
    const markets = await getReclaimableMarkets(parsed.data, RECLAIM_COOLDOWN_MS);
    return ok({
      ok: true,
      markets,
      totalReclaimableSol: markets
        .filter((m) => m.eligible)
        .reduce((sum, m) => sum + m.rentSol, 0),
    });
  } catch (err) {
    return serverError(err);
  }
});
