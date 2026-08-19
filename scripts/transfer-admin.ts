/**
 * Transfer on-chain admin authority to a browser wallet WITHOUT resetting the
 * chain. The current admin (CLI keypair, usually ~/.config/solana/id.json)
 * signs the program's `update_admin` instruction.
 *
 * Usage:
 *   npx tsx scripts/transfer-admin.ts <new_admin_wallet>
 *
 * Requires: a running solana-test-validator with the program deployed.
 */
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const IDL = JSON.parse(
  readFileSync(join(process.cwd(), "target/idl/solpredict.json"), "utf8")
);

const RPC = process.env.LOCALNET_RPC_URL ?? "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG"
);

const NEW_ADMIN_STR = process.argv[2];
if (!NEW_ADMIN_STR) {
  console.error("usage: npx tsx scripts/transfer-admin.ts <new_admin_wallet>");
  process.exit(1);
}
const NEW_ADMIN = new PublicKey(NEW_ADMIN_STR);

const keyPath =
  process.env.ADMIN_KEY_PATH || join(homedir(), ".config", "solana", "id.json");
const secret = JSON.parse(readFileSync(keyPath, "utf8"));
const admin = Keypair.fromSecretKey(Uint8Array.from(secret));

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const wallet = new anchor.Wallet(admin);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);
  // Same construction as scripts/seed-localnet.ts (address inside the IDL,
  // provider as the second arg) — works with the Anchor 0.31 spec IDL.
  const program = new anchor.Program(
    { ...(IDL as anchor.Idl), address: PROGRAM_ID.toBase58() } as anchor.Idl,
    provider
  );

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );
  console.log("config PDA:", configPda.toBase58());
  console.log("signer (current admin):", admin.publicKey.toBase58());

  const config: any = await program.account.config.fetch(configPda);
  console.log("on-chain config.admin:", config.admin.toBase58());
  if (config.admin.toBase58() !== admin.publicKey.toBase58()) {
    console.error("signer is not the current admin — aborting");
    process.exit(1);
  }

  console.log("transferring admin to:", NEW_ADMIN.toBase58());
  const sig = await program.methods
    .updateAdmin(NEW_ADMIN)
    .accounts({ admin: admin.publicKey, config: configPda })
    .rpc();
  console.log("tx:", sig);

  await new Promise((r) => setTimeout(r, 2000));
  const after: any = await program.account.config.fetch(configPda);
  console.log("config.admin now:", after.admin.toBase58());
  if (after.admin.toBase58() === NEW_ADMIN.toBase58()) {
    console.log("SUCCESS — admin transferred to", NEW_ADMIN.toBase58());
  } else {
    console.error("FAILED — admin did not change");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
