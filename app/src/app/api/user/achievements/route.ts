import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { trades } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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
      .select({ lamportsIn: trades.lamportsIn, marketPubkey: trades.marketPubkey })
      .from(trades)
      .where(eq(trades.trader, wallet));

    const uniqueMarkets = new Set(tradeRows.map((t) => t.marketPubkey));
    const lamportsValues = tradeRows.map((t) => Number(t.lamportsIn ?? 0));
    stats.marketsTraded = uniqueMarkets.size;
    stats.largestTradeLamports = Math.max(0, ...lamportsValues);
    stats.totalVolumeLamports = lamportsValues.reduce((s, v) => s + v, 0);
  }

  const achievements = ACHIEVEMENT_DEFS.map((a) => ({
    key: a.key,
    unlocked: a.check(stats),
    progress: Math.round(a.progress(stats)),
  }));

  return ok({ ok: true, achievements });
});
