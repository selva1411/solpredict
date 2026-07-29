import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { marketsCache } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { badRequest, serverError, ok } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { toError } from "@/lib/errors";
import { positionsGetSchema } from "@/lib/schemas";

export const GET = apiHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const walletParam = url.searchParams.get("wallet");
  if (!walletParam) return badRequest("wallet parameter required");

  const parsed = positionsGetSchema.safeParse({ wallet: walletParam });
  if (!parsed.success) return badRequest("Invalid wallet format");

  const wallet = parsed.data.wallet;

  if (!db) return ok({ positions: [], fromDb: false });

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

  for (const [marketPubkey, data] of tradesByMarket.entries()) {
    let question = "Market " + marketPubkey.slice(0, 8);
    let category = "Crypto";
    let status = "open";
    let yesPoolSol = 100;
    let noPoolSol = 100;

    try {
      if (db) {
        const markets = await db.select({
          question: marketsCache.question,
          category: marketsCache.category,
          status: marketsCache.status,
          yesPoolSol: marketsCache.yesPoolSol,
          noPoolSol: marketsCache.noPoolSol,
        }).from(marketsCache).where(eq(marketsCache.marketPubkey, marketPubkey)).limit(1);
        if (markets.length > 0) {
          question = markets[0].question ?? question;
          category = markets[0].category ?? category;
          status = markets[0].status ?? "open";
          yesPoolSol = Number(markets[0].yesPoolSol || 100);
          noPoolSol = Number(markets[0].noPoolSol || 100);
        }
      }
    } catch {}

    const totalPool = yesPoolSol + noPoolSol || 1;
    const currentYesPrice = yesPoolSol / totalPool;
    const currentNoPrice = noPoolSol / totalPool;

    if (data.yesTokens > 0) {
      const shares = data.yesTokens / 1e6;
      const spentSol = data.yesLamports / 1e9;
      const avgPriceSol = shares > 0 ? spentSol / shares : currentYesPrice;
      const currentPriceSol = currentYesPrice;
      const valueSol = shares * currentPriceSol;
      const pnlSol = valueSol - spentSol;
      const pnlPercent = spentSol > 0 ? (pnlSol / spentSol) * 100 : 0;

      totalNetWorthSol += valueSol;
      totalPnlSol += pnlSol;
      totalSpentSol += spentSol;

      positionList.push({
        marketPubkey,
        question,
        category,
        status,
        side: "YES",
        shares,
        avgPriceSol,
        currentPriceSol,
        valueSol,
        pnlSol,
        pnlPercent,
      });
    }

    if (data.noTokens > 0) {
      const shares = data.noTokens / 1e6;
      const spentSol = data.noLamports / 1e9;
      const avgPriceSol = shares > 0 ? spentSol / shares : currentNoPrice;
      const currentPriceSol = currentNoPrice;
      const valueSol = shares * currentPriceSol;
      const pnlSol = valueSol - spentSol;
      const pnlPercent = spentSol > 0 ? (pnlSol / spentSol) * 100 : 0;

      totalNetWorthSol += valueSol;
      totalPnlSol += pnlSol;
      totalSpentSol += spentSol;

      positionList.push({
        marketPubkey,
        question,
        category,
        status,
        side: "NO",
        shares,
        avgPriceSol,
        currentPriceSol,
        valueSol,
        pnlSol,
        pnlPercent,
      });
    }
  }

  const pnl24hPct = totalSpentSol > 0 ? (totalPnlSol / totalSpentSol) * 100 : 0;

  return ok({
    ok: true,
    positions: positionList,
    stats: {
      netWorthSol: Number(totalNetWorthSol.toFixed(4)),
      pnl24hSol: Number(totalPnlSol.toFixed(4)),
      pnl24hPct: Number(pnl24hPct.toFixed(2)),
      winRate: 0.50,
    },
    fromDb: true,
  });
});
