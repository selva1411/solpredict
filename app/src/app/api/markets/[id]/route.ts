export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getMarket } from "@/lib/data/markets";
import { getMarketComments } from "@/lib/db/store";
import { getTradesByMarketFromDb } from "@/lib/db/trades-store";
import { ok, notFound, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest, context) => {
  const params = await context.params!;
  const id = params.id;

  if (!id) return notFound("Market ID required");

  try {
    const market = await getMarket(id);
    if (!market) {
      return notFound("Market not found");
    }

    const [recentTrades, comments] = await Promise.all([
      getTradesByMarketFromDb(market.marketPubkey),
      getMarketComments(market.marketPubkey),
    ]);

    return ok({
      ok: true,
      market,
      enrichment: {
        recentTrades: recentTrades.slice(0, 20).map(t => ({
          signature: t.signature,
          trader: t.trader,
          side: t.side,
          lamportsIn: t.lamportsIn,
          tokensOut: t.tokensOut,
          pricePerToken: t.pricePerToken,
          blockTime: t.blockTime,
        })),
        commentsCount: comments.length,
      },
    });
  } catch (err) {
    return serverError(err);
  }
});
