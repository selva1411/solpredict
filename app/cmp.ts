import { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { getDb } from "./src/lib/db/client";
import { marketsCache } from "./src/lib/db/schema";
import { sql } from "drizzle-orm";
import fs from "fs";
async function main(){
  const P="AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG";
  const idl = JSON.parse(fs.readFileSync("./src/lib/idl/solpredict.json","utf8"));
  const conn = new Connection("http://127.0.0.1:8899", "confirmed");
  const program = new Program({...idl, address: P} as any, new AnchorProvider(conn, { publicKey: PublicKey.unique() } as any));
  const mkts = await (program as any).account.market.all();
  const onchain: Record<string,number> = {};
  for (const m of mkts) {
    const a = m.account as any;
    onchain[m.publicKey.toBase58()] = (Number(a.yesPoolLamports)+Number(a.noPoolLamports))/1e9;
  }
  const db = getDb(); if(!db) return;
  const rows = await db.select({ pk: marketsCache.marketPubkey, tv: marketsCache.totalVolume }).from(marketsCache);
  let sumDb=0, sumOn=0, diffs=0;
  for (const r of rows) {
    const on = onchain[r.pk] ?? 0; const dbv = Number(r.tv ?? 0);
    sumDb+=dbv; sumOn+=on;
    if (Math.abs(dbv-on) > 0.001) { diffs++; if(diffs<=3) console.log("DIFF", r.pk.slice(0,8), "db", dbv, "onchain", on); }
  }
  console.log("SUM db total_volume:", sumDb.toFixed(2), "| on-chain yes+no pools:", sumOn.toFixed(2), "| markets with diff:", diffs);
}
main().catch(e=>console.error("ERR", e.message));
