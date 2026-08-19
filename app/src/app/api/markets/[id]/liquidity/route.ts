export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getMarket } from "@/lib/data/markets";
import { notFound, ok, serverError, badRequest } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { db } from "@/lib/db/client";
import { liquidityPositions, lpPoolStats, marketsCache } from "@/lib/db/schema";
import { fetchOrderBook, verifyLiquiditySignature } from "@/lib/indexer/onchain";
import { eq, sql } from "drizzle-orm";

export const GET = apiHandler(async (req: NextRequest, context) => {
  const params = await context.params!;
  const marketPubkey = params.id;
  if (!marketPubkey) return notFound('Market ID required');

  try {
    const market = await getMarket(marketPubkey);
    if (!market) return notFound('Market not found');

    // The order book is REAL on-chain data (program Order accounts) — never a
    // fabricated ladder. Empty when no open orders exist.
    const book = await fetchOrderBook(marketPubkey);
    const yesPricePct = market.yesOdds * 100;

    // Market-level LP pool stats (DB — the same lp_pool_stats the admin/other
    // pages read) plus the requesting wallet's own LP position in this market
    // so the market page mirrors the portfolio's Liquidity Positions section.
    const walletParam = req.nextUrl.searchParams.get("wallet")?.trim() || undefined;
    const [poolStats, userLp] = db ? await Promise.all([
      db.select({
        totalLiquiditySol: lpPoolStats.totalLiquiditySol,
        totalLpTokens: lpPoolStats.totalLpTokens,
        feeEarnedSol: lpPoolStats.feeEarnedSol,
        updatedAt: lpPoolStats.updatedAt,
      }).from(lpPoolStats).where(eq(lpPoolStats.marketPubkey, marketPubkey)).limit(1),
      walletParam
        ? db.select({
            lpShares: liquidityPositions.lpShares,
            deposited: liquidityPositions.deposited,
            feesEarned: liquidityPositions.feesEarned,
            updatedAt: liquidityPositions.updatedAt,
          }).from(liquidityPositions)
            .where(sql`${liquidityPositions.wallet} = ${walletParam} AND ${liquidityPositions.marketPubkey} = ${marketPubkey}`)
            .limit(1)
        : Promise.resolve([] as Array<Record<string, unknown>>),
    ]) : [
      [],
      [] as Array<Record<string, unknown>>,
    ];

    return ok({
      ok: true,
      liquidity: {
        marketPubkey,
        totalVolumeSol: market.totalVolume,
        midPrice: yesPricePct,
        spread: book.spread ?? null,
        bids: book.bids,
        asks: book.asks,
        bestBid: book.bestBid ?? null,
        bestAsk: book.bestAsk ?? null,
      },
      lpPoolStats: poolStats[0] ?? null,
      userLp: userLp[0] ?? null,
    });
  } catch (err) {
    return serverError(err);
  }
});

interface LiquidityPostBody {
  walletAddress?: string;
  /** Confirmed add_liquidity transaction signature — REQUIRED for recording. */
  signature?: string;
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
  const signature = body.signature;
  if (!walletAddress) {
    return badRequest("walletAddress is required");
  }
  if (!signature) {
    return badRequest(
      "signature is required: LP deposits are only recorded after the add_liquidity transaction is confirmed on-chain",
    );
  }

  if (!db) return serverError(new Error("Database not available"));

  try {
    // Verify the deposit on-chain FIRST. The wallet address in the body is not
    // trusted — the provider and deposit amounts come from the parsed
    // transaction, so a forged request cannot create fake LP positions.
    const verified = await verifyLiquiditySignature(signature, {
      marketPubkey,
      provider: walletAddress,
    });

    const lpTokensMinted = verified.lpTokensMinted;
    const depositedSol = (verified.yesLamports + verified.noLamports) / 1e9;

    // Upsert the user's LP position from the VERIFIED deposit.
    const existing = await db
      .select()
      .from(liquidityPositions)
      .where(
        sql`${liquidityPositions.wallet} = ${walletAddress} AND ${liquidityPositions.marketPubkey} = ${marketPubkey}`
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(liquidityPositions)
        .set({
          lpShares: sql`${liquidityPositions.lpShares} + ${lpTokensMinted}`,
          deposited: sql`${liquidityPositions.deposited} + ${depositedSol.toFixed(9)}`,
          updatedAt: new Date(),
        })
        .where(eq(liquidityPositions.id, existing[0].id));
    } else {
      await db.insert(liquidityPositions).values({
        wallet: walletAddress,
        marketPubkey,
        lpShares: lpTokensMinted,
        deposited: depositedSol.toFixed(9),
        feesEarned: "0",
      });
    }

    // Update market-level LP pool stats (LP tokens in the same lamport unit
    // as on-chain `lp_tokens_minted`).
    await db
      .insert(lpPoolStats)
      .values({
        marketPubkey,
        totalLiquiditySol: depositedSol.toFixed(9),
        totalLpTokens: lpTokensMinted,
        feeEarnedSol: "0",
      })
      .onConflictDoUpdate({
        target: lpPoolStats.marketPubkey,
        set: {
          totalLiquiditySol: sql`${lpPoolStats.totalLiquiditySol} + ${depositedSol.toFixed(9)}`,
          totalLpTokens: sql`${lpPoolStats.totalLpTokens} + ${lpTokensMinted}`,
          updatedAt: new Date(),
        },
      });

    // Mirror the REAL post-deposit pools when available (from the tx's market
    // account read) so list pages revalue immediately.
    if (typeof verified.yesPoolLamports === "number" && typeof verified.noPoolLamports === "number") {
      await db.update(marketsCache).set({
        yesPoolLamports: verified.yesPoolLamports,
        noPoolLamports: verified.noPoolLamports,
        updatedAt: new Date(),
      }).where(eq(marketsCache.marketPubkey, marketPubkey));
    }

    // NOTE: do NOT bump totalVolume — LP deposits are not trade volume.

    return ok({
      ok: true,
      recorded: true,
      verified: true,
      walletAddress,
      amountSol: depositedSol,
      lpTokensMinted,
      marketPubkey,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Verification failures (unconfirmed/fake/duplicate signatures) are client
    // errors — the DB was never touched.
    return ok({ ok: false, error: msg }, { status: 400 } as ResponseInit);
  }
});
