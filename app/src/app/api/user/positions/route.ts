import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { trades, marketsCache } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const wallet = url.searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json({ error: 'wallet parameter required' }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json({ positions: [], fromDb: false });
    }

    // Aggregate trades by (market_pubkey, side)
    // YES/NO amounts, total spent, total tokens
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

    const tradesByMarket = new Map<string, { yesLamports: number; noLamports: number; yesTokens: number; noTokens: number; totalSpent: number }>();

    for (const row of rows.rows as any[]) {
      const marketPubkey = row.market_pubkey as string;
      const side = row.side as string;
      const lamports = Number(row.total_lamports ?? 0);
      const tokens = Number(row.total_tokens ?? 0);

      if (!tradesByMarket.has(marketPubkey)) {
        tradesByMarket.set(marketPubkey, { yesLamports: 0, noLamports: 0, yesTokens: 0, noTokens: 0, totalSpent: 0 });
      }
      const entry = tradesByMarket.get(marketPubkey)!;
      if (side === 'YES') {
        entry.yesLamports += lamports;
        entry.yesTokens += tokens;
      } else {
        entry.noLamports += lamports;
        entry.noTokens += tokens;
      }
      entry.totalSpent += lamports;
    }

    // Fetch market details for each market
    const positions = await Promise.all(
      Array.from(tradesByMarket.entries()).map(async ([marketPubkey, data]) => {
        let question = '';
        let category = '';
        let status = '';
        try {
          if (db) {
            const markets = await db.select({
              question: marketsCache.question,
              category: marketsCache.category,
              status: marketsCache.status,
            }).from(marketsCache).where(eq(marketsCache.marketPubkey, marketPubkey)).limit(1);
            if (markets.length > 0) {
              question = markets[0].question ?? '';
              category = markets[0].category ?? '';
              status = markets[0].status ?? 'open';
            }
          }
        } catch {}

        return {
          marketPubkey,
          question,
          category,
          status,
          yesAmount: data.yesTokens,
          noAmount: data.noTokens,
          totalSpentLamports: data.totalSpent,
          yesLamports: data.yesLamports,
          noLamports: data.noLamports,
          claimed: false,
        };
      })
    );

    return NextResponse.json({ positions, fromDb: true });
  } catch (err: any) {
    console.error("Error fetching user positions from DB:", err);
    return NextResponse.json({ positions: [], fromDb: false, error: err.message });
  }
}