import { getLeaderboardData } from '@/lib/db/store';
import { ok } from '@/lib/api-response';
import { apiHandler } from '@/lib/api-handler';

export const GET = apiHandler(async () => {
  const leaderboard = await getLeaderboardData();
  return ok({ ok: true, leaderboard: leaderboard ?? [] });
}, { cacheMaxAge: 30, cacheTags: ["leaderboard"] });
