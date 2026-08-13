import { getMarketList } from "@/lib/data/markets";
import { getLeaderboard } from "@/lib/data/platform";
import DiscoverClient from "@/components/DiscoverClient";
import type { MarketCacheEntry } from "@/lib/db/markets-store";

export const dynamic = "force-dynamic";

/**
 * /discover — SERVER component.
 *
 * Prefetches the open-market list + top traders on the server (direct DB,
 * served from the TTL caches) and seeds the client view, so the first paint
 * shows trending markets and the trader leaderboard without client-side
 * /api/markets/cached or /api/leaderboard round trips. The client still polls
 * for freshness in the background.
 */
export default async function DiscoverPage() {
  // limit 50 matches /api/markets/cached's default, so the background poll
  // (fetchMarkets) never replaces the prefetched list with a smaller one.
  const [list, topTraders] = await Promise.all([
    getMarketList({ status: "open", sort: "newest", limit: 50 }),
    getLeaderboard("profit", "all", undefined, 6),
  ]);

  const initialMarkets = (list.markets ?? []) as unknown as MarketCacheEntry[];
  // getLeaderboard returns a superset of TraderEntry fields (winRate can be
  // null per spec §2.3 when a trader has 0 settled markets) — the client
  // guards rendering with `t.winRate != null`, so the shape is compatible.
  const initialTopTraders = topTraders as Array<{
    rank: number;
    wallet: string;
    username: string;
    avatarUrl: string;
    totalWagered: number;
    totalProfit: number;
    winRate: number | null;
    marketsTraded: number;
  }>;

  return <DiscoverClient initialMarkets={initialMarkets} initialTopTraders={initialTopTraders} />;
}
