import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { marketsCache, trades } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { ok, notFound, serverError } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';

interface OrderLevel {
  price: number;
  size: number;
  total: number;
}

/**
 * Derives a simulated order book from on-chain pool state + recent trades.
 * In a real CLOB system this would query actual limit orders.
 * For the AMM model, we interpolate from the current price curves.
 */
function buildOrderBook(yesPool: number, noPool: number): { bids: OrderLevel[]; asks: OrderLevel[]; spread: number } {
  const total = yesPool + noPool;
  if (total <= 0) {
    return { bids: [], asks: [], spread: 0 };
  }

  const midPrice = (yesPool / total) * 100; // in cents (0-100)
  const tickSize = 0.5;
  const levels = 8;

  // Bids = YES buy orders below mid price
  const bids: OrderLevel[] = [];
  let bidTotal = 0;
  for (let i = 0; i < levels; i++) {
    const price = midPrice - tickSize * (i + 1);
    if (price <= 0) break;
    const size = (yesPool * 0.02) * Math.exp(-i * 0.5) * (0.8 + Math.random() * 0.4);
    bidTotal += size;
    bids.push({ price: Math.round(price * 100) / 100, size: Math.round(size), total: Math.round(bidTotal) });
  }

  // Asks = NO buy orders (YES sell) above mid price
  const asks: OrderLevel[] = [];
  let askTotal = 0;
  for (let i = levels; i > 0; i--) {
    const price = midPrice + tickSize * i;
    if (price >= 100) continue;
    const size = (noPool * 0.02) * Math.exp(-(i - 1) * 0.5) * (0.8 + Math.random() * 0.4);
    askTotal += size;
    asks.push({ price: Math.round(price * 100) / 100, size: Math.round(size), total: Math.round(askTotal) });
  }

  const bestBid = bids[0]?.price ?? midPrice - tickSize;
  const bestAsk = asks[asks.length - 1]?.price ?? midPrice + tickSize;
  const spread = bestAsk - bestBid;

  return { bids, asks, spread: Math.round(spread * 100) / 100 };
}

export const GET = apiHandler(async (_req: NextRequest, context) => {
  const params = await context.params!;
  const marketPubkey = params.id;
  if (!marketPubkey) return notFound('Market ID required');

  if (!db) {
    return ok({ ok: true, bids: [], asks: [], spread: 0, midPrice: 50, yesPool: 0, noPool: 0 });
  }

  try {
    const rows = await db.select({
      yesPoolSol: marketsCache.yesPoolSol,
      noPoolSol: marketsCache.noPoolSol,
    }).from(marketsCache)
      .where(eq(marketsCache.marketPubkey, marketPubkey))
      .limit(1);

    if (!rows.length) return notFound('Market not found');

    const yesPool = Number(rows[0].yesPoolSol ?? 0);
    const noPool = Number(rows[0].noPoolSol ?? 0);
    const totalPool = yesPool + noPool;
    const midPrice = totalPool > 0 ? (yesPool / totalPool) * 100 : 50;

    const { bids, asks, spread } = buildOrderBook(yesPool, noPool);

    // Recent trade price history for depth chart (last 50 trades)
    const recentTrades = await db.select({
      pricePerToken: trades.pricePerToken,
      side: trades.side,
      lamportsIn: trades.lamportsIn,
      blockTime: trades.blockTime,
    }).from(trades)
      .where(eq(trades.marketPubkey, marketPubkey))
      .orderBy(desc(trades.blockTime))
      .limit(50);

    // Build depth chart data
    const depthData = {
      bids: bids.map(b => ({ price: b.price, cumSize: b.total })),
      asks: asks.map(a => ({ price: a.price, cumSize: a.total })),
    };

    return ok({
      ok: true,
      bids,
      asks,
      spread,
      midPrice: Math.round(midPrice * 100) / 100,
      yesPool,
      noPool,
      depthData,
      recentTrades: recentTrades.map(t => ({
        price: Number(t.pricePerToken ?? 0) * 100,
        side: t.side,
        size: Number(t.lamportsIn ?? 0) / 1e9,
        blockTime: t.blockTime,
      })),
    });
  } catch (err) {
    return serverError(err);
  }
}, { cacheMaxAge: 5 });
