import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { readFileSync } from "node:fs";
const url = process.argv[2] || "http://127.0.0.1:8899";
const conn = new Connection(url, "confirmed");
const pid = new PublicKey("BUQ2gf7NDyoTc1AVRcDN6eZnuX8nG4e77chmPkCByP8v");
const idl = JSON.parse(readFileSync("app/src/lib/idl/solpredict.json","utf8"));
const program = new Program(idl, pid, { connection: conn });
const all = await program.account.market.all();
for (const m of all) {
  const a = m.account;
  console.log(JSON.stringify({
    id: a.marketId.toNumber(), q: a.question.slice(0,38),
    cat: Number(a.category) ,
    yesPool: a.yesPoolLamports.toNumber(), noPool: a.noPoolLamports.toNumber(),
    yesSupply: a.yesSupply.toNumber(), noSupply: a.noSupply.toNumber(),
    sharePrice: a.sharePriceLamports.toNumber(), feeBps: a.feeBps,
  }));
}
