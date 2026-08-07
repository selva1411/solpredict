import { getDb } from "./src/lib/db/client";
import { sql } from "drizzle-orm";
async function main(){
  const db = getDb(); if(!db) return;
  const q = async (label:string, s:string, lim=6) => {
    console.log(`--- ${label} ---`);
    try { const r = await db.execute(sql.raw(s)); for (const row of r.rows ?? []) console.log("  ", Object.values(row as any).join(" | ")); }
    catch(e:any){ console.log("  ERR", e.message?.slice(0,90)); }
  };
  await q("market_outcomes", `SELECT market_pubkey, outcome_index, label, shares_outstanding, last_price_bps, created_at FROM market_outcomes ORDER BY id DESC LIMIT 8`);
  await q("price_history sample", `SELECT market_pubkey, outcome_index, timestamp, price_bps, volume FROM price_history ORDER BY id DESC LIMIT 6`);
  await q("price_history distinct markets", `SELECT COUNT(DISTINCT market_pubkey) AS m, COUNT(DISTINCT outcome_index) AS o FROM price_history`);
  await q("notifications", `SELECT id, type, wallet, message, created_at FROM notifications ORDER BY id DESC LIMIT 8`);
  await q("watchlist", `SELECT id, wallet, market_pubkey FROM watchlist`);
  await q("market_comments", `SELECT id, market_pubkey, author_wallet, content, created_at FROM market_comments ORDER BY id DESC LIMIT 8`);
  await q("leaderboard_snapshots", `SELECT id, wallet, period, rank, profit_sol, snapshot_date FROM leaderboard_snapshots ORDER BY id DESC LIMIT 8`);
  await q("lp_pool_stats", `SELECT id, market_pubkey, total_liquidity_sol, total_lp_tokens FROM lp_pool_stats`);
  await q("liquidity_positions", `SELECT id, wallet, market_pubkey, lp_shares, deposited FROM liquidity_positions`);
}
main().catch(e=>console.error("ERR", e.message));
