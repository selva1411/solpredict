import { MarketAccount } from "@/hooks/useMarkets";

/** Total SOL locked across all markets */
export function totalVolumeLocked(markets: MarketAccount[]): number {
  return markets.reduce((sum, m) => {
    return sum + (m.account.yesPoolLamports + m.account.noPoolLamports) / 1_000_000_000;
  }, 0);
}

/** Number of active (open) markets */
export function activeMarketCount(markets: MarketAccount[]): number {
  return markets.filter((m) => m.account.status === 0).length;
}

/** Market with highest volume */
export function highestVolumeMarket(markets: MarketAccount[]): MarketAccount | null {
  return markets.reduce((best, m) => {
    const vol = m.account.yesPoolLamports + m.account.noPoolLamports;
    return vol > ((best?.account.yesPoolLamports ?? 0) + (best?.account.noPoolLamports ?? 0)) ? m : best;
  }, null as MarketAccount | null);
}

/** Markets sorted by volume descending */
export function marketsByVolume(markets: MarketAccount[]): MarketAccount[] {
  return [...markets].sort((a, b) => {
    const volA = a.account.yesPoolLamports + a.account.noPoolLamports;
    const volB = b.account.yesPoolLamports + b.account.noPoolLamports;
    return volB - volA;
  });
}

/** Markets ending soon (within 24 hours) */
export function marketsEndingSoon(markets: MarketAccount[], now = Date.now() / 1000): MarketAccount[] {
  return markets.filter((m) => {
    return m.account.status === 0 && m.account.endTs > now && m.account.endTs - now < 86400;
  });
}

/** Most lopsided market (highest YES or NO %) */
export function mostLopsidedMarket(markets: MarketAccount[]): MarketAccount | null {
  return markets.reduce((best, m) => {
    const total = m.account.yesPoolLamports + m.account.noPoolLamports;
    if (total === 0) return best;
    const yesPct = m.account.yesPoolLamports / total;
    const lopsidedness = Math.abs(yesPct - 0.5);
    if (!best) return m;
    const bestTotal = best.account.yesPoolLamports + best.account.noPoolLamports;
    const bestYesPct = best.account.yesPoolLamports / bestTotal;
    const bestLop = Math.abs(bestYesPct - 0.5);
    return lopsidedness > bestLop ? m : best;
  }, null as MarketAccount | null);
}

/** Pool depth warning level */
export function poolDepthWarning(totalPoolLamports: number): "low" | "medium" | "healthy" {
  const sol = totalPoolLamports / 1_000_000_000;
  if (sol < 1) return "low";
  if (sol < 10) return "medium";
  return "healthy";
}

/** Pool depth warning message */
export function poolDepthMessage(totalPoolLamports: number): string {
  const warning = poolDepthWarning(totalPoolLamports);
  if (warning === "low") return "Very shallow pool — price unreliable";
  if (warning === "medium") return "Shallow pool — high price impact";
  return "Healthy pool depth";
}

/** Price impact of a bet (in percentage points of YES%) */
export function priceImpact(betLamports: number, totalPoolLamports: number): number {
  if (totalPoolLamports === 0) return 100;
  return (betLamports / totalPoolLamports) * 100;
}

/** Contrarian signal: returns payout multiplier if user bets against the majority */
export function contrarianMultiplier(yesPoolLamports: number, noPoolLamports: number): number | null {
  const total = yesPoolLamports + noPoolLamports;
  if (total === 0) return null;
  const yesPct = yesPoolLamports / total;
  if (yesPct > 0.75) return 1 / (1 - yesPct); // NO side pays more
  if (yesPct < 0.25) return 1 / yesPct; // YES side pays more
  return null;
}

/** Time pressure label */
export function timePressureLabel(endTs: number, now = Date.now() / 1000): string | null {
  const remaining = endTs - now;
  if (remaining <= 0) return "Ended";
  if (remaining < 3600) return "Less than 1 hour left!";
  if (remaining < 86400) return "Ending soon";
  return null;
}