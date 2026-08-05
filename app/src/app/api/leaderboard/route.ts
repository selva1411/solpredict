import { NextRequest } from 'next/server';
import { getLeaderboardFromDb } from '@/lib/db/leaderboard-store';
import { ok } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';

export const GET = apiHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const sortBy = (url.searchParams.get("sortBy") as 'volume' | 'profit' | 'winRate') || "volume";
  const limit = parseInt(url.searchParams.get("limit") || "50", 10);
  const period = (url.searchParams.get("period") as 'daily' | 'weekly' | 'monthly' | 'all') || "all";

  const leaderboard = await getLeaderboardFromDb(limit, sortBy, period);
  return ok({ ok: true, leaderboard: leaderboard ?? [], period, sortBy });
}, { cacheMaxAge: 15, cacheTags: ["leaderboard"] });
