import { db } from '@/lib/db/client';
import { trades } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { ok } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';

export const GET = apiHandler(async () => {
  if (!db) return ok({ ok: false, error: 'DB not available' });

  const rows = await db.select({
    signature: trades.signature,
    marketPubkey: trades.marketPubkey,
    trader: trades.trader,
    side: trades.side,
    lamportsIn: trades.lamportsIn,
    tokensOut: trades.tokensOut,
    blockTime: trades.blockTime,
  })
    .from(trades)
    .orderBy(desc(trades.blockTime))
    .limit(50);

  return ok({ ok: true, activities: rows });
}, { cacheMaxAge: 15, cacheTags: ["activity"] });
