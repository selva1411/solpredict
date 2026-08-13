import { getMarketList } from "@/lib/data/markets";
import { getPlatformStats } from "@/lib/data/platform";
import HomeClient from "@/components/HomeClient";
import type { MarketCacheEntry } from "@/lib/db/markets-store";

export const dynamic = "force-dynamic";

/**
 * Home page — SERVER component.
 *
 * Fetches the open-market list + platform stats on the server (direct DB, no
 * client round trip) and passes them to the client Home view. The client
 * seeds its hooks with this data, so the first paint shows real numbers
 * instantly instead of waiting on /api/markets/cached + /api/markets/stats.
 * Both server-side fetches are served from the short TTL caches, so repeated
 * loads stay fast.
 */
export default async function HomePage() {
  const [listResult, stats] = await Promise.all([
    getMarketList({ status: "open", sort: "newest", limit: 50 }),
    getPlatformStats(),
  ]);

  const initialMarkets = (listResult.markets ?? []) as unknown as MarketCacheEntry[];
  // Match the /api/markets/stats wire shape the client hook expects (strings).
  const initialStats = {
    totalMarkets: stats.totalMarkets,
    openMarkets: stats.openMarkets,
    settledMarkets: stats.settledMarkets,
    totalVolume: stats.totalVolume.toFixed(2),
    totalLiquidity: stats.totalLiquidity.toFixed(2),
    totalTraders: stats.totalTraders,
    volume24h: stats.volume24h.toFixed(2),
  };

  return (
    <HomeClient initialMarkets={initialMarkets} initialStats={initialStats} />
  );
}
