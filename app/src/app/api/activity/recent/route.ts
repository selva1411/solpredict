export const dynamic = "force-dynamic";
import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { trades, marketsCache } from '@/lib/db/schema';
import { desc, eq } from 'drizzle-orm';
import { serverError, ok } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';

export const GET = apiHandler(async (req: NextRequest) => {
  if (!db) return serverError('Database not configured');

  const wallet = req.nextUrl.searchParams.get("wallet")?.trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") || "50"), 200);

  const query = db.select({
    signature: trades.signature,
    marketPubkey: trades.marketPubkey,
    trader: trades.trader,
    side: trades.side,
    lamportsIn: trades.lamportsIn,
    tokensOut: trades.tokensOut,
    blockTime: trades.blockTime,
    question: marketsCache.question,
  })
    .from(trades)
    .leftJoin(marketsCache, eq(trades.marketPubkey, marketsCache.marketPubkey))
    .orderBy(desc(trades.blockTime));

  const rows = wallet
    ? await query.where(eq(trades.trader, wallet)).limit(limit)
    : await query.limit(limit);

  const activities = rows.map(r => ({
    ...r,
    question: r.question || `Market Trade (${r.marketPubkey.slice(0, 8)}...)`,
  }));

  return ok({ ok: true, activities });
}, { cacheMaxAge: 15, cacheTags: ["activity"] });
