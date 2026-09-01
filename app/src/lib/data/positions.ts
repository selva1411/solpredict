import { db } from '@/lib/db/client';
import { positions, marketsCache, marketOutcomes, liquidityPositions } from '@/lib/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';

const SHARE_PRICE_SOL = 0.01;

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
      yesPoolLamports: marketsCache.yesPoolLamports,
      noPoolLamports: marketsCache.noPoolLamports,
    })
    .from(positions)
    .innerJoin(marketsCache, eq(marketsCache.marketPubkey, positions.marketPubkey))
    .where(eq(positions.wallet, wallet));

  if (rows.length === 0) return [];

  // Current mark price from the REAL on-chain pool reserves (the same numbers
  // the market detail page reads from the AMM), NOT the market_outcomes table
  // — that table is only written on market creation and would leave every
  // position frozen at its listing price forever. markets_cache pools are
  // mirrored from chain after every trade/LP by the reducer + sync routes, so
  // positions revalue live and match the detail page exactly.
  //   probability = yesPool / (yesPool + noPool);  share value = prob × 0.01.
  const pubkeys = Array.from(new Set(rows.map(r => r.marketPubkey)));
  const outcomes = await db
    .select({
      marketPubkey: marketOutcomes.marketPubkey,
      outcomeIndex: marketOutcomes.outcomeIndex,
      lastPriceBps: marketOutcomes.lastPriceBps,
      label: marketOutcomes.label,
    })
    .from(marketOutcomes)
    .where(inArray(marketOutcomes.marketPubkey, pubkeys));

  const outcomeMap = new Map<string, typeof outcomes>();
  for (const o of outcomes) {
    const key = `${o.marketPubkey}:${o.outcomeIndex}`;
    const list = outcomeMap.get(key) ?? [];
    list.push(o);
    outcomeMap.set(key, list);
  }

  return rows.map(r => {
    // SETTLED markets: shares redeem at face value — the winning side is worth
    // the full share price (0.01 SOL), the losing side 0. Pool ratios go to
    // zero when a market is redeemed, so they can't price settled positions.
    const isSettled = r.status === "settled";
    const winner = String(r.winningOutcome ?? "").toLowerCase();
    const won =
      isSettled &&
      (winner === "yes" || winner === "no") &&
      ((r.outcomeIndex === 0 && winner === "yes") || (r.outcomeIndex === 1 && winner === "no"));
    if (isSettled) {
      const settledBps = won ? 10000 : 0;
      const currentPriceSol = (settledBps / 10000) * SHARE_PRICE_SOL;
      const sharesCount = (r.shares ?? 0) / 1e6;
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
    }

    // OPEN markets: pool-ratio probability (0-10000), matching the detail
    // page's AMM view. YES is valued at the YES probability; NO at the
    // complement (NO probability).
    const yesP = Number(r.yesPoolLamports ?? 0);
    const noP = Number(r.noPoolLamports ?? 0);
    const poolTotal = yesP + noP;
    const poolYesBps = poolTotal > 0 ? Math.round((yesP / poolTotal) * 10000) : 5000;
    const currentPriceBps = poolTotal > 0
      ? (r.outcomeIndex === 0 ? poolYesBps : 10000 - poolYesBps)
      : (outcomeMap.get(`${r.marketPubkey}:${r.outcomeIndex}`)?.[0]?.lastPriceBps ?? 5000);
    // bps is the probability (0-10000); per-share SOL price = prob × 0.01.
    const currentPriceSol = (currentPriceBps / 10000) * SHARE_PRICE_SOL;

    const sharesCount = (r.shares ?? 0) / 1e6;
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

export interface LpPosition {
  id: number;
  marketPubkey: string;
  question: string;
  category: string;
  status: string;
  amountSol: number;
  lpTokens: number;
  estFeeEarnedSol: number;
  apy: string;
}

/**
 * Liquidity positions for a wallet, joined with market metadata.
 * Returns SOL deposited, LP tokens held, and earned fees.
 */
export async function getLpPositions(wallet: string): Promise<LpPosition[]> {
  if (!db) return [];

  const rows = await db
    .select({
      id: liquidityPositions.id,
      marketPubkey: liquidityPositions.marketPubkey,
      lpShares: liquidityPositions.lpShares,
      deposited: liquidityPositions.deposited,
      feesEarned: liquidityPositions.feesEarned,
      question: marketsCache.question,
      category: marketsCache.category,
      status: marketsCache.status,
    })
    .from(liquidityPositions)
    .leftJoin(marketsCache, eq(marketsCache.marketPubkey, liquidityPositions.marketPubkey))
    .where(eq(liquidityPositions.wallet, wallet))
    .orderBy(desc(liquidityPositions.updatedAt));

  return rows.map(r => {
    const feesEarnedSol = Number(r.feesEarned ?? 0);
    return {
      id: r.id,
      marketPubkey: r.marketPubkey,
      question: r.question ?? 'Unknown market',
      category: r.category ?? 'Other',
      status: r.status ?? 'open',
      amountSol: Number(r.deposited ?? 0),
      lpTokens: Number(r.lpShares ?? 0),
      estFeeEarnedSol: feesEarnedSol,
      // No real fee-velocity data is persisted, so APY cannot be computed
      // honestly. Display a dash rather than inventing a percentage.
      apy: '—',
    };
  });
}
