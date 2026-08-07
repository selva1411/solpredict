import { getDb } from "./src/lib/db/client";
import { sql } from "drizzle-orm";
const tables = [
  "markets_cache","market_outcomes","price_history","trades","positions","orders",
  "liquidity_positions","market_proposals","disputes","users","user_stats","rewards",
  "treasury_ledger","platform_config","notifications","watchlist","market_comments",
  "comment_votes","follows","achievements","audit_log","indexer_cursor","price_alerts",
  "leaderboard_snapshots","lp_pool_stats","admin_settings","treasury_withdrawals",
];
async function main(){
  const db = getDb(); if(!db) return;
  for (const t of tables){
    try {
      const r = await db.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM ${t}`));
      const n = (r.rows?.[0] as any)?.n ?? 0;
      if (n > 0) console.log(`${t}: ${n}`);
    } catch (e:any) { console.log(`${t}: ERROR ${e.message?.slice(0,60)}`); }
  }
  console.log("--- done (tables with 0 rows omitted) ---");
}
main().catch(e=>console.error("ERR", e.message));
