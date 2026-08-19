export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getPositions, getLpPositions } from "@/lib/data/positions";
import { getUserStats } from "@/lib/data/users";
import { badRequest, ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { positionsGetSchema } from "@/lib/schemas";

export const GET = apiHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const walletParam = url.searchParams.get("wallet");
  if (!walletParam) return badRequest("wallet parameter required");

  const parsed = positionsGetSchema.safeParse({ wallet: walletParam });
  if (!parsed.success) return badRequest("Invalid wallet format");

  try {
    const [positions, lpPositions, userStat] = await Promise.all([
      getPositions(parsed.data.wallet),
      getLpPositions(parsed.data.wallet),
      getUserStats(parsed.data.wallet),
    ]);

    let totalNetWorthSol = 0;
    let totalPnlSol = 0;
    let totalSpentSol = 0;

    for (const p of positions) {
      totalNetWorthSol += p.valueSol;
      totalPnlSol += p.pnlSol;
      totalSpentSol += p.costSol;
    }

    const winRate =
      (userStat?.wins ?? 0) + (userStat?.losses ?? 0) > 0
        ? (userStat!.wins!) / ((userStat!.wins!) + (userStat!.losses!))
        : positions.length > 0
          ? positions.filter((p) => p.pnlSol > 0).length / positions.length
          : 0;

    return ok({
      ok: true,
      positions,
      lpPositions,
      summary: {
        totalNetWorthSol,
        totalPnlSol,
        totalSpentSol,
        pnlPercent: totalSpentSol > 0 ? (totalPnlSol / totalSpentSol) * 100 : 0,
        positionCount: positions.length,
      },
      stats: {
        netWorthSol: totalNetWorthSol,
        pnl24hSol: totalPnlSol,
        pnl24hPct: totalSpentSol > 0 ? (totalPnlSol / totalSpentSol) * 100 : 0,
        winRate,
      },
    });
  } catch (err) {
    return serverError(err);
  }
});
