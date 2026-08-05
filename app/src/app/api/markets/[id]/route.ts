import { NextRequest } from 'next/server';
import { getMarketByPubkey, getMarketById, incrementViewCount, getMarketPriceHistory } from '@/lib/db/markets-store';
import { getTradesByMarketFromDb } from '@/lib/db/trades-store';
import { getMarketComments } from '@/lib/db/store';
import { ok, notFound } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';

export const GET = apiHandler(async (req: NextRequest, context) => {
  const params = await context.params!;
  const id = params.id;
  
  if (!id) return notFound('Market ID required');

  // Try by pubkey first, then by numeric ID
  let market = await getMarketByPubkey(id);
  if (!market) {
    market = await getMarketById(id);
  }
  if (!market) {
    return notFound('Market not found');
  }

  // Increment view count in background (don't block response)
  incrementViewCount(market.marketPubkey).catch(() => {});

  // Fetch recent trades for this market
  const recentTrades = await getTradesByMarketFromDb(market.marketPubkey);

  // Fetch comments count
  const comments = await getMarketComments(market.marketPubkey);

  // Build price history from trades
  const priceHistory = recentTrades.slice(0, 50).reverse().map(t => {
    const price = Number(t.pricePerToken || 0.5);
    return {
      timestamp: t.blockTime,
      price,
      side: t.side,
      volume: Number(t.lamportsIn || 0) / 1e9,
    };
  });

  // Read persisted probability snapshots from the price_history table
  const dbPriceHistory = await getMarketPriceHistory(market.marketPubkey, 120);

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
      priceHistory,
      dbPriceHistory,
      tradeCount: recentTrades.length,
    },
  });
}, { cacheMaxAge: 5, cacheTags: ['market-detail'] });
