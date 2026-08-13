import { db } from '@/lib/db/client';
import { marketsCache, marketOutcomes, priceHistory, trades } from '@/lib/db/schema';
import { eq, and, desc, asc, ilike, or, sql } from 'drizzle-orm';

export interface MarketListFilters {
  category?: string;
  status?: string;
  search?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

// ---------------------------------------------------------------------------
// Short-lived in-memory TTL cache. getMarketList is the single most-fetched
// query in the app (home, /markets, watchlist, related-markets, admin all hit
// it, often 2-3× within the same page render). Each call runs a multi-table
// query against the remote Neon DB (~hundreds of ms), so we cache the result
// for 3 seconds keyed by the exact filter set. Trade/settle sync paths call
// invalidateMarketList() to keep post-trade numbers fresh.
// ---------------------------------------------------------------------------
// The row shape returned by loadMarketList (matches what /api/markets/cached
// has always returned — the UI consumes these fields).
type MarketRow = {
  marketPubkey: string;
  marketId: number;
  creator: string | null;
  question: string;
  description: string | null;
  category: string;
  status: string;
  winningOutcome: string | null;
  resolutionSource: string | null;
  oracleFeedId: string | null;
  feeBps: number | null;
  totalVolume: number;
  openInterest: number;
  rentDepositLamports: string | null;
  rentReclaimedAt: string | null;
  endTs: string | null;
  resolveTs: string | null;
  settledAt: string | null;
  thumbnailUrl: string | null;
  tags: string[] | null;
  viewCount: number | null;
  watchlistCount: number | null;
  yesOdds: number;
  yesPoolSol: number;
  noPoolSol: number;
  yesPoolLamports: number;
  noPoolLamports: number;
  yesSupply: number;
  noSupply: number;
  totalPool: number;
  outcomes: Array<{
    outcomeIndex: number;
    label: string;
    sharesOutstanding: string | null;
    lastPriceBps: number | null;
    priceSol: number;
  }>;
};
interface MarketListResult {
  markets: MarketRow[];
  total: number;
}
// A Map keyed by canonicalized filter JSON (defaults applied so `page` vs
// omitted produce the same key) avoids different pages thrashing a single slot.
const marketListCache = new Map<string, { at: number; result: MarketListResult }>();
const MARKET_LIST_TTL = 3_000;
const MAX_CACHE_ENTRIES = 20;

export function invalidateMarketList(): void {
  marketListCache.clear();
}

/** Apply defaults so equivalent filter objects share one cache key. */
function marketListCacheKey(filters: MarketListFilters): string {
  return JSON.stringify({
    category: filters.category ?? undefined,
    status: filters.status ?? 'open',
    search: filters.search ?? undefined,
    sort: filters.sort ?? 'newest',
    page: filters.page ?? 1,
    limit: filters.limit ?? 50,
  });
}

/** The uncached implementation — the exported getMarketList wraps it in a TTL cache. */
async function loadMarketList(filters: MarketListFilters = {}): Promise<MarketListResult> {
  if (!db) return { markets: [], total: 0 };

  const {
    category,
    status = 'open',
    search,
    sort = 'newest',
    page = 1,
    limit = 20,
  } = filters;

  const offset = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
  const conditions = [];

  if (status && status !== 'all') {
    conditions.push(eq(marketsCache.status, status));
  }
  if (category && category !== 'All' && category !== 'all') {
    conditions.push(eq(marketsCache.category, category));
  }
  if (search && search.trim()) {
    conditions.push(
      or(
        ilike(marketsCache.question, `%${search.trim()}%`),
        ilike(marketsCache.description, `%${search.trim()}%`),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortExpr = {
    newest: desc(marketsCache.createdAt),
    ending: asc(marketsCache.endTs),
    volume: desc(sql`CAST(${marketsCache.totalVolume} AS NUMERIC)`),
    popular: desc(marketsCache.viewCount),
    liquidity: desc(sql`CAST(${marketsCache.totalVolume} AS NUMERIC)`),
  }[sort] ?? desc(marketsCache.createdAt);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        marketPubkey: marketsCache.marketPubkey,
        marketId: marketsCache.marketId,
        creator: marketsCache.creator,
        question: marketsCache.question,
        description: marketsCache.description,
        category: marketsCache.category,
        status: marketsCache.status,
        winningOutcome: marketsCache.winningOutcome,
        resolutionSource: marketsCache.resolutionSource,
        oracleFeedId: marketsCache.oracleFeedId,
        feeBps: marketsCache.feeBps,
        totalVolume: marketsCache.totalVolume,
        openInterest: marketsCache.openInterest,
        rentDepositLamports: marketsCache.rentDepositLamports,
        rentReclaimedAt: marketsCache.rentReclaimedAt,
        endTs: marketsCache.endTs,
        resolveTs: marketsCache.resolveTs,
        settledAt: marketsCache.settledAt,
        thumbnailUrl: marketsCache.thumbnailUrl,
        tags: marketsCache.tags,
        viewCount: marketsCache.viewCount,
        watchlistCount: marketsCache.watchlistCount,
        yesPoolLamports: marketsCache.yesPoolLamports,
        noPoolLamports: marketsCache.noPoolLamports,
        yesSupply: marketsCache.yesSupply,
        noSupply: marketsCache.noSupply,
        createdAt: marketsCache.createdAt,
      })
      .from(marketsCache)
      .where(where)
      .orderBy(sortExpr)
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)::int` }).from(marketsCache).where(where),
  ]);

  const total = countRows[0]?.count ?? 0;
  if (rows.length === 0) {
    return { markets: [], total } as MarketListResult;
  }

  // Fetch outcomes for all retrieved markets in one query
  const marketPubkeys = rows.map(r => r.marketPubkey);
  const outcomes = await db
    .select({
      marketPubkey: marketOutcomes.marketPubkey,
      outcomeIndex: marketOutcomes.outcomeIndex,
      label: marketOutcomes.label,
      sharesOutstanding: marketOutcomes.sharesOutstanding,
      lastPriceBps: marketOutcomes.lastPriceBps,
    })
    .from(marketOutcomes)
    .where(sql`${marketOutcomes.marketPubkey} IN ${marketPubkeys}`);

  const outcomesByMarket = new Map<string, typeof outcomes>();
  for (const o of outcomes) {
    const list = outcomesByMarket.get(o.marketPubkey) ?? [];
    list.push(o);
    outcomesByMarket.set(o.marketPubkey, list);
  }

  const markets = rows.map(r => {
    const marketOutcomesList = (outcomesByMarket.get(r.marketPubkey) ?? []).sort(
      (a, b) => a.outcomeIndex - b.outcomeIndex,
    );
    const yesOutcome = marketOutcomesList.find(o => o.outcomeIndex === 0);
    const yesPriceBps = yesOutcome?.lastPriceBps ?? 5000;

    // Pool reserves are REAL on-chain snapshots from markets_cache. When they
    // are known, the implied odds match the on-chain AMM (pools), not the LMSR
    // price — so cards, detail page and order book all agree.
    const yesPoolSol = (r.yesPoolLamports ?? 0) / 1e9;
    const noPoolSol = (r.noPoolLamports ?? 0) / 1e9;
    const totalPool = yesPoolSol + noPoolSol;
    const yesOdds = totalPool > 0 ? yesPoolSol / totalPool : yesPriceBps / 10000;

    return {
      marketPubkey: r.marketPubkey,
      marketId: r.marketId,
      creator: r.creator,
      question: r.question,
      description: r.description,
      category: r.category ?? 'Crypto',
      status: r.status ?? 'open',
      winningOutcome: r.winningOutcome,
      resolutionSource: r.resolutionSource,
      oracleFeedId: r.oracleFeedId,
      feeBps: r.feeBps ?? 200,
      totalVolume: Number(r.totalVolume ?? 0),
      openInterest: Number(r.openInterest ?? 0),
      rentDepositLamports: r.rentDepositLamports,
      rentReclaimedAt: r.rentReclaimedAt ? r.rentReclaimedAt.toISOString() : null,
      endTs: r.endTs ? r.endTs.toISOString() : null,
      resolveTs: r.resolveTs ? r.resolveTs.toISOString() : null,
      settledAt: r.settledAt ? r.settledAt.toISOString() : null,
      thumbnailUrl: r.thumbnailUrl,
      tags: r.tags,
      viewCount: r.viewCount ?? 0,
      watchlistCount: r.watchlistCount ?? 0,
      yesOdds,
      yesPoolSol,
      noPoolSol,
      yesPoolLamports: r.yesPoolLamports ?? 0,
      noPoolLamports: r.noPoolLamports ?? 0,
      yesSupply: r.yesSupply ?? 0,
      noSupply: r.noSupply ?? 0,
      totalPool,
      outcomes: marketOutcomesList.map(o => ({
        outcomeIndex: o.outcomeIndex,
        label: o.label,
        sharesOutstanding: o.sharesOutstanding,
        lastPriceBps: o.lastPriceBps,
        priceSol: (o.lastPriceBps ?? 5000) / 10000,
      })),
    };
  });

  return { markets, total } as MarketListResult;
}

export async function getMarketList(filters: MarketListFilters = {}): Promise<MarketListResult> {
  if (!db) return { markets: [], total: 0 };

  const cacheKey = marketListCacheKey(filters);
  const now = Date.now();
  const hit = marketListCache.get(cacheKey);
  if (hit && now - hit.at < MARKET_LIST_TTL) {
    return hit.result;
  }
  const result = await loadMarketList(filters);
  marketListCache.set(cacheKey, { at: now, result });
  // Cap memory: evict oldest entry when over budget.
  if (marketListCache.size > MAX_CACHE_ENTRIES) {
    const oldestKey = marketListCache.keys().next().value;
    if (oldestKey !== undefined) marketListCache.delete(oldestKey);
  }
  return result;
}

export async function getMarket(pubkey: string) {
  if (!db) return null;

  const rows = await db
    .select()
    .from(marketsCache)
    .where(or(eq(marketsCache.marketPubkey, pubkey), eq(sql`CAST(${marketsCache.marketId} AS TEXT)`, pubkey)))
    .limit(1);

  if (rows.length === 0) return null;
  const m = rows[0];

  const outcomes = await db
    .select()
    .from(marketOutcomes)
    .where(eq(marketOutcomes.marketPubkey, m.marketPubkey))
    .orderBy(asc(marketOutcomes.outcomeIndex));

  const yesOutcome = outcomes.find(o => o.outcomeIndex === 0);
  const yesPriceBps = yesOutcome?.lastPriceBps ?? 5000;

  const yesPoolSol = (m.yesPoolLamports ?? 0) / 1e9;
  const noPoolSol = (m.noPoolLamports ?? 0) / 1e9;
  const totalPool = yesPoolSol + noPoolSol;

  return {
    ...m,
    totalVolume: Number(m.totalVolume ?? 0),
    openInterest: Number(m.openInterest ?? 0),
    yesPoolSol,
    noPoolSol,
    totalPool,
    yesOdds: totalPool > 0 ? yesPoolSol / totalPool : yesPriceBps / 10000,
    outcomes: outcomes.map(o => ({
      outcomeIndex: o.outcomeIndex,
      label: o.label,
      sharesOutstanding: o.sharesOutstanding,
      lastPriceBps: o.lastPriceBps,
      priceSol: (o.lastPriceBps ?? 5000) / 10000,
    })),
  };
}

export async function getPriceHistory(pubkey: string, range = '24h') {
  if (!db) return [];

  const hours = range === '7d' ? 168 : range === '30d' ? 720 : 24;
  const since = new Date(Date.now() - hours * 3600 * 1000);

  return db
    .select({
      timestamp: priceHistory.timestamp,
      outcomeIndex: priceHistory.outcomeIndex,
      priceBps: priceHistory.priceBps,
      volume: priceHistory.volume,
    })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.marketPubkey, pubkey),
        sql`${priceHistory.timestamp} >= ${since}`,
      ),
    )
    .orderBy(asc(priceHistory.timestamp));
}

export async function getTrending(limit = 6) {
  if (!db) return [];

  const trendingRows = await db.execute(sql`
    SELECT 
      mc.market_pubkey,
      COALESCE(SUM(ABS(t.cost)), 0) / 1e9 as vol24h
    FROM markets_cache mc
    LEFT JOIN trades t ON t.market_pubkey = mc.market_pubkey AND t.block_time > NOW() - INTERVAL '24 hours'
    WHERE mc.status = 'open'
    GROUP BY mc.market_pubkey
    ORDER BY vol24h DESC
    LIMIT ${limit}
  `);

  const pubkeys = (trendingRows.rows as Array<{ market_pubkey: string }>).map(r => r.market_pubkey);
  if (pubkeys.length === 0) {
    const fallback = await getMarketList({ status: 'open', sort: 'popular', limit });
    return fallback.markets;
  }

  const { markets } = await getMarketList({ status: 'all', limit: 100 });
  return markets.filter(m => pubkeys.includes(m.marketPubkey));
}
