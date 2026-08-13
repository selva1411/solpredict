export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getMarket, getPriceHistory } from "@/lib/data/markets";
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

    const [recentTrades, comments, dbPriceHistory] = await Promise.all([
      getTradesByMarketFromDb(market.marketPubkey),
      getMarketComments(market.marketPubkey),
      // Seed the probability sparkline: last ~120 snapshots (24h @ 1/min).
      getPriceHistory(market.marketPubkey, "7d"),
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
        dbPriceHistory: dbPriceHistory.slice(-120).map(p => ({
          timestamp: p.timestamp,
          yesPct: p.outcomeIndex === 0
            ? Math.max(1, Math.min(99, Math.round(((p.priceBps ?? 5000) / 10000) * 100)))
            : Math.max(1, Math.min(99, Math.round((1 - (p.priceBps ?? 5000) / 10000) * 100))),
        })),
      },
    });
  } catch (err) {
    return serverError(err);
  }
}, { cacheMaxAge: 5, cacheTags: ["markets"] });
