import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { reconcileMarkets, reconcileTrades, reconcilePositions } from "../src/lib/indexer/reconciler";
import { logger } from "../src/lib/logger";
let warns = 0;
const orig = logger.warn.bind(logger);
logger.warn = (...a: unknown[]) => { warns++; if (warns <= 2) console.log("WARN:", String(a[1] ?? a[0]).slice(0, 300)); };

const RPC = process.env.LOCALNET_RPC_URL ?? "http://127.0.0.1:8899";
const PID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
);

function step(name: string) {
  const t = Date.now();
  return () => console.log(`✓ ${name} (${Date.now() - t}ms)`);
}

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const provider = new AnchorProvider(conn, new Wallet(Keypair.generate()), {
    commitment: "confirmed",
  });
  const rawIdl = (await import("../src/lib/idl/solpredict.json", { with: { type: "json" } })).default;
  const program = new Program({ ...rawIdl, address: PID.toBase58() } as never, provider) as any;

  const doneM = step("reconcileMarkets");
  await reconcileMarkets({ connection: conn, program, limit: 20 });
  doneM();

  const doneP = step("reconcilePositions");
  await reconcilePositions({ connection: conn, program });
  doneP();

  const doneT = step("reconcileTrades");
  const res = await reconcileTrades({ connection: conn, program, limit: 10 });
  doneT();
  console.log("trades:", res.trades);
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e.message ?? e);
  process.exit(1);
});
