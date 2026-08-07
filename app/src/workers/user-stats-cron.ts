/**
 * SolPredict user-stats recompute cron.
 *
 * Installs recompute_user_stats() (if missing) and runs an aggregate pass so
 * leaderboard/rankings numbers always trace to settled-market wins/losses.
 *
 * Usage:
 *   node --env-file=.env.local --import tsx src/workers/user-stats-cron.ts
 *   node --env-file=.env.local --import tsx src/workers/user-stats-cron.ts --interval=60000
 */
import { installUserStatsFunction, recomputeUserStats } from "@/lib/indexer/user-stats";
import { logger } from "@/lib/logger";

const INTERVAL_MS = (() => {
  const m = process.argv.find((a) => a.startsWith("--interval="));
  return m ? Number(m.split("=")[1]) : 5 * 60_000; // default 5 min
})();

async function run(): Promise<void> {
  await installUserStatsFunction();
  await recomputeUserStats();
}

async function main(): Promise<void> {
  logger.info(`[user-stats-cron] starting (interval=${INTERVAL_MS}ms)`);
  await run();
  setInterval(() => {
    run().catch((e) => logger.error("[user-stats-cron] error:", e));
  }, INTERVAL_MS);
}

main().catch((e) => {
  logger.error("[user-stats-cron] fatal:", e);
  process.exit(1);
});