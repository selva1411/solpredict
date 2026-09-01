import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getConfigPda, getMarketPda, getEmergencyPausePda } from "../src/lib/pda";

const RPC = process.env.LOCALNET_RPC_URL ?? "http://127.0.0.1:8899";
const PID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
);

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const secret = JSON.parse(
    readFileSync(join(homedir(), ".config/solana/id.json"), "utf8"),
  );
  const admin = Keypair.fromSecretKey(Uint8Array.from(secret));
  const provider = new AnchorProvider(conn, new Wallet(admin), {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  const rawIdl = (await import("../src/lib/idl/solpredict.json", { with: { type: "json" } })).default;
  const program = new Program({ ...rawIdl, address: PID.toBase58() } as never, provider) as any;

  const cfg = await program.account.config.fetchNullable(getConfigPda(PID));
  console.log("config.admin:", cfg?.admin?.toBase58());
  console.log("cli pubkey  :", admin.publicKey.toBase58(), cfg?.admin?.equals(admin.publicKey) ? "(IS admin)" : "(NOT admin)");
  const bal = await conn.getBalance(admin.publicKey);
  console.log("cli balance :", bal / LAMPORTS_PER_SOL, "SOL");

  const count = Number(cfg?.marketCount ?? 0);
  for (let i = 7; i < Math.min(count, 13); i++) {
    const pda = getMarketPda(new BN(i), PID);
    const m = await program.account.market.fetchNullable(pda);
    if (!m) continue;
    const status = typeof m.status === "object" ? Object.keys(m.status)[0] : String(m.status);
    const endTs = Number(m.endTs);
    const nowSec = Math.floor(Date.now() / 1000);
    const expired = nowSec >= endTs;
    console.log(`#${i} status=${status} end=${new Date(endTs * 1000).toISOString()} expired=${expired}`);
    if (status !== "open") continue;

    try {
      if (expired && i <= 10) {
        // Settled intents: #7 YES, #8 NO, #9 YES, #10 NO
        const outcome = i % 2 === 1 ? 1 : 2;
        await program.methods
          .settleMarketManual(outcome)
          .accounts({ admin: admin.publicKey, config: getConfigPda(PID), market: pda })
          .signers([admin])
          .rpc();
        console.log(`  -> settled #${i} outcome=${outcome}`);
      } else {
        // #11 Real Madrid UCL, #12 US rates — cancelled intents
        await program.methods
          .cancelMarket("Listed by mistake")
          .accounts({ admin: admin.publicKey, config: getConfigPda(PID), market: pda })
          .signers([admin])
          .rpc();
        console.log(`  -> cancelled #${i}`);
      }
    } catch (e) {
      console.log(`  -> FAILED #${i}:`, (e as Error).message.slice(0, 200));
    }
  }

  // Verify final state
  console.log("\nFinal states:");
  for (let i = 0; i < count; i++) {
    const pda = getMarketPda(new BN(i), PID);
    const m = await program.account.market.fetchNullable(pda);
    if (!m) continue;
    const status = typeof m.status === "object" ? Object.keys(m.status)[0] : String(m.status);
    console.log(`#${i} ${status}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL:", e.message ?? e);
    process.exit(1);
  });
