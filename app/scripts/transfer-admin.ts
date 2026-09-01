import { Connection, PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getConfigPda, getEmergencyPausePda } from "../src/lib/pda";

const RPC = process.env.LOCALNET_RPC_URL ?? "http://127.0.0.1:8899";
const PID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ?? "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
);

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const secret = JSON.parse(readFileSync(join(homedir(), ".config/solana/id.json"), "utf8"));
  const admin = Keypair.fromSecretKey(Uint8Array.from(secret));
  const provider = new AnchorProvider(conn, new Wallet(admin), { commitment: "confirmed" });
  const rawIdl = (await import("../src/lib/idl/solpredict.json", { with: { type: "json" } })).default;
  const program = new Program({ ...rawIdl, address: PID.toBase58() } as never, provider) as any;

  const configPda = getConfigPda(PID);
  const cfg: any = await program.account.config.fetch(configPda);
  const currentAdmin = cfg.admin.toBase58();
  if (currentAdmin !== admin.publicKey.toBase58()) {
    console.log("config.admin is already:", currentAdmin, "— nothing to do");
    return;
  }

  const dadWallet = new PublicKey(
    process.env.ADMIN_WALLET ?? "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf",
  );

  // Register dad wallet as guardian (needed for emergency unpause signatures).
  try {
    await program.methods
      .addGuardian(dadWallet)
      .accounts({
        admin: admin.publicKey,
        config: configPda,
        emergencyPause: getEmergencyPausePda(PID),
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
    console.log("guardian added:", dadWallet.toBase58());
  } catch (e) {
    console.log("addGuardian skipped:", (e as Error).message.slice(0, 120));
  }

  await program.methods
    .updateAdmin(dadWallet)
    .accounts({ admin: admin.publicKey, config: configPda })
    .signers([admin])
    .rpc();

  const final: any = await program.account.config.fetch(configPda);
  console.log("config.admin =", final.admin.toBase58());
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FATAL:", e.message ?? e);
    process.exit(1);
  });
