import { getDb } from "./src/lib/db/client";
import { sql } from "drizzle-orm";
async function main(){
  const db = getDb(); if(!db) return;
  const before = async (t:string) => { const r = await db.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM "${t}"`)); return (r.rows?.[0] as any)?.n ?? 0; };
  const empty = async (t:string) => { const n = await before(t); await db.execute(sql.raw(`DELETE FROM "${t}"`)); console.log(`  ${t}: emptied (${n} -> 0)`); };
  const orphans = async (t:string, col:string) => {
    const r = await db.execute(sql.raw(`DELETE FROM "${t}" WHERE ${col} NOT IN (SELECT market_pubkey FROM markets_cache)`));
    console.log(`  ${t}: removed ${r.rowCount} orphaned rows (${col} not in markets_cache)`);
  };
  const tabs = ["notifications","market_comments","watchlist","leaderboard_snapshots","lp_pool_stats","liquidity_positions"];
  const b: Record<string,number> = {};
  for (const t of tabs.concat(["market_outcomes","price_history"])) b[t] = await before(t);
  console.log("BEFORE:", JSON.stringify(b));
  console.log("Emptying stale test-era tables:");
  for (const t of tabs) await empty(t);
  console.log("Removing orphaned derived rows:");
  await orphans("market_outcomes","market_pubkey");
  await orphans("price_history","market_pubkey");
}
main().catch(e=>console.error("ERR", e.message));
