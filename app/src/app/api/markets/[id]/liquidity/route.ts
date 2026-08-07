export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getMarket } from "@/lib/data/markets";
import { notFound, ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

function buildOrderBook(yesPricePct: number, totalVolumeSol: number) {
  const midPrice = Math.max(1, Math.min(99, yesPricePct));
  const tickSize = 1;
  const bids: Array<{ price: number; size: number; total: number }> = [];
  const asks: Array<{ price: number; size: number; total: number }> = [];

  let bidTotal = 0;
  let askTotal = 0;
  const baseSize = Math.max(10, totalVolumeSol / 10);

  for (let i = 1; i <= 5; i++) {
    const price = Math.max(1, Math.round(midPrice - i * tickSize));
    const size = baseSize * (1 + i * 0.2);
    bidTotal += size;
    bids.push({ price, size: Math.round(size), total: Math.round(bidTotal) });
  }

  for (let i = 1; i <= 5; i++) {
    const price = Math.min(99, Math.round(midPrice + i * tickSize));
    const size = baseSize * (1 + i * 0.2);
    askTotal += size;
    asks.push({ price, size: Math.round(size), total: Math.round(askTotal) });
  }

  const bestBid = bids[0]?.price ?? midPrice - tickSize;
  const bestAsk = asks[asks.length - 1]?.price ?? midPrice + tickSize;
  const spread = Math.max(0.1, bestAsk - bestBid);

  return { bids, asks, spread: Math.round(spread * 100) / 100 };
}

export const GET = apiHandler(async (_req: NextRequest, context) => {
  const params = await context.params!;
  const marketPubkey = params.id;
  if (!marketPubkey) return notFound('Market ID required');

  try {
    const market = await getMarket(marketPubkey);
    if (!market) return notFound('Market not found');

    const yesPricePct = market.yesOdds * 100;
    const { bids, asks, spread } = buildOrderBook(yesPricePct, market.totalVolume);

    return ok({
      ok: true,
      liquidity: {
        marketPubkey,
        totalVolumeSol: market.totalVolume,
        midPrice: yesPricePct,
        spread,
        bids,
        asks,
        depthData: {
          bids: bids.map(b => ({ price: b.price, cumSize: b.total })),
          asks: asks.map(a => ({ price: a.price, cumSize: a.total })),
        },
      },
    });
  } catch (err) {
    return serverError(err);
  }
});
