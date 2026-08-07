export const dynamic = "force-dynamic";

import { assertDb } from "@/lib/db/client";
import { ok, serverError } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";

/**
 * GET /api/health/db
 *
 * Dedicated database health check. Runs `SELECT 1` and reports latency.
 * Unlike the general /api/health, this route will return 500 (not 503)
 * if the database is truly unreachable, making it suitable for uptime monitors.
 */
export const GET = apiHandler(async () => {
  const t0 = Date.now();
  try {
    const database = assertDb();
    await database.execute("SELECT 1");
    const latencyMs = Date.now() - t0;

    return ok({
      ok: true,
      db: {
        connected: true,
        latencyMs,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    const latencyMs = Date.now() - t0;
    return serverError({
      message: `Database health check failed after ${latencyMs}ms: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
});
