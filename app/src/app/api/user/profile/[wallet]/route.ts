export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { assertDb } from "@/lib/db/client";
import { users, userStats, follows, trades, marketsCache, positions, achievements } from "@/lib/db/schema";
import { eq, count, sql, desc } from "drizzle-orm";
import { ok, badRequest, notFound, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

/**
 * GET /api/user/profile/[wallet]
 *
 * Renders full profile data for ANY valid wallet per spec §3.9.
 * Reads materialized aggregates from `user_stats` table as source of truth.
 * Returns `winRate: null` when user has 0 settled markets so UI renders `—`.
 */
export const GET = apiHandler(async (_req: NextRequest, context: { params?: Promise<Record<string, string>> } = {}) => {
  const params = await context.params;
  const wallet = params?.wallet;

  if (!wallet || wallet.length < 32 || wallet.length > 44) {
    return notFound("Invalid wallet address");
  }

  try {
    const db = assertDb();

    // 1. Fetch or create user record
    let [user] = await db.select().from(users).where(eq(users.wallet, wallet)).limit(1);

    if (!user) {
      // Auto-create basic profile row for new/inactive wallet so every valid wallet renders
      [user] = await db
        .insert(users)
        .values({
          wallet,
          username: `trader_${wallet.slice(0, 6)}`,
          avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${wallet}`,
        })
        .onConflictDoNothing()
        .returning();

      if (!user) {
        [user] = await db.select().from(users).where(eq(users.wallet, wallet)).limit(1);
      }
    }

    // 2. Fetch materialized stats from user_stats table
    const [stats] = await db.select().from(userStats).where(eq(userStats.wallet, wallet)).limit(1);

    // 3. Followers / Following count
    const [[followerRow], [followingRow]] = await Promise.all([
      db.select({ count: count() }).from(follows).where(eq(follows.followedWallet, wallet)),
      db.select({ count: count() }).from(follows).where(eq(follows.followerWallet, wallet)),
    ]);

    // 4. Win rate rule per spec §2.3: null if 0 settled markets
    const marketsResolved = stats?.marketsResolved ?? 0;
    const winRateBps = stats?.winRateBps ?? null;
    const winRatePct = marketsResolved > 0 && winRateBps !== null ? Number((winRateBps / 100).toFixed(2)) : null;

    // 5. Recent trade activity for tabs
    const recentTrades = await db
      .select({
        id: trades.id,
        signature: trades.signature,
        marketPubkey: trades.marketPubkey,
        side: trades.side,
        lamportsIn: trades.lamportsIn,
        tokensOut: trades.tokensOut,
        pricePerToken: trades.pricePerToken,
        blockTime: trades.blockTime,
      })
      .from(trades)
      .where(eq(trades.trader, wallet))
      .orderBy(desc(trades.blockTime))
      .limit(10);

    // 6. Achievements
    const userAchievements = await db
      .select()
      .from(achievements)
      .where(eq(achievements.wallet, wallet));

    return ok({
      ok: true,
      profile: {
        wallet: user.wallet,
        username: user.username,
        avatarUrl: user.avatarUrl ?? `https://api.dicebear.com/7.x/identicon/svg?seed=${user.wallet}`,
        bio: user.bio ?? "",
        twitterHandle: user.twitterHandle ?? "",
        role: user.role ?? "user",
        isBanned: user.isBanned ?? false,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
        followersCount: followerRow?.count ?? 0,
        followingCount: followingRow?.count ?? 0,
      },
      stats: {
        totalVolume: Number(stats?.totalVolume ?? 0),
        realizedPnl: Number(stats?.realizedPnl ?? 0),
        unrealizedPnl: Number(stats?.unrealizedPnl ?? 0),
        winRatePct, // NULL when 0 settled markets per spec §2.3!
        winRateBps,
        roiBps: stats?.roiBps ?? null,
        marketsTraded: stats?.marketsTraded ?? 0,
        marketsResolved,
        wins: stats?.wins ?? 0,
        losses: stats?.losses ?? 0,
        bestTrade: Number(stats?.bestTrade ?? 0),
        currentStreak: stats?.currentStreak ?? 0,
        rank: stats?.rank ?? null,
        pasScore: 50,
      },
      tabs: {
        recentTrades,
        achievements: userAchievements,
      },
    });
  } catch (err) {
    return serverError(err);
  }
});

/**
 * POST /api/user/profile/[wallet]
 *
 * Updates profile info (username, bio, avatarUrl, twitterHandle).
 * Enforces username uniqueness in DB.
 */
export const POST = apiHandler(async (req: NextRequest, context: { params?: Promise<Record<string, string>> } = {}) => {
  const params = await context.params;
  const wallet = params?.wallet;

  if (!wallet || wallet.length < 32) {
    return badRequest("Valid wallet address required");
  }

  const callerWallet = req.headers.get("x-wallet");
  if (!callerWallet || callerWallet !== wallet) {
    return badRequest("Unauthorized: You can only edit your own profile");
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");

  const { username, bio, avatarUrl, twitterHandle } = body as {
    username?: string;
    bio?: string;
    avatarUrl?: string;
    twitterHandle?: string;
  };

  try {
    const db = assertDb();

    // Check username uniqueness if changing
    if (username && username.trim().length > 0) {
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.username, username.trim()))
        .limit(1);

      if (existing.length > 0 && existing[0].wallet !== wallet) {
        return badRequest(`Username '${username.trim()}' is already taken`);
      }
    }

    const [updated] = await db
      .update(users)
      .set({
        username: username?.trim() || undefined,
        bio: bio?.trim() ?? undefined,
        avatarUrl: avatarUrl?.trim() ?? undefined,
        twitterHandle: twitterHandle?.trim() ?? undefined,
        lastActive: new Date(),
      })
      .where(eq(users.wallet, wallet))
      .returning();

    return ok({
      ok: true,
      profile: updated,
      message: "Profile updated successfully",
    });
  } catch (err) {
    return serverError(err);
  }
});
