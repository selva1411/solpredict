import { getDb } from "./src/lib/db/client";
import { sql } from "drizzle-orm";
async function main(){
  const db = getDb(); if(!db) return;
  const c = async (t:string) => { try { const r = await db.execute(sql.raw(`SELECT COUNT(*)::int AS n FROM "${t}"`)); return (r.rows?.[0] as any)?.n ?? 0; } catch(e:any){ return "ERR:"+e.message?.slice(0,60); } };
  console.log("markets_cache:", await c("markets_cache"));
  console.log("--- market_outcomes sample ---");
  const o = await db.execute(sql.raw(`SELECT market_pubkey, outcome_index, name, is_winning, status FROM market_outcomes LIMIT 12`));
  for (const r of o.rows ?? []) console.log("  ", (r as any).market_pubkey?.slice(0,8), "idx", (r as any).outcome_index, "name", (r as any).name, "win", (r as any).is_winning, "status", (r as any).status);
  console.log("--- notifications sample ---");
  const n = await db.execute(sql.raw(`SELECT id, type, wallet, title, created_at FROM notifications ORDER BY id DESC LIMIT 5`));
  for (const r of n.rows ?? []) console.log("  ", (r as any).id, (r as any).type, (r as any).wallet?.slice(0,8), String((r as any).title).slice(0,40), String((r as any).created_at).slice(0,19));
  console.log("--- market_comments sample ---");
  const mc = await db.execute(sql.raw(`SELECT id, market_pubkey, author, body, created_at FROM market_comments ORDER BY id DESC LIMIT 5`));
  for (const r of mc.rows ?? []) console.log("  ", (r as any).id, (r as any).market_pubkey?.slice(0,8), (r as any).author?.slice(0,8), String((r as any).body).slice(0,40), String((r as any).created_at).slice(0,19));
  console.log("--- watchlist / lp_pool_stats / liquidity_positions / leaderboard_snapshots / price_history ---");
  const w = await db.execute(sql.raw(`SELECT wallet, market_pubkey FROM watchlist`));
  for (const r of w.rows ?? []) console.log("  watchlist:", (r as any).wallet?.slice(0,8), (r as any).market_pubkey?.slice(0,8));
  const lp = await db.execute(sql.raw(`SELECT market_pubkey, provider FROM lp_pool_stats LIMIT 3`));
  for (const r of lp.rows ?? []) console.log("  lp_pool_stats:", (r as any).market_pubkey?.slice(0,8), (r as any).provider?.slice(0,8));
  const liq = await db.execute(sql.raw(`SELECT market_pubkey, provider FROM liquidity_positions LIMIT 3`));
  for (const r of liq.rows ?? []) console.log("  liquidity_positions:", (r as any).market_pubkey?.slice(0,8), (r as any).provider?.slice(0,8));
  const snap = await db.execute(sql.raw(`SELECT period, snapshot_date, user_count FROM leaderboard_snapshots LIMIT 5`));
  for (const r of snap.rows ?? []) console.log("  leaderboard_snapshots:", (r as any).period, (r as any).snapshot_date, (r as any).user_count);
  const ph = await db.execute(sql.raw(`SELECT market_pubkey, count(*) FROM price_history GROUP BY market_pubkey ORDER BY count(*) DESC LIMIT 5`));
  for (const r of ph.rows ?? []) console.log("  price_history by market:", (r as any).market_pubkey?.slice(0,8), (r as any).count);
}
main().catch(e=>console.error("ERR", e.message));
