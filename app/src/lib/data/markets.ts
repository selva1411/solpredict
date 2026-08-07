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

export async function getMarketList(filters: MarketListFilters = {}) {
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
  if (rows.length === 0) return { markets: [], total };

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
    const yesOdds = yesPriceBps / 10000;

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
      yesPoolSol: 0,
      noPoolSol: 0,
      yesSupply: yesOutcome?.sharesOutstanding ?? 0,
      noSupply: marketOutcomesList.find(o => o.outcomeIndex === 1)?.sharesOutstanding ?? 0,
      totalPool: Number(r.totalVolume ?? 0),
      outcomes: marketOutcomesList.map(o => ({
        outcomeIndex: o.outcomeIndex,
        label: o.label,
        sharesOutstanding: o.sharesOutstanding,
        lastPriceBps: o.lastPriceBps,
        priceSol: (o.lastPriceBps ?? 5000) / 10000,
      })),
    };
  });

  return { markets, total };
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

  return {
    ...m,
    totalVolume: Number(m.totalVolume ?? 0),
    openInterest: Number(m.openInterest ?? 0),
    yesOdds: yesPriceBps / 10000,
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
