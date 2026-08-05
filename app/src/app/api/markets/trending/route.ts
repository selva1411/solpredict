import { NextRequest } from 'next/server';
import { getAllMarkets } from '@/lib/db/markets-store';
import { cacheToUiMarket } from '@/lib/market-adapter';
import { ok } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';

export const GET = apiHandler(async (_req: NextRequest) => {
  const cached = await getAllMarkets({ status: 'open', limit: 50 });

  // Rank by real 24h volume (from trades table), falling back to pool liquidity.
  const ranked = cached
    .filter((m) => m.volume24h !== undefined || (m.yesPoolSol + m.noPoolSol) > 0)
    .sort((a, b) => {
      const va = a.volume24h || 0;
      const vb = b.volume24h || 0;
      if (va !== vb) return vb - va;
      return (b.yesPoolSol + b.noPoolSol) - (a.yesPoolSol + a.noPoolSol);
    })
    .slice(0, 6);

  const trending = ranked.map((m, i) =>
    cacheToUiMarket(m, { trending: i < 4, hot: i === 0 }),
  );

  return ok({ ok: true, markets: trending });
}, { cacheMaxAge: 30, cacheTags: ['trending'] });
