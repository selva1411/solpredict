import { getDb } from "./src/lib/db/client";
import { sql } from "drizzle-orm";
async function main(){
  const db = getDb(); if(!db) return;
  const c = async (t:string) => { try { const r = await db.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM "${t}"`)); return (r.rows?.[0] as any)?.n ?? 0; } catch(e:any){ return "ERR"; } };
  const tabs = ["markets_cache","market_outcomes","price_history","trades","positions","users","user_stats","orders","liquidity_positions","market_proposals","disputes","rewards","treasury_ledger","platform_config","notifications","watchlist","market_comments","comment_votes","follows","achievements","audit_log","indexer_cursor","price_alerts","leaderboard_snapshots","lp_pool_stats","admin_settings","treasury_withdrawals"];
  console.log("FINAL DB STATE:");
  for (const t of tabs){ const n = await c(t); console.log(`  ${t}: ${n}`); }
  console.log("--- outcomes per real market (should be 2 each) ---");
  const o = await db.execute(sql.raw(`SELECT market_pubkey, COUNT(*)::int AS n FROM market_outcomes GROUP BY market_pubkey HAVING COUNT(*) <> 2`));
  console.log("  markets with !=2 outcomes:", o.rows?.length ?? 0);
  console.log("--- trades traders / markets integrity ---");
  const bad = await db.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM trades t LEFT JOIN markets_cache m ON m.market_pubkey = t.market_pubkey WHERE m.market_pubkey IS NULL`));
  console.log("  trades referencing missing markets:", (bad.rows?.[0] as any)?.n ?? 0);
  const badu = await db.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM trades t LEFT JOIN users u ON u.wallet = t.trader WHERE u.wallet IS NULL`));
  console.log("  trades referencing missing users:", (badu.rows?.[0] as any)?.n ?? 0);
  const posp = await db.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM positions p LEFT JOIN users u ON u.wallet = p.wallet WHERE u.wallet IS NULL`));
  console.log("  positions with missing user:", (posp.rows?.[0] as any)?.n ?? 0);
}
main().catch(e=>console.error("ERR", e.message));
