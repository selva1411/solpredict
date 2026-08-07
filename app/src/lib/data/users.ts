import { db } from '@/lib/db/client';
import { userStats, positions, trades, marketsCache, marketOutcomes } from '@/lib/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export async function getUserStats(wallet: string) {
  if (!db) return null;

  const rows = await db
    .select()
    .from(userStats)
    .where(eq(userStats.wallet, wallet))
    .limit(1);

  if (rows.length === 0) {
    return {
      wallet,
      totalVolume: 0,
      tradeCount: 0,
      marketsTraded: 0,
      marketsResolved: 0,
      wins: 0,
      losses: 0,
      winRateBps: null, // Null per spec when 0 settled markets
      realizedPnl: 0,
      unrealizedPnl: 0,
      roiBps: null,
      bestTrade: 0,
      currentStreak: 0,
      rank: null,
    };
  }

  const s = rows[0];
  return {
    wallet: s.wallet,
    totalVolume: Number(s.totalVolume ?? 0),
    tradeCount: s.tradeCount ?? 0,
    marketsTraded: s.marketsTraded ?? 0,
    marketsResolved: s.marketsResolved ?? 0,
    wins: s.wins ?? 0,
    losses: s.losses ?? 0,
    winRateBps: s.marketsResolved && s.marketsResolved > 0 ? s.winRateBps : null,
    realizedPnl: Number(s.realizedPnl ?? 0),
    unrealizedPnl: Number(s.unrealizedPnl ?? 0),
    roiBps: s.roiBps,
    bestTrade: Number(s.bestTrade ?? 0),
    currentStreak: s.currentStreak ?? 0,
    rank: s.rank,
  };
}

export async function getPositions(wallet: string) {
  if (!db) return [];

  const rows = await db
    .select({
      id: positions.id,
      wallet: positions.wallet,
      marketPubkey: positions.marketPubkey,
      outcomeIndex: positions.outcomeIndex,
      shares: positions.shares,
      costBasis: positions.costBasis,
      realizedPnl: positions.realizedPnl,
      claimed: positions.claimed,
      question: marketsCache.question,
      category: marketsCache.category,
      status: marketsCache.status,
      winningOutcome: marketsCache.winningOutcome,
    })
    .from(positions)
    .innerJoin(marketsCache, eq(marketsCache.marketPubkey, positions.marketPubkey))
    .where(eq(positions.wallet, wallet));

  if (rows.length === 0) return [];

  // Get current mark prices from market_outcomes
  const pubkeys = Array.from(new Set(rows.map(r => r.marketPubkey)));
  const outcomes = await db
    .select({
      marketPubkey: marketOutcomes.marketPubkey,
      outcomeIndex: marketOutcomes.outcomeIndex,
      lastPriceBps: marketOutcomes.lastPriceBps,
      label: marketOutcomes.label,
    })
    .from(marketOutcomes)
    .where(sql`${marketOutcomes.marketPubkey} IN ${pubkeys}`);

  const outcomeMap = new Map<string, typeof outcomes>();
  for (const o of outcomes) {
    const key = `${o.marketPubkey}:${o.outcomeIndex}`;
    const list = outcomeMap.get(key) ?? [];
    list.push(o);
    outcomeMap.set(key, list);
  }

  return rows.map(r => {
    const key = `${r.marketPubkey}:${r.outcomeIndex}`;
    const outcomeData = outcomeMap.get(key)?.[0];
    const currentPriceBps = outcomeData?.lastPriceBps ?? 5000;
    const currentPriceSol = currentPriceBps / 10000;

    const sharesCount = (r.shares ?? 0) / 1e9;
    const costSol = (r.costBasis ?? 0) / 1e9;
    const valueSol = sharesCount * currentPriceSol;
    const pnlSol = valueSol - costSol;
    const pnlPercent = costSol > 0 ? (pnlSol / costSol) * 100 : 0;

    return {
      marketPubkey: r.marketPubkey,
      question: r.question,
      category: r.category ?? 'Crypto',
      status: r.status ?? 'open',
      side: (r.outcomeIndex === 0 ? 'YES' : 'NO') as 'YES' | 'NO',
      outcomeIndex: r.outcomeIndex ?? 0,
      shares: sharesCount,
      costSol,
      avgPriceSol: sharesCount > 0 ? costSol / sharesCount : 0,
      currentPriceSol,
      valueSol,
      pnlSol,
      pnlPercent,
      claimed: r.claimed ?? false,
    };
  });
}

export async function getTradeHistory(wallet: string, limit = 50) {
  if (!db) return [];

  return db
    .select({
      signature: trades.signature,
      marketPubkey: trades.marketPubkey,
      outcomeIndex: trades.outcomeIndex,
      side: trades.side,
      shares: trades.shares,
      cost: trades.cost,
      avgPriceBps: trades.avgPriceBps,
      feePaidLamports: trades.feePaidLamports,
      blockTime: trades.blockTime,
      question: marketsCache.question,
    })
    .from(trades)
    .leftJoin(marketsCache, eq(marketsCache.marketPubkey, trades.marketPubkey))
    .where(eq(trades.trader, wallet))
    .orderBy(desc(trades.blockTime))
    .limit(limit);
}

export async function getPnlSeries(wallet: string) {
  if (!db) return [];

  // Group trades by date to build PnL time series
  const tradeHistory = await getTradeHistory(wallet, 200);
  let cumulativePnl = 0;

  return tradeHistory.reverse().map(t => {
    const costSol = (t.cost ?? 0) / 1e9;
    const priceSol = (t.avgPriceBps ?? 5000) / 10000;
    // Estimate pnl delta
    const estValue = ((t.shares ?? 0) / 1e9) * priceSol;
    const pnlDelta = estValue - costSol;
    cumulativePnl += pnlDelta;

    return {
      timestamp: t.blockTime ? new Date(t.blockTime).toISOString() : new Date().toISOString(),
      pnlSol: cumulativePnl,
    };
  });
}
