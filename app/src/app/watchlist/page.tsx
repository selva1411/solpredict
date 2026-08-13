import { getMarketList } from "@/lib/data/markets";
import WatchlistClient from "@/components/WatchlistClient";
import type { MarketCacheEntry } from "@/lib/db/markets-store";

export const dynamic = "force-dynamic";

/**
 * /watchlist — SERVER component.
 *
 * Prefetches the ALL-status market list on the server (direct DB, served from
 * the 3s TTL cache) and seeds the client watchlist view, so the first paint
 * shows the market cards without waiting on /api/markets/cached. All statuses
 * are included because users watch markets that may have since settled or
 * been cancelled — those boards must still render on the watchlist page.
 * The watchlist keys themselves still load client-side (localStorage /
 * wallet-scoped DB query), which is a fast no-network lookup.
 */
export default async function WatchlistPage() {
  // limit 100 (the API cap) so the self-heal never prunes a watchlisted
  // market that happens to sit beyond a smaller page window.
  const list = await getMarketList({ status: "all", sort: "newest", limit: 100 });
  const initialMarkets = (list.markets ?? []) as unknown as MarketCacheEntry[];

  return <WatchlistClient initialMarkets={initialMarkets} />;
}
