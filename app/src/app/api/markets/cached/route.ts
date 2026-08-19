export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getMarketList } from "@/lib/data/markets";
import { getPlatformStats } from "@/lib/data/platform";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || undefined;
  const category = url.searchParams.get("category") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const sort = url.searchParams.get("sortBy") || url.searchParams.get("sort") || "newest";
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));
  const page = Math.floor(offset / limit) + 1;

  try {
    const [{ markets, total }, platformStats] = await Promise.all([
      getMarketList({ status, category, search, sort, page, limit }),
      getPlatformStats(),
    ]);

    return ok({
      ok: true,
      markets: markets ?? [],
      stats: {
        totalMarkets: platformStats.totalMarkets,
        openMarkets: platformStats.openMarkets,
        totalVolume: (platformStats.totalVolume || 0).toString(),
        totalLiquidity: (platformStats.totalLiquidity || 0).toString(),
        // Real 24h volume aggregated from the trades table (never a hardcoded 0).
        volume24h: (platformStats.volume24h || 0).toString(),
        totalTraders: platformStats.totalTraders || 0,
      },
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (err) {
    return serverError(err);
  }
}, { cacheMaxAge: 10, cacheTags: ["markets"] });
