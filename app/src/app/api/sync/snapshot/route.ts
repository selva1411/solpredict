export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { recordLeaderboardSnapshot } from "@/lib/db/store";
import { db } from "@/lib/db/client";
import { leaderboardSnapshots } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { serverError, ok } from "@/lib/api-response";
import { apiHandler, requireServiceKey } from "@/lib/api-handler";

export const POST = apiHandler(async (req: NextRequest) => {
  if (!requireServiceKey(req)) {
    return ok({ error: "Unauthorized" }, { status: 401 } as ResponseInit);
  }
  if (!db) return serverError("Database not configured");
  await recordLeaderboardSnapshot();
  return ok({ ok: true, message: "Leaderboard snapshot generated & saved to NeonDB" });
});

export const GET = apiHandler(async () => {
  if (db) {
    const snapshots = await db
      .select()
      .from(leaderboardSnapshots)
      .orderBy(desc(leaderboardSnapshots.id))
      .limit(50);
    return ok({ ok: true, snapshots });
  }
  return ok({ ok: true, snapshots: [] });
});
