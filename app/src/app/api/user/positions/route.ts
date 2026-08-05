import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { marketsCache, liquidityPositions } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { badRequest, ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { positionsGetSchema } from "@/lib/schemas";

export const GET = apiHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const walletParam = url.searchParams.get("wallet");
  if (!walletParam) return badRequest("wallet parameter required");

  const parsed = positionsGetSchema.safeParse({ wallet: walletParam });
  if (!parsed.success) return badRequest("Invalid wallet format");

  const wallet = parsed.data.wallet;

  if (!db) return ok({ ok: true, positions: [], lpPositions: [], stats: { netWorthSol: 0, pnl24hSol: 0, pnl24hPct: 0, winRate: 0 }, fromDb: false });

  // Get trade positions from trades table
  const rows = await db.execute(sql`
    SELECT
      market_pubkey,
      side,
      SUM(lamports_in) as total_lamports,
      SUM(tokens_out) as total_tokens,
      COUNT(*) as trade_count
    FROM trades
    WHERE trader = ${wallet}
    GROUP BY market_pubkey, side
    ORDER BY MAX(block_time) DESC
  `);

  const tradesByMarket = new Map<string, {
    yesLamports: number; noLamports: number; yesTokens: number; noTokens: number; totalSpent: number;
  }>();

  for (const row of rows.rows as Record<string, unknown>[]) {
    const marketPubkey = String(row.market_pubkey ?? "");
    const side = String(row.side ?? "");
    const lamports = Number(row.total_lamports ?? 0);
    const tokens = Number(row.total_tokens ?? 0);

    if (!tradesByMarket.has(marketPubkey)) {
      tradesByMarket.set(marketPubkey, { yesLamports: 0, noLamports: 0, yesTokens: 0, noTokens: 0, totalSpent: 0 });
    }
    const entry = tradesByMarket.get(marketPubkey)!;
    if (side === "YES") {
      entry.yesLamports += lamports;
      entry.yesTokens += tokens;
    } else {
      entry.noLamports += lamports;
      entry.noTokens += tokens;
    }
    entry.totalSpent += lamports;
  }

  const positionList: any[] = [];
  let totalNetWorthSol = 0;
  let totalPnlSol = 0;
  let totalSpentSol = 0;
  let winCount = 0;
  let totalSettled = 0;

  for (const [marketPubkey, data] of tradesByMarket.entries()) {
    let question = "Market " + marketPubkey.slice(0, 8);
    let category = "Crypto";
    let status = "open";
    let yesPoolSol = 0;
    let noPoolSol = 0;
    let winningOutcome: string | null = null;

    try {
      const mktRows = await db.select({
        question: marketsCache.question,
        category: marketsCache.category,
        status: marketsCache.status,
        yesPoolSol: marketsCache.yesPoolSol,
        noPoolSol: marketsCache.noPoolSol,
        winningOutcome: marketsCache.winningOutcome,
      }).from(marketsCache).where(eq(marketsCache.marketPubkey, marketPubkey)).limit(1);
      if (mktRows.length > 0) {
        question = mktRows[0].question ?? question;
        category = mktRows[0].category ?? category;
        status = mktRows[0].status ?? "open";
        yesPoolSol = Number(mktRows[0].yesPoolSol || 0);
        noPoolSol = Number(mktRows[0].noPoolSol || 0);
        winningOutcome = mktRows[0].winningOutcome ?? null;
      }
    } catch {}

    const totalPool = yesPoolSol + noPoolSol;
    // LMSR/CPMM: YES price = YES_pool / total (larger YES pool = higher YES price)
    const currentYesPrice = totalPool > 0 ? yesPoolSol / totalPool : 0.5;
    const currentNoPrice = totalPool > 0 ? noPoolSol / totalPool : 0.5;

    // Track win/loss for settled markets (case-insensitive outcome)
    if (status === 'settled' && winningOutcome) {
      totalSettled++;
      const outcome = winningOutcome.toLowerCase();
      const wonYes = outcome === 'yes' && data.yesTokens > 0;
      const wonNo = outcome === 'no' && data.noTokens > 0;
      if (wonYes || wonNo) winCount++;
    }

    if (data.yesTokens > 0) {
      const shares = data.yesTokens / 1e6;
      const spentSol = data.yesLamports / 1e9;
      const avgPriceSol = shares > 0 ? spentSol / shares : currentYesPrice;
      const currentPriceSol = status === 'settled'
        ? ((winningOutcome ?? "").toLowerCase() === 'yes' ? 1 : 0)
        : currentYesPrice;
      const valueSol = shares * currentPriceSol;
      const pnlSol = valueSol - spentSol;
      const pnlPercent = spentSol > 0 ? (pnlSol / spentSol) * 100 : 0;

      totalNetWorthSol += valueSol;
      totalPnlSol += pnlSol;
      totalSpentSol += spentSol;

      positionList.push({
        marketPubkey, question, category, status,
        side: "YES", shares, avgPriceSol, currentPriceSol,
        valueSol, pnlSol, pnlPercent,
      });
    }

    if (data.noTokens > 0) {
      const shares = data.noTokens / 1e6;
      const spentSol = data.noLamports / 1e9;
      const avgPriceSol = shares > 0 ? spentSol / shares : currentNoPrice;
      const currentPriceSol = status === 'settled'
        ? ((winningOutcome ?? "").toLowerCase() === 'no' ? 1 : 0)
        : currentNoPrice;
      const valueSol = shares * currentPriceSol;
      const pnlSol = valueSol - spentSol;
      const pnlPercent = spentSol > 0 ? (pnlSol / spentSol) * 100 : 0;

      totalNetWorthSol += valueSol;
      totalPnlSol += pnlSol;
      totalSpentSol += spentSol;

      positionList.push({
        marketPubkey, question, category, status,
        side: "NO", shares, avgPriceSol, currentPriceSol,
        valueSol, pnlSol, pnlPercent,
      });
    }
  }

  const pnl24hPct = totalSpentSol > 0 ? (totalPnlSol / totalSpentSol) * 100 : 0;
  const winRate = totalSettled > 0 ? winCount / totalSettled : 0;

  // Fetch LP positions for this wallet
  let lpPositionsList: any[] = [];
  try {
    const lpRows = await db.select({
      id: liquidityPositions.id,
      marketPubkey: liquidityPositions.marketPubkey,
      amountSol: liquidityPositions.amountSol,
      yesPoolSol: liquidityPositions.yesPoolSol,
      noPoolSol: liquidityPositions.noPoolSol,
      lpTokens: liquidityPositions.lpTokens,
      question: marketsCache.question,
      category: marketsCache.category,
      status: marketsCache.status,
    })
    .from(liquidityPositions)
    .leftJoin(marketsCache, eq(liquidityPositions.marketPubkey, marketsCache.marketPubkey))
    .where(eq(liquidityPositions.wallet, wallet));

    lpPositionsList = lpRows.map(r => {
      const amount = Number(r.amountSol || 0);
      const lpTokens = Number(r.lpTokens || 0);
      // Real fee yield comes from lp_pool_stats (updated by indexers), not a
      // fabricated 2% estimate. Fall back to 0 rather than inventing data.
      const estFeeEarned = 0;
      return {
        id: r.id,
        marketPubkey: r.marketPubkey,
        question: r.question ?? ("Market " + r.marketPubkey.slice(0, 8)),
        category: r.category ?? "Crypto",
        status: r.status ?? "open",
        amountSol: amount,
        lpTokens,
        estFeeEarnedSol: Number(estFeeEarned.toFixed(4)),
        apy: '0%',
      };
    });
  } catch {}

  return ok({
    ok: true,
    positions: positionList,
    lpPositions: lpPositionsList,
    stats: {
      netWorthSol: Number(totalNetWorthSol.toFixed(4)),
      pnl24hSol: Number(totalPnlSol.toFixed(4)),
      pnl24hPct: Number(pnl24hPct.toFixed(2)),
      winRate: Number(winRate.toFixed(2)),
    },
    fromDb: true,
  });
});
