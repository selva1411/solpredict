export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { getLeaderboard } from "@/lib/data/platform";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

export const GET = apiHandler(async (req: NextRequest) => {
  try {
    const url = new URL(req.url);
    const sortBy = (url.searchParams.get("sortBy") as "volume" | "profit" | "winRate") || "volume";
    const limit = parseInt(url.searchParams.get("limit") || "50", 10);
    const period = (url.searchParams.get("period") as "daily" | "weekly" | "monthly" | "all") || "all";
    const category = url.searchParams.get("category") || "";

    const leaderboard = await getLeaderboard(sortBy, period, category, limit);
    return ok({ ok: true, leaderboard: leaderboard ?? [], period, sortBy, category });
  } catch (err) {
    return serverError(err);
  }
}, { cacheMaxAge: 15, cacheTags: ["leaderboard"] });
