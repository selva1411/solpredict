import { db } from '@/lib/db/client';
import { userStats, trades, marketsCache, users, follows, achievements as achievementsTable, marketProposals, leaderboardSnapshots } from '@/lib/db/schema';
import { eq, and, desc, sql, count, inArray } from 'drizzle-orm';
import { computePasScore } from '@/lib/pas';

// Canonical homes for position/trade queries. Re-exported here so the existing
// call sites importing from '@/lib/data/users' keep working; the implementation
// lives in the domain modules (positions.ts / trades.ts) — see the data-layer
// layout in docs/AUDIT-REPORT.md Phase 3.
export { getPositions, getLpPositions } from './positions';
export type { LpPosition } from './positions';
export { getTradeHistory, getPnlSeries, getRecentActivity } from './trades';

export async function getUserStats(wallet: string) {
  if (!db) return null;

  const rows = await db
    .select()
    .from(userStats)
    .where(eq(userStats.wallet, wallet))
    .limit(1);

  if (rows.length === 0) {
    return {
      wallet,
      totalVolume: 0,
      tradeCount: 0,
      marketsTraded: 0,
      marketsResolved: 0,
      wins: 0,
      losses: 0,
      winRateBps: null, // Null per spec when 0 settled markets
      realizedPnl: 0,
      unrealizedPnl: 0,
      roiBps: null,
      bestTrade: 0,
      currentStreak: 0,
      rank: null,
    };
  }

  const s = rows[0];
  return {
    wallet: s.wallet,
    totalVolume: Number(s.totalVolume ?? 0),
    tradeCount: s.tradeCount ?? 0,
    marketsTraded: s.marketsTraded ?? 0,
    marketsResolved: s.marketsResolved ?? 0,
    wins: s.wins ?? 0,
    losses: s.losses ?? 0,
    winRateBps: s.marketsResolved && s.marketsResolved > 0 ? s.winRateBps : null,
    realizedPnl: Number(s.realizedPnl ?? 0),
    unrealizedPnl: Number(s.unrealizedPnl ?? 0),
    roiBps: s.roiBps,
    bestTrade: Number(s.bestTrade ?? 0),
    currentStreak: s.currentStreak ?? 0,
    rank: s.rank,
  };
}







/* -------------------------------------------------------------------------- */
/* Profile / activity / achievements — shared data-layer functions.           */
/* The API routes AND the server-rendered profile page both call these, so    */
/* every surface renders identical numbers.                                    */
/* -------------------------------------------------------------------------- */

export interface ProfileResult {
  profile: {
    wallet: string;
    username?: string | null;
    avatarUrl?: string | null;
    bio?: string | null;
    twitterHandle?: string | null;
    role?: string | null;
    isBanned?: boolean | null;
    createdAt?: Date | null;
    lastActive?: Date | null;
    followersCount: number;
    followingCount: number;
    totalWagered: number;
    totalProfit: number;
    marketsTraded: number;
    winRate: number | null;
    pasScore: number | null;
  };
  stats: Record<string, unknown>;
  tabs: {
    recentTrades: {
      id: number;
      signature: string | null;
      marketPubkey: string;
      side: string | null;
      lamportsIn: number | null;
      tokensOut: number | null;
      pricePerToken: string | null;
      blockTime: Date | null;
    }[];
    achievements: {
      id: number;
      wallet: string;
      kind: string;
      name: string;
      description: string | null;
      awardedAt: Date | null;
    }[];
  };
}

/**
 * Full profile payload for a wallet (fetch-or-create user, materialized
 * stats, followers, win rate per spec §2.3). Mirrors GET
 * /api/user/profile/[wallet] exactly.
 */
export async function getUserProfile(wallet: string): Promise<ProfileResult | null> {
  if (!db || wallet.length < 32) return null;

  // 1. Fetch or create user record
  let [user] = await db.select().from(users).where(eq(users.wallet, wallet)).limit(1);

  if (!user) {
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
  if (!user) return null;

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
    .from(achievementsTable)
    .where(eq(achievementsTable.wallet, wallet));

  const totalVolumeNum = Number(stats?.totalVolume ?? 0);
  const realizedNum = Number(stats?.realizedPnl ?? 0);
  const unrealizedNum = Number(stats?.unrealizedPnl ?? 0);
  const marketsTradedNum = stats?.marketsTraded ?? 0;

  return {
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
      totalWagered: totalVolumeNum,
      totalProfit: realizedNum + unrealizedNum,
      marketsTraded: marketsTradedNum,
      winRate: winRatePct !== null ? winRatePct : null,
      pasScore: computePasScore(winRatePct),
    },
    stats: {
      totalVolume: totalVolumeNum,
      realizedPnl: realizedNum,
      unrealizedPnl: unrealizedNum,
      winRatePct,
      winRateBps,
      roiBps: stats?.roiBps ?? null,
      marketsTraded: marketsTradedNum,
      marketsResolved,
      wins: stats?.wins ?? 0,
      losses: stats?.losses ?? 0,
      bestTrade: Number(stats?.bestTrade ?? 0),
      currentStreak: stats?.currentStreak ?? 0,
      rank: stats?.rank ?? null,
      pasScore: computePasScore(winRatePct),
    },
    tabs: {
      recentTrades,
      achievements: userAchievements,
    },
  };
}



interface AchievementUserStats {
  marketsTraded: number;
  winningMarkets: number;
  currentStreak: number;
  largestTradeLamports: number;
  totalVolumeLamports: number;
  proposedMarkets: number;
  categoryWins: Record<string, number>;
  weeklyRank: number | null;
}

const ACHIEVEMENT_DEFS = [
  { key: "first_trade", title: "First Trade", desc: "Place your first trade",
    check: (s: AchievementUserStats) => s.marketsTraded >= 1, progress: (s: AchievementUserStats) => Math.min(100, s.marketsTraded * 100) },
  { key: "first_win", title: "First Win", desc: "Win your first market",
    check: (s: AchievementUserStats) => s.winningMarkets >= 1, progress: (s: AchievementUserStats) => Math.min(100, s.winningMarkets * 100) },
  { key: "streak_3", title: "Hot Streak", desc: "Win 3 markets in a row",
    check: (s: AchievementUserStats) => s.currentStreak >= 3, progress: (s: AchievementUserStats) => Math.min(100, (s.currentStreak / 3) * 100) },
  { key: "streak_10", title: "Unstoppable", desc: "Win 10 markets in a row",
    check: (s: AchievementUserStats) => s.currentStreak >= 10, progress: (s: AchievementUserStats) => Math.min(100, (s.currentStreak / 10) * 100) },
  { key: "whale_100", title: "Whale", desc: "Single trade > $100",
    check: (s: AchievementUserStats) => s.largestTradeLamports >= 1e8, progress: (s: AchievementUserStats) => Math.min(100, (s.largestTradeLamports / 1e8) * 100) },
  { key: "whale_1k", title: "Mega Whale", desc: "Single trade > $1,000",
    check: (s: AchievementUserStats) => s.largestTradeLamports >= 1e9, progress: (s: AchievementUserStats) => Math.min(100, (s.largestTradeLamports / 1e9) * 100) },
  { key: "market_creator", title: "Market Creator", desc: "Propose an approved market",
    check: (s: AchievementUserStats) => s.proposedMarkets >= 1, progress: (s: AchievementUserStats) => Math.min(100, s.proposedMarkets * 100) },
  { key: "oracle_whisperer", title: "Oracle Whisperer", desc: "Win 5 crypto markets",
    check: (s: AchievementUserStats) => (s.categoryWins["Crypto"] ?? 0) >= 5, progress: (s: AchievementUserStats) => Math.min(100, ((s.categoryWins["Crypto"] ?? 0) / 5) * 100) },
  { key: "sports_savant", title: "Sports Savant", desc: "Win 5 sports markets",
    check: (s: AchievementUserStats) => (s.categoryWins["Sports"] ?? 0) >= 5, progress: (s: AchievementUserStats) => Math.min(100, ((s.categoryWins["Sports"] ?? 0) / 5) * 100) },
  { key: "politico", title: "Politico", desc: "Win 5 politics markets",
    check: (s: AchievementUserStats) => (s.categoryWins["Politics"] ?? 0) >= 5, progress: (s: AchievementUserStats) => Math.min(100, ((s.categoryWins["Politics"] ?? 0) / 5) * 100) },
  { key: "top_10_weekly", title: "Top 10", desc: "Top 10 in weekly leaderboard",
    check: (s: AchievementUserStats) => s.weeklyRank !== null && s.weeklyRank <= 10, progress: () => 100 },
];

/**
 * Achievements for a wallet. Mirrors GET /api/user/achievements exactly.
 */
export async function getAchievements(wallet: string) {
  if (!wallet || wallet.length < 32) return [];

  const stats: AchievementUserStats = {
    marketsTraded: 0, winningMarkets: 0, currentStreak: 0,
    largestTradeLamports: 0, totalVolumeLamports: 0,
    proposedMarkets: 0, categoryWins: {}, weeklyRank: null,
  };

  if (db) {
    const tradeRows = await db
      .select({ lamportsIn: trades.lamportsIn, marketPubkey: trades.marketPubkey, side: trades.side })
      .from(trades)
      .where(eq(trades.trader, wallet));

    const uniqueMarkets = new Set(tradeRows.map((t) => t.marketPubkey));
    const lamportsValues = tradeRows.map((t) => Number(t.lamportsIn ?? 0));
    stats.marketsTraded = uniqueMarkets.size;
    stats.largestTradeLamports = Math.max(0, ...lamportsValues);
    stats.totalVolumeLamports = lamportsValues.reduce((s, v) => s + Math.abs(v), 0);

    if (uniqueMarkets.size > 0) {
      const pubkeys = [...uniqueMarkets];
      const mktRows = await db
        .select({
          marketPubkey: marketsCache.marketPubkey,
          category: marketsCache.category,
          status: marketsCache.status,
          winningOutcome: marketsCache.winningOutcome,
        })
        .from(marketsCache)
        .where(and(inArray(marketsCache.marketPubkey, pubkeys), eq(marketsCache.status, "settled")));
      const holdings = new Map<string, string[]>();
      for (const t of tradeRows) {
        const sides = holdings.get(t.marketPubkey) ?? [];
        sides.push(t.side);
        holdings.set(t.marketPubkey, sides);
      }
      for (const m of mktRows) {
        const outcome = (m.winningOutcome ?? "").toLowerCase();
        const sides = holdings.get(m.marketPubkey) ?? [];
        const won = sides.includes(outcome.toUpperCase()) || sides.includes(outcome);
        if (won) {
          stats.winningMarkets++;
          const cat = m.category ?? "Other";
          stats.categoryWins[cat] = (stats.categoryWins[cat] ?? 0) + 1;
        }
      }
    }

    try {
      const [proposalRes] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(marketProposals)
        .where(and(eq(marketProposals.proposer, wallet), eq(marketProposals.status, "approved")));
      stats.proposedMarkets = proposalRes?.count || 0;
    } catch (e) {
      console.error("[achievements] failed to load proposal count:", e);
    }

    try {
      const [rankRes] = await db
        .select({ rank: leaderboardSnapshots.rank })
        .from(leaderboardSnapshots)
        .where(and(eq(leaderboardSnapshots.wallet, wallet), eq(leaderboardSnapshots.period, "weekly")))
        .orderBy(sql`${leaderboardSnapshots.snapshotDate} DESC`)
        .limit(1);
      stats.weeklyRank = rankRes?.rank ?? null;
    } catch (e) {
      console.error("[achievements] failed to load weekly rank:", e);
    }

    try {
      const settled = await db
        .select({ marketPubkey: trades.marketPubkey, side: trades.side })
        .from(trades)
        .where(eq(trades.trader, wallet))
        .orderBy(sql`block_time DESC`);
      const seen = new Set<string>();
      let streak = 0;
      for (const t of settled) {
        if (seen.has(t.marketPubkey)) continue;
        seen.add(t.marketPubkey);
        const [m] = await db
          .select({ status: marketsCache.status, winningOutcome: marketsCache.winningOutcome })
          .from(marketsCache)
          .where(eq(marketsCache.marketPubkey, t.marketPubkey))
          .limit(1);
        if (!m || m.status !== "settled") break;
        const outcome = (m.winningOutcome ?? "").toLowerCase();
        if (t.side.toLowerCase() === outcome) streak++;
        else break;
      }
      stats.currentStreak = streak;
    } catch (e) {
      console.error("[achievements] failed to compute streak:", e);
    }
  }

  return ACHIEVEMENT_DEFS.map((a) => ({
    key: a.key,
    title: a.title,
    desc: a.desc,
    unlocked: a.check(stats),
    progress: Math.round(a.progress(stats)),
  }));
}
