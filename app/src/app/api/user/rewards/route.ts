export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { assertDb } from "@/lib/db/client";
import { rewards, userStats, trades, marketsCache } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { walletSchema } from "@/lib/schemas";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { requireUser } from "@/lib/user-guard";
import { PublicKey } from "@solana/web3.js";
import { verifySignature } from "@/lib/auth";
import { verifyRewardClaimSignature } from "@/lib/indexer/onchain";

/**
 * GET /api/user/rewards?wallet=
 *
 * Returns the user's reward rows and quest progress. Quest progress is fed by
 * real SQL aggregates; reward amounts shown come exclusively from the rewards
 * table (no fabricated promises — nothing displays a reward that was never
 * accrued on-chain or in the ledger).
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const rawWallet = searchParams.get("wallet");
  const parsedWallet = walletSchema.safeParse(rawWallet ?? "");
  if (!parsedWallet.success) {
    return badRequest("Valid wallet address required");
  }
  const wallet = parsedWallet.data;

  // Rewards expose claimable monetary balances and quest progress. This is
  // owner-sensitive data (no public "view anyone's rewards" page exists), so
  // require the caller to prove ownership of the requested wallet.
  const auth = await requireUser(req, wallet);
  if (!auth.ok) return auth.response;

  try {
    const db = assertDb();

    const rewardRows = await db
      .select()
      .from(rewards)
      .where(eq(rewards.wallet, wallet));

    const claimableRows = rewardRows.filter((r) => r.status === "claimable");
    const claimableTotalLamports = claimableRows.reduce((sum, r) => sum + (r.amount ?? 0), 0);

    // Breakdown per kind (real accrued amounts only).
    const breakdown = {
      tradingSol: (rewardRows.filter((r) => r.kind === "trading").reduce((s, r) => s + (r.amount ?? 0), 0)) / 1e9,
      lpSol: (rewardRows.filter((r) => r.kind === "lp").reduce((s, r) => s + (r.amount ?? 0), 0)) / 1e9,
      referralSol: (rewardRows.filter((r) => r.kind === "referral").reduce((s, r) => s + (r.amount ?? 0), 0)) / 1e9,
      questSol: (rewardRows.filter((r) => r.kind === "quest").reduce((s, r) => s + (r.amount ?? 0), 0)) / 1e9,
      airdropSol: (rewardRows.filter((r) => r.kind === "airdrop").reduce((s, r) => s + (r.amount ?? 0), 0)) / 1e9,
    };

    // Quest progress fed by SQL — no fabricated reward amounts.
    const [tradeCountRow] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(trades)
      .where(eq(trades.trader, wallet));

    const categoryCountRes = await db.execute(sql`
      SELECT COUNT(DISTINCT m.category)::int as count
      FROM trades t
      JOIN markets_cache m ON m.market_pubkey = t.market_pubkey
      WHERE t.trader = ${wallet}
    `);

    const userTradeCount = tradeCountRow?.count ?? 0;
    const categoriesTraded = Number((categoryCountRes.rows?.[0] as Record<string, unknown> | undefined)?.count ?? 0);

    const [stats] = await db.select().from(userStats).where(eq(userStats.wallet, wallet)).limit(1);

    const quests = [
      {
        id: "first_trade",
        name: "First Trade",
        description: "Execute your first prediction trade",
        target: 1,
        current: Math.min(1, userTradeCount),
        completed: userTradeCount >= 1,
      },
      {
        id: "five_categories",
        name: "Diverse Predictor",
        description: "Trade in 5 different market categories",
        target: 5,
        current: Math.min(5, categoriesTraded),
        completed: categoriesTraded >= 5,
      },
      {
        id: "trade_volume_10",
        name: "High Roller",
        description: "Accumulate 10 SOL in total trading volume",
        target: 10,
        current: Math.min(10, Number(stats?.totalVolume ?? 0)),
        completed: Number(stats?.totalVolume ?? 0) >= 10,
      },
      {
        id: "winning_streak_3",
        name: "On Fire",
        description: "Achieve a 3-market winning streak",
        target: 3,
        current: Math.min(3, stats?.currentStreak ?? 0),
        completed: (stats?.currentStreak ?? 0) >= 3,
      },
    ];

    return ok({
      ok: true,
      claimableTotalSol: Number((claimableTotalLamports / 1e9).toFixed(4)),
      claimableTotalLamports,
      breakdown,
      quests,
      history: rewardRows.map((r) => ({
        id: r.id,
        epoch: r.epoch,
        kind: r.kind,
        amountSol: Number(((r.amount ?? 0) / 1e9).toFixed(4)),
        status: r.status,
        claimSignature: r.claimSignature,
        claimedAt: r.claimedAt,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    return serverError(err);
  }
});

/**
 * POST /api/user/rewards/claim
 *
 * Claims pending rewards. A claim is only recorded when ALL of the following
 * hold:
 *   1. The wallet proves ownership by signing the exact message we present
 *      (x-message / x-signature headers — the body wallet is never trusted).
 *   2. A real claim transaction exists on-chain (claim_rewards / claim_refund)
 *      for that wallet, submitted as `signature` and verified via RPC.
 *   3. The rewards rows are still in `claimable` status.
 * Rows are marked claimed only after the on-chain claim is confirmed.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const wallet = req.headers.get("x-wallet")?.trim();
  const message = req.headers.get("x-message");
  const proofSignature = req.headers.get("x-signature");
  if (!wallet || wallet.length < 32) {
    return badRequest("x-wallet header required");
  }
  if (!message || !proofSignature) {
    return badRequest("x-message and x-signature headers required to prove wallet ownership");
  }

  // 1. Verify wallet ownership (the wallet must have signed `message`).
  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(wallet);
  } catch {
    return badRequest("Invalid wallet address");
  }
  let sigBytes: Uint8Array;
  try {
    sigBytes = Buffer.from(proofSignature, "base64");
  } catch {
    return badRequest("Invalid signature encoding");
  }
  if (!verifySignature(message, sigBytes, pubkey)) {
    return badRequest("Signature verification failed — you must sign the challenge with the wallet you are claiming for");
  }

  // 2. The on-chain claim transaction must be confirmed and verified.
  const body = await req.json().catch(() => ({}));
  const claimSignature = typeof body?.signature === "string" ? body.signature.trim() : "";
  if (!claimSignature) {
    return badRequest("signature (the confirmed on-chain claim transaction) is required");
  }

  try {
    const verified = await verifyRewardClaimSignature(claimSignature, wallet);
    if (!verified.claimer || verified.claimer !== wallet) {
      return badRequest("The on-chain claim transaction was not made by this wallet");
    }

    const db = assertDb();
    const claimableRows = await db
      .select()
      .from(rewards)
      .where(and(eq(rewards.wallet, wallet), eq(rewards.status, "claimable")));

    if (claimableRows.length === 0) {
      return badRequest("No claimable rewards available");
    }

    const ids = claimableRows.map((r) => r.id);

    await db
      .update(rewards)
      .set({
        status: "claimed",
        claimSignature,
        claimedAt: new Date(),
      })
      .where(sql`id IN (${sql.join(ids, sql`, `)})`);

    const totalClaimedLamports = claimableRows.reduce((sum, r) => sum + (r.amount ?? 0), 0);

    return ok({
      ok: true,
      claimedLamports: totalClaimedLamports,
      claimedSol: totalClaimedLamports / 1e9,
      claimSignature,
      onChainPayoutLamports: verified.payoutLamports,
      count: claimableRows.length,
      message: "Rewards claimed successfully (on-chain claim verified)",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return ok({ ok: false, error: msg }, { status: 400 } as ResponseInit);
  }
});
