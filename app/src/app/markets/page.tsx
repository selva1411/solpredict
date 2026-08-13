import { getMarketList } from "@/lib/data/markets";
import MarketsDirectory from "@/components/MarketsDirectory";
import type { MarketCacheEntry } from "@/lib/db/markets-store";

export const dynamic = "force-dynamic";

/**
 * /markets — SERVER component.
 *
 * Prefetches the open-market list on the server (direct DB, served from the
 * 3s TTL cache) and seeds the client directory, so the first paint shows the
 * full list without waiting on /api/markets/cached. The client still polls
 * and applies on-chain enrichment in the background.
 */
export default async function MarketsPage() {
  // limit 50 matches /api/markets/cached's default, so the background poll
  // (fetchMarkets) never replaces the prefetched list with a smaller one.
  const list = await getMarketList({ status: "open", sort: "newest", limit: 50 });
  const initialMarkets = (list.markets ?? []) as unknown as MarketCacheEntry[];

  return <MarketsDirectory initialMarkets={initialMarkets} />;
}
