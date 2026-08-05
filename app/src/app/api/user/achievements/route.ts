import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { trades, marketsCache, marketProposals, leaderboardSnapshots } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { ok, badRequest } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

interface UserStats {
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
    check: (s: UserStats) => s.marketsTraded >= 1, progress: (s: UserStats) => Math.min(100, s.marketsTraded * 100) },
  { key: "first_win", title: "First Win", desc: "Win your first market",
    check: (s: UserStats) => s.winningMarkets >= 1, progress: (s: UserStats) => Math.min(100, s.winningMarkets * 100) },
  { key: "streak_3", title: "Hot Streak", desc: "Win 3 markets in a row",
    check: (s: UserStats) => s.currentStreak >= 3, progress: (s: UserStats) => Math.min(100, (s.currentStreak / 3) * 100) },
  { key: "streak_10", title: "Unstoppable", desc: "Win 10 markets in a row",
    check: (s: UserStats) => s.currentStreak >= 10, progress: (s: UserStats) => Math.min(100, (s.currentStreak / 10) * 100) },
  { key: "whale_100", title: "Whale", desc: "Single trade > $100",
    check: (s: UserStats) => s.largestTradeLamports >= 1e8, progress: (s: UserStats) => Math.min(100, (s.largestTradeLamports / 1e8) * 100) },
  { key: "whale_1k", title: "Mega Whale", desc: "Single trade > $1,000",
    check: (s: UserStats) => s.largestTradeLamports >= 1e9, progress: (s: UserStats) => Math.min(100, (s.largestTradeLamports / 1e9) * 100) },
  { key: "market_creator", title: "Market Creator", desc: "Propose an approved market",
    check: (s: UserStats) => s.proposedMarkets >= 1, progress: (s: UserStats) => Math.min(100, s.proposedMarkets * 100) },
  { key: "oracle_whisperer", title: "Oracle Whisperer", desc: "Win 5 crypto markets",
    check: (s: UserStats) => (s.categoryWins["Crypto"] ?? 0) >= 5, progress: (s: UserStats) => Math.min(100, ((s.categoryWins["Crypto"] ?? 0) / 5) * 100) },
  { key: "sports_savant", title: "Sports Savant", desc: "Win 5 sports markets",
    check: (s: UserStats) => (s.categoryWins["Sports"] ?? 0) >= 5, progress: (s: UserStats) => Math.min(100, ((s.categoryWins["Sports"] ?? 0) / 5) * 100) },
  { key: "politico", title: "Politico", desc: "Win 5 politics markets",
    check: (s: UserStats) => (s.categoryWins["Politics"] ?? 0) >= 5, progress: (s: UserStats) => Math.min(100, ((s.categoryWins["Politics"] ?? 0) / 5) * 100) },
  { key: "top_10_weekly", title: "Top 10", desc: "Top 10 in weekly leaderboard",
    check: (s: UserStats) => s.weeklyRank !== null && s.weeklyRank <= 10, progress: () => 100 },
];

export const GET = apiHandler(async (req: NextRequest) => {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || wallet.length < 32) {
    return badRequest("Valid wallet address required");
  }

  let stats: UserStats = {
    marketsTraded: 0, winningMarkets: 0, currentStreak: 0,
    largestTradeLamports: 0, totalVolumeLamports: 0,
    proposedMarkets: 0, categoryWins: {}, weeklyRank: null,
  };

  if (db) {
    const tradeRows = await db
      .select({
        lamportsIn: trades.lamportsIn,
        marketPubkey: trades.marketPubkey,
        side: trades.side,
      })
      .from(trades)
      .where(eq(trades.trader, wallet));

    const uniqueMarkets = new Set(tradeRows.map((t) => t.marketPubkey));
    const lamportsValues = tradeRows.map((t) => Number(t.lamportsIn ?? 0));
    stats.marketsTraded = uniqueMarkets.size;
    stats.largestTradeLamports = Math.max(0, ...lamportsValues);
    stats.totalVolumeLamports = lamportsValues.reduce((s, v) => s + Math.abs(v), 0);

    // Winning markets + category wins: count settled markets the user holds
    // tokens for and where the winning outcome matches their side.
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
        .where(
          and(
            sql`${marketsCache.marketPubkey} IN (${sql.raw(pubkeys.map((_, i) => `$${i + 1}`).join(","))})`,
            eq(marketsCache.status, "settled"),
          )
        );
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

    // Proposed markets (approved)
    try {
      const [proposalRes] = await db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(marketProposals)
        .where(and(eq(marketProposals.proposer, wallet), eq(marketProposals.status, "approved")));
      stats.proposedMarkets = proposalRes?.count || 0;
    } catch {}

    // Weekly rank: rank by 7-day volume from the leaderboard snapshot table
    try {
      const [rankRes] = await db
        .select({ rank: leaderboardSnapshots.rank })
        .from(leaderboardSnapshots)
        .where(and(
          eq(leaderboardSnapshots.wallet, wallet),
          eq(leaderboardSnapshots.period, "weekly"),
        ))
        .orderBy(sql`${leaderboardSnapshots.snapshotDate} DESC`)
        .limit(1);
      stats.weeklyRank = rankRes?.rank ?? null;
    } catch {}

    // Current win streak: count most recent consecutive settled wins
    try {
      const settled = await db
        .select({
          marketPubkey: trades.marketPubkey,
          side: trades.side,
        })
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
    } catch {}
  }

  const achievements = ACHIEVEMENT_DEFS.map((a) => ({
    key: a.key,
    unlocked: a.check(stats),
    progress: Math.round(a.progress(stats)),
  }));

  return ok({ ok: true, achievements });
});
