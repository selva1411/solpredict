export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getPositions } from "@/lib/data/users";
import { badRequest, ok, serviceUnavailable, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { positionsGetSchema } from "@/lib/schemas";

export const GET = apiHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const walletParam = url.searchParams.get("wallet");
  if (!walletParam) return badRequest("wallet parameter required");

  const parsed = positionsGetSchema.safeParse({ wallet: walletParam });
  if (!parsed.success) return badRequest("Invalid wallet format");

  try {
    const positions = await getPositions(parsed.data.wallet);

    let totalNetWorthSol = 0;
    let totalPnlSol = 0;
    let totalSpentSol = 0;

    for (const p of positions) {
      totalNetWorthSol += p.valueSol;
      totalPnlSol += p.pnlSol;
      totalSpentSol += p.costSol;
    }

    return ok({
      ok: true,
      positions,
      summary: {
        totalNetWorthSol,
        totalPnlSol,
        totalSpentSol,
        pnlPercent: totalSpentSol > 0 ? (totalPnlSol / totalSpentSol) * 100 : 0,
        positionCount: positions.length,
      },
    });
  } catch (err) {
    return serverError(err);
  }
});
