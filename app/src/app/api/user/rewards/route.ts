export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { assertDb } from "@/lib/db/client";
import { rewards, userStats, trades, positions, marketsCache } from "@/lib/db/schema";
import { eq, and, sql, count } from "drizzle-orm";
import { ok, badRequest, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

/**
 * GET /api/user/rewards?wallet=
 *
 * Full rewards breakdown per user per spec §3.8:
 * - Claimable total
 * - Per-kind breakdown (trading, lp, referral, quest, airdrop)
 * - Real quest checklist with progress bars fed by SQL
 * - Epoch history table
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  if (!wallet || wallet.length < 32) {
    return badRequest("Valid wallet address required");
  }

  try {
    const db = assertDb();

    // 1. Fetch user reward rows
    const rewardRows = await db
      .select()
      .from(rewards)
      .where(eq(rewards.wallet, wallet));

    const claimableRows = rewardRows.filter((r) => r.status === "claimable");
    const claimableTotalLamports = claimableRows.reduce((sum, r) => sum + (r.amount ?? 0), 0);

    // Breakdown per kind
    const breakdown = {
      tradingSol: (rewardRows.filter((r) => r.kind === "trading").reduce((s, r) => s + (r.amount ?? 0), 0)) / 1e9,
      lpSol: (rewardRows.filter((r) => r.kind === "lp").reduce((s, r) => s + (r.amount ?? 0), 0)) / 1e9,
      referralSol: (rewardRows.filter((r) => r.kind === "referral").reduce((s, r) => s + (r.amount ?? 0), 0)) / 1e9,
      questSol: (rewardRows.filter((r) => r.kind === "quest").reduce((s, r) => s + (r.amount ?? 0), 0)) / 1e9,
      airdropSol: (rewardRows.filter((r) => r.kind === "airdrop").reduce((s, r) => s + (r.amount ?? 0), 0)) / 1e9,
    };

    // 2. Real Quest Checklist fed by SQL queries per spec §3.8
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
        rewardSol: 0.05,
        target: 1,
        current: Math.min(1, userTradeCount),
        completed: userTradeCount >= 1,
      },
      {
        id: "five_categories",
        name: "Diverse Predictor",
        description: "Trade in 5 different market categories",
        rewardSol: 0.2,
        target: 5,
        current: Math.min(5, categoriesTraded),
        completed: categoriesTraded >= 5,
      },
      {
        id: "trade_volume_10",
        name: "High Roller",
        description: "Accumulate 10 SOL in total trading volume",
        rewardSol: 0.5,
        target: 10,
        current: Math.min(10, Number(stats?.totalVolume ?? 0)),
        completed: Number(stats?.totalVolume ?? 0) >= 10,
      },
      {
        id: "winning_streak_3",
        name: "On Fire",
        description: "Achieve a 3-market winning streak",
        rewardSol: 0.3,
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
 * Claims all pending claimable rewards for the user.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const wallet = req.headers.get("x-wallet");
  if (!wallet || wallet.length < 32) {
    return badRequest("x-wallet header required");
  }

  try {
    const db = assertDb();
    const claimableRows = await db
      .select()
      .from(rewards)
      .where(and(eq(rewards.wallet, wallet), eq(rewards.status, "claimable")));

    if (claimableRows.length === 0) {
      return badRequest("No claimable rewards available");
    }

    const claimSignature = req.headers.get("x-signature") || `claim_${Date.now()}`;
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
      count: claimableRows.length,
      message: "Rewards claimed successfully",
    });
  } catch (err) {
    return serverError(err);
  }
});
