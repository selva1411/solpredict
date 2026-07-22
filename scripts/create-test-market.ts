/**
 * Creates a fresh test prediction market for simulation.
 * Usage: ANCHOR_WALLET=$HOME/.config/solana/id.json npx tsx scripts/create-test-market.ts
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8899";
const connection = new Connection(RPC_URL, "confirmed");

const idlPath = path.join(__dirname, "../app/src/lib/idl/solpredict.json");
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
const programId = new PublicKey(idl.address || idl.metadata?.address);

async function main() {
  const adminWallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, adminWallet, {
    commitment: "confirmed",
  });
  const program = new Program(idl, provider);
  const admin = adminWallet.payer;

  console.log("Admin pubkey:", admin.publicKey.toBase58());
  console.log("Program ID:", programId.toBase58());

  // Ensure admin has SOL
  const balance = await connection.getBalance(admin.publicKey);
  if (balance < 2 * LAMPORTS_PER_SOL) {
    console.log("Airdropping 10 SOL to admin...");
    const sig = await connection.requestAirdrop(admin.publicKey, 10 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  }

  // Check if config exists, initialize if not
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );

  try {
    await program.account.config.fetch(configPda);
    console.log("✓ Config already initialized");
  } catch {
    console.log("Initializing config...");
    await program.methods
      .initializeConfig(500) // 5% fee
      .accounts({
        admin: admin.publicKey,
        config: configPda,
      } as any)
      .rpc();
    console.log("✓ Config initialized with 5% fee");
  }

  // Check current market count
  const configAcc = await program.account.config.fetch(configPda) as any;
  const marketId = configAcc.marketCount;
  console.log(`Next market ID: ${marketId.toString()}`);

  // Derive PDAs
  const marketIdBuffer = marketId.toArrayLike(Buffer, "le", 8);
  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), marketIdBuffer],
    programId
  );
  const [yesMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("yes_mint"), marketPda.toBuffer()],
    programId
  );
  const [noMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("no_mint"), marketPda.toBuffer()],
    programId
  );
  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), marketPda.toBuffer()],
    programId
  );

  // Create market 1 hour from now, resolve 1.5 hours from now
  const now = Math.floor(Date.now() / 1000);
  const endTs = now + 3600; // 1 hour
  const resolveTs = now + 5400; // 1.5 hours

  // SOL/USD feed ID (Pyth devnet) — 32 bytes 
  const solFeedId = Buffer.alloc(32);
  solFeedId.write("sol_usd_mock_feed_id_for_test___");

  const question = "Will SOL exceed $200.00 in the next 1 hour?";
  const description = "This market resolves YES if the price of SOL/USD exceeds $200.00 at the resolution time. Uses dynamic AMM pricing with CPMM pool ratios.";
  const sharePriceLamports = new anchor.BN(0.01 * LAMPORTS_PER_SOL); // 0.01 SOL per share

  console.log("\nCreating prediction market...");
  console.log(`  Question:   "${question}"`);
  console.log(`  End Time:   ${new Date(endTs * 1000).toLocaleTimeString()} (${Math.round((endTs - now) / 60)} mins)`);
  console.log(`  Resolve:    ${new Date(resolveTs * 1000).toLocaleTimeString()}`);
  console.log(`  Share Price: 0.01 SOL`);
  console.log(`  Market PDA: ${marketPda.toBase58()}`);

  const sig = await program.methods
    .initializeMarket(
      question,
      description,
      0, // category: Crypto
      Array.from(solFeedId), // oracle_feed_id
      new anchor.BN(20000), // target_price: $200.00 (expo -2)
      -2, // target_expo
      0, // comparison: GreaterThan
      new anchor.BN(endTs),
      new anchor.BN(resolveTs),
      sharePriceLamports,
    )
    .accounts({
      admin: admin.publicKey,
      config: configPda,
      market: marketPda,
      yesMint: yesMintPda,
      noMint: noMintPda,
      treasury: treasuryPda,
    } as any)
    .rpc();

  console.log(`\n✅ Market created successfully!`);
  console.log(`  Signature: ${sig}`);
  console.log(`  Market PDA: ${marketPda.toBase58()}`);
  console.log(`\nYou can now run the simulation:`);
  console.log(`  ANCHOR_WALLET=$HOME/.config/solana/id.json npx tsx scripts/simulate-traders.ts`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
