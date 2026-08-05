import { NextRequest } from 'next/server';
import { getAllMarkets, getMarketStats, getMarketsCount } from '@/lib/db/markets-store';
import { ok } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';

export const GET = apiHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const category = url.searchParams.get("category") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const sortBy = (url.searchParams.get("sortBy") as any) || "newest";
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);

  const [markets, stats, totalCount] = await Promise.all([
    getAllMarkets({ status, category, search, sortBy, limit, offset }),
    getMarketStats(),
    getMarketsCount({ status, category }),
  ]);

  return ok({
    ok: true,
    markets: markets ?? [],
    stats: {
      totalMarkets: stats?.totalMarkets || 0,
      openMarkets: stats?.openMarkets || 0,
      totalVolume: stats?.totalVolume || "0",
      totalLiquidity: stats?.totalLiquidity || "0",
      volume24h: stats?.volume24h || "0",
      totalTraders: stats?.totalTraders || 0,
    },
    pagination: {
      total: totalCount,
      limit,
      offset,
      hasMore: offset + limit < totalCount,
    },
  });
}, { cacheMaxAge: 10, cacheTags: ["markets"] });
