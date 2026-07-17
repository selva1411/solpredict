import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";

// ─── Config ─────────────────────────────────────────────────────────────────
const RPC_URL = "https://api.devnet.solana.com";
const HERMES_URL = "https://hermes.pyth.network";
const PYTH_RECEIVER_ID = new PublicKey(
  "rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ"
);
const PROGRAM_ID = new PublicKey(
  "9YukHcQVqnST4SNpnLrdTBHDQU63Lrn93zu6Et3Ubaez"
);
const POLL_MS = 15_000;
const CONFIG_SEED = Buffer.from("config");
const MARKET_SEED = Buffer.from("market");
// ─────────────────────────────────────────────────────────────────────────────

function toHex(bytes: number[] | Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}

/** Borsh-encode a PostUpdate instruction for the Pyth Solana Receiver. */
function encodePostUpdateData(vaas: Buffer[]): Buffer {
  const size = 1 + 4 + vaas.reduce((a, v) => a + 4 + v.length, 0);
  const buf = Buffer.alloc(size);
  let off = 0;
  buf.writeUInt8(0, off); off += 1; // PostUpdate variant tag
  buf.writeUInt32LE(vaas.length, off); off += 4; // vec length
  for (const vaa of vaas) {
    buf.writeUInt32LE(vaa.length, off); off += 4;
    vaa.copy(buf, off); off += vaa.length;
  }
  return buf;
}

async function main() {
  // ── Load keypair ───────────────────────────────────────────────────────────
  const kpPath =
    process.env.KEYPAIR_PATH ||
    path.join(process.env.HOME || "", ".config/solana/id.json");
  if (!fs.existsSync(kpPath)) {
    console.error(`Keypair not found at ${kpPath}.`);
    console.error("Set KEYPAIR_PATH or place a keypair at ~/.config/solana/id.json");
    process.exit(1);
  }
  const secret = JSON.parse(fs.readFileSync(kpPath, "utf-8"));
  const payer = Keypair.fromSecretKey(new Uint8Array(secret));
  console.log(`Keeper address: ${payer.publicKey.toBase58()}`);

  // ── Anchor setup ───────────────────────────────────────────────────────────
  const connection = new Connection(RPC_URL, "confirmed");
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(payer),
    { commitment: "confirmed" }
  );
  anchor.setProvider(provider);

  const idlPath = path.join(__dirname, "..", "target", "idl", "solpredict.json");
  const idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  const configPda = PublicKey.findProgramAddressSync(
    [CONFIG_SEED],
    PROGRAM_ID
  )[0];

  console.log(`Program ID: ${PROGRAM_ID.toBase58()}`);
  console.log(`Config PDA: ${configPda.toBase58()}`);
  console.log(`Polling every ${POLL_MS / 1000}s…`);

  // ── Main loop ──────────────────────────────────────────────────────────────
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const now = blockTime ?? Math.floor(Date.now() / 1000);

      const markets = await program.account.market.all();
      const settleable = markets.filter((m) => {
        const status = m.account.status as Record<string, unknown>;
        if (!status.open) return false;
        const rts = m.account.resolveTs.toNumber();
        return now >= rts;
      });

      if (settleable.length > 0) {
        console.log(
          `[${new Date().toISOString()}] Found ${settleable.length} settleable market(s)`
        );
      }

      for (const m of settleable) {
        const oracleFeedId = m.account.oracleFeedId as number[];
        const isOracle = oracleFeedId.some((b) => b !== 0);
        if (!isOracle) {
          console.log(`  Skipping ${m.publicKey.toBase58()} — manual-only feed`);
          continue;
        }

        const feedHex = toHex(oracleFeedId);
        console.log(`  Settling ${m.publicKey.toBase58()} (feed: ${feedHex.slice(0, 8)}…)`);

        try {
          // 1. Fetch VAA from Hermes
          const hermesResp = await fetch(
            `${HERMES_URL}/v2/updates/price/latest?ids%5B%5D=${feedHex}&encoding=hex`
          );
          if (!hermesResp.ok) {
            console.error(`    Hermes HTTP ${hermesResp.status}`);
            continue;
          }
          const hermesJson: any = await hermesResp.json();
          const vaaHex: string | undefined =
            hermesJson.parsed?.[0]?.vaa ?? hermesJson.binary?.vaas?.[0];
          if (!vaaHex) {
            console.error("    No VAA in Hermes response");
            continue;
          }

          const vaaBytes = Buffer.from(vaaHex, "hex");

          // 2. Derive the price-update PDA (SHA256(vaa))
          const hash = createHash("sha256").update(vaaBytes).digest();
          const [priceUpdatePda] = PublicKey.findProgramAddressSync(
            [hash],
            PYTH_RECEIVER_ID
          );

          // 3. Post the VAA (if the PDA doesn't exist yet)
          const existing = await connection.getAccountInfo(priceUpdatePda);
          if (!existing) {
            const postIx = new TransactionInstruction({
              programId: PYTH_RECEIVER_ID,
              data: encodePostUpdateData([vaaBytes]),
              keys: [
                { pubkey: payer.publicKey, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
              ],
            });
            const postTx = new Transaction().add(postIx);
            const postSig = await anchor.web3.sendAndConfirmTransaction(
              connection,
              postTx,
              [payer]
            );
            console.log(`    Posted VAA: ${postSig}`);
          } else {
            console.log("    VAA already posted");
          }

          // 4. Settle
          const settleIx = await program.methods
            .settleMarket()
            .accounts({
              market: m.publicKey,
              config: configPda,
              priceUpdate: priceUpdatePda,
            } as any)
            .instruction();

          const settleTx = new Transaction().add(settleIx);
          const settleSig = await anchor.web3.sendAndConfirmTransaction(
            connection,
            settleTx,
            [payer]
          );
          console.log(`    ✓ Settled: ${settleSig}`);
        } catch (err: any) {
          const logs = err.logs ? `\n      ${(err.logs as string[]).join("\n      ")}` : "";
          console.error(`    ✗ ${err.message}${logs}`);
        }
      }
    } catch (err: any) {
      console.error("Keeper error:", err.message);
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
