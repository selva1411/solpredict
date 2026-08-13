import { getMarket, getPriceHistory } from "@/lib/data/markets";
import MarketDetailClient from "./MarketDetailClient";

export const dynamic = "force-dynamic";

/**
 * /market/[id] — SERVER component.
 *
 * Prefetches the market row + sparkline history directly from the DB (no
 * client-side /api/markets/[id] round trip on first load) and passes them to
 * the client detail view. The client seeds its market + history state from
 * these props, so the first paint shows the board instantly; the on-chain
 * account fetch still runs in the background to supply live pool reserves.
 *
 * getMarket is a single-row indexed lookup (fast), and the detail route stays
 * cache-tagged so post-trade syncs invalidate it like before.
 */
export default async function MarketDetailServerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let initialMarket: unknown = null;
  let initialHistory: Array<{ yesPct: number }> = [];

  try {
    const market = await getMarket(id);
    if (market) {
      initialMarket = market;
      const history = await getPriceHistory(market.marketPubkey, "7d");
      initialHistory = history.slice(-120).map((p) => ({
        yesPct:
          p.outcomeIndex === 0
            ? Math.max(1, Math.min(99, Math.round(((p.priceBps ?? 5000) / 10000) * 100)))
            : Math.max(1, Math.min(99, Math.round((1 - (p.priceBps ?? 5000) / 10000) * 100))),
      }));
    }
  } catch {
    // DB unavailable — the client falls back to its on-chain + API paths.
  }

  return (
    <MarketDetailClient initialMarket={initialMarket} initialHistory={initialHistory} />
  );
}
