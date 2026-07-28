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

  const positions = await Promise.all(
    Array.from(tradesByMarket.entries()).map(async ([marketPubkey, data]) => {
      let question = "";
      let category = "";
      let status = "";
      try {
        if (db) {
          const markets = await db.select({
            question: marketsCache.question,
            category: marketsCache.category,
            status: marketsCache.status,
          }).from(marketsCache).where(eq(marketsCache.marketPubkey, marketPubkey)).limit(1);
          if (markets.length > 0) {
            question = markets[0].question ?? "";
            category = markets[0].category ?? "";
            status = markets[0].status ?? "open";
          }
        }
      } catch {}
      return {
        marketPubkey, question, category, status,
        yesAmount: data.yesTokens, noAmount: data.noTokens,
        totalSpentLamports: data.totalSpent,
        yesLamports: data.yesLamports, noLamports: data.noLamports,
        claimed: false,
      };
    }),
  );

  return ok({ positions, fromDb: true });
});
