export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { Connection } from "@solana/web3.js";
import { getDb } from "@/lib/db/client";
import { getCursor } from "@/lib/indexer/reducer";
import { marketsCache, marketOutcomes, trades, positions, userStats } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

export const GET = apiHandler(async (req: NextRequest) => {
  const db = getDb();
  if (!db) return serverError("Database not available");

  try {
    const [
      mCount,
      oCount,
      tCount,
      pCount,
      uCount,
      procCheck,
    ] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)::int` }).from(marketsCache),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(marketOutcomes),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(trades),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(positions),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(userStats),
      db.execute(sql`SELECT EXISTS(SELECT 1 FROM pg_proc WHERE proname = 'recompute_user_stats') as fn_exists`),
    ]);

    // Check indexer lag
    let currentSlot = 0;
    let cursorSlot = 0;
    let slotLag = 0;
    try {
      const connection = new Connection(RPC_URL, "confirmed");
      currentSlot = await connection.getSlot();
      const cursor = await getCursor();
      cursorSlot = cursor?.lastSlot ?? currentSlot;
      slotLag = Math.max(0, currentSlot - cursorSlot);
    } catch {
      // RPC transient error fallback
    }

    const recomputeFnInstalled = Boolean((procCheck.rows[0] as Record<string, unknown> | undefined)?.fn_exists);
    const isLagging = slotLag > 150;

    return ok({
      ok: true,
      status: isLagging ? "degraded" : "healthy",
      db: {
        connected: true,
        recomputeUserStatsInstalled: recomputeFnInstalled,
        tables: {
          marketsCache: mCount[0]?.count ?? 0,
          marketOutcomes: oCount[0]?.count ?? 0,
          trades: tCount[0]?.count ?? 0,
          positions: pCount[0]?.count ?? 0,
          userStats: uCount[0]?.count ?? 0,
        },
      },
      indexer: {
        currentSlot,
        cursorSlot,
        slotLag,
        isLagging,
        statusBadge: isLagging ? "RED (Lag > 150 slots)" : "GREEN",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return serverError(err);
  }
});
