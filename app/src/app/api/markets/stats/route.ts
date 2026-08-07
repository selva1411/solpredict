export const dynamic = "force-dynamic";
import { getPlatformStats } from "@/lib/data/platform";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async () => {
  try {
    const stats = await getPlatformStats();
    return ok({
      ok: true,
      stats: {
        totalMarkets: stats.totalMarkets,
        openMarkets: stats.openMarkets,
        settledMarkets: stats.settledMarkets,
        totalVolume: stats.totalVolume.toFixed(2),
        totalLiquidity: stats.totalLiquidity.toFixed(2),
        totalTraders: stats.totalTraders,
        volume24h: stats.volume24h.toFixed(2),
      },
    });
  } catch (err) {
    return serverError(err);
  }
}, { cacheMaxAge: 10, cacheTags: ["platform-stats"] });
