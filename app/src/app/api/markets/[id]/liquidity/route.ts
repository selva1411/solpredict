export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getMarket } from "@/lib/data/markets";
import { notFound, ok, serverError, badRequest } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db/client";
import { liquidityPositions, lpPoolStats } from "@/lib/db/schema";
import { normalizeLpAllocation, lpTokensMintedFor } from "@/lib/amm/lp";
import { eq, sql } from "drizzle-orm";

function buildOrderBook(yesPricePct: number, totalVolumeSol: number) {
  const midPrice = Math.max(1, Math.min(99, yesPricePct));
  const tickSize = 1;
  const bids: Array<{ price: number; size: number; total: number }> = [];
  const asks: Array<{ price: number; size: number; total: number }> = [];

  let bidTotal = 0;
  let askTotal = 0;
  const baseSize = Math.max(10, totalVolumeSol / 10);

  for (let i = 1; i <= 5; i++) {
    const price = Math.max(1, Math.round(midPrice - i * tickSize));
    const size = baseSize * (1 + i * 0.2);
    bidTotal += size;
    bids.push({ price, size: Math.round(size), total: Math.round(bidTotal) });
  }

  for (let i = 1; i <= 5; i++) {
    const price = Math.min(99, Math.round(midPrice + i * tickSize));
    const size = baseSize * (1 + i * 0.2);
    askTotal += size;
    asks.push({ price, size: Math.round(size), total: Math.round(askTotal) });
  }

  const bestBid = bids[0]?.price ?? midPrice - tickSize;
  const bestAsk = asks[asks.length - 1]?.price ?? midPrice + tickSize;
  const spread = Math.max(0.1, bestAsk - bestBid);

  return { bids, asks, spread: Math.round(spread * 100) / 100 };
}

export const GET = apiHandler(async (_req: NextRequest, context) => {
  const params = await context.params!;
  const marketPubkey = params.id;
  if (!marketPubkey) return notFound('Market ID required');

  try {
    const market = await getMarket(marketPubkey);
    if (!market) return notFound('Market not found');

    const yesPricePct = market.yesOdds * 100;
    const { bids, asks, spread } = buildOrderBook(yesPricePct, market.totalVolume);

    return ok({
      ok: true,
      liquidity: {
        marketPubkey,
        totalVolumeSol: market.totalVolume,
        midPrice: yesPricePct,
        spread,
        bids,
        asks,
        depthData: {
          bids: bids.map(b => ({ price: b.price, cumSize: b.total })),
          asks: asks.map(a => ({ price: a.price, cumSize: a.total })),
        },
      },
    });
  } catch (err) {
    return serverError(err);
  }
});

interface LiquidityPostBody {
  walletAddress?: string;
  amountSol?: number;
  action?: string;
  option?: string;
}

export const POST = apiHandler(async (req: NextRequest, context) => {
  const params = await context.params!;
  const marketPubkey = params.id;
  if (!marketPubkey) return notFound("Market ID required");

  let body: LiquidityPostBody = {};
  try {
    body = (await req.json()) as LiquidityPostBody;
  } catch {
    return badRequest("Invalid JSON body");
  }

  const walletAddress = body.walletAddress;
  const amountSol = Number(body.amountSol ?? 0);
  const option = body.option ?? "balanced";
  // Guard against NaN (Number("abc") === NaN, and NaN <= 0 is false, which
  // would otherwise slip past the positivity check and poison the DB).
  if (!walletAddress || !Number.isFinite(amountSol) || amountSol <= 0) {
    return badRequest("walletAddress and a positive finite amountSol are required");
  }

  if (!db) return serverError(new Error("Database not available"));

  try {
    // Upsert the user's LP position in the DB so the LP tab reflects real deposits.
    const existing = await db
      .select()
      .from(liquidityPositions)
      .where(
        sql`${liquidityPositions.wallet} = ${walletAddress} AND ${liquidityPositions.marketPubkey} = ${marketPubkey}`
      )
      .limit(1);

    // LP share units: on-chain `add_liquidity` mints LP tokens 1:1 with
    // lamports deposited (`lp_tokens_minted = yes_lamports + no_lamports`).
    // The indexer (applyLiquidityEvent) writes `lpTokensMinted` straight into
    // lpShares, so this route must use the SAME unit (lamports, 1e9/SOL) or
    // the portfolio LP count drifts 1000x from the on-chain truth.
    //
    // Replicate the exact per-side split the UI/on-chain uses (balanced =
    // half each) and sum the ROUNDED lamports, so lpShares equals the exact
    // `lp_tokens_minted` the program produced — round(total*1e9) can differ
    // from round(yes)+round(no) by a lamport on balanced deposits.
    const lpTokensMinted = lpTokensMintedFor(normalizeLpAllocation(option), amountSol);

    if (existing.length > 0) {
      await db
        .update(liquidityPositions)
        .set({
          lpShares: sql`${liquidityPositions.lpShares} + ${lpTokensMinted}`,
          deposited: sql`${liquidityPositions.deposited} + ${amountSol.toFixed(9)}`,
          updatedAt: new Date(),
        })
        .where(eq(liquidityPositions.id, existing[0].id));
    } else {
      await db.insert(liquidityPositions).values({
        wallet: walletAddress,
        marketPubkey,
        lpShares: lpTokensMinted,
        deposited: amountSol.toFixed(9),
        feesEarned: "0",
      });
    }

    // Update market-level LP pool stats (LP tokens in the same lamport unit
    // as on-chain `lp_tokens_minted`, matching applyLiquidityEvent).
    await db
      .insert(lpPoolStats)
      .values({
        marketPubkey,
        totalLiquiditySol: amountSol.toFixed(9),
        totalLpTokens: lpTokensMinted,
        feeEarnedSol: "0",
      })
      .onConflictDoUpdate({
        target: lpPoolStats.marketPubkey,
        set: {
          totalLiquiditySol: sql`${lpPoolStats.totalLiquiditySol} + ${amountSol.toFixed(9)}`,
          totalLpTokens: sql`${lpPoolStats.totalLpTokens} + ${lpTokensMinted}`,
          updatedAt: new Date(),
        },
      });

    // NOTE: do NOT bump totalVolume — LP deposits are not trade volume.
    // Liquidity is tracked separately in lpPoolStats.totalLiquiditySol.
    // (Conflating the two inflates the home/markets "volume" stats and
    // contradicts market-pools.ts.)

    return ok({
      ok: true,
      recorded: true,
      walletAddress,
      amountSol,
      marketPubkey,
    });
  } catch (err) {
    return serverError(err);
  }
});
