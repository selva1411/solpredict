import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { Solpredict } from "../../target/types/solpredict";
import { getConfigPda, getMarketPda } from "./pda";

export const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

export const program = anchor.workspace.solpredict as Program<Solpredict>;
export const connection = provider.connection;

// Generate test keypairs
export const admin = Keypair.generate();
export const buyer1 = Keypair.generate();
export const buyer2 = Keypair.generate();

// Helper to fund accounts with SOL
export async function fundAccount(pubkey: PublicKey, solAmount: number = 5) {
  const transaction = new anchor.web3.Transaction().add(
    SystemProgram.transfer({
      fromPubkey: provider.wallet.publicKey,
      toPubkey: pubkey,
      lamports: solAmount * LAMPORTS_PER_SOL,
    })
  );
  await provider.sendAndConfirm(transaction);
}

// Helper to derive the mock price update account PDA (seeds: ["mock_price_feed", payer])
export function getMockPriceUpdatePda(payer: PublicKey, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mock_price_feed"), payer.toBuffer()],
    programId
  );
  return pda;
}

// Helper to bootstrap the Config singleton
export async function bootstrapConfig(feeBps: number = 200) {
  await fundAccount(admin.publicKey);
  
  const configPda = getConfigPda(program.programId);
  
  const tx = await program.methods
    .initializeConfig(feeBps)
    .accounts({
      admin: admin.publicKey,
      config: configPda,
    } as any)
    .signers([admin])
    .rpc();
    
  return { tx, configPda };
}

// Helper to bootstrap a prediction market
export async function bootstrapMarket(
  configPda: PublicKey,
  question: string = "Will SOL exceed $250 by Dec 2026?",
  description: string = "Settles based on Pyth SOL/USD price feed.",
  category: number = 0, // Crypto
  oracleFeedId: number[] = Array(32).fill(1), // Dummy feed ID
  targetPrice: anchor.BN = new anchor.BN(250_00000000), // $250.00 (8 decimals)
  targetExpo: number = -8,
  comparison: number = 0, // GreaterThan
  endTs: anchor.BN = new anchor.BN(Math.floor(Date.now() / 1000) + 3600), // 1 hour from now
  resolveTs: anchor.BN = new anchor.BN(Math.floor(Date.now() / 1000) + 3600),
  sharePriceLamports: anchor.BN = new anchor.BN(10_000_000) // 0.01 SOL per share
) {
  // Read current config to get market ID
  const configAccount = await program.account.config.fetch(configPda);
  const marketId = configAccount.marketCount;
  
  const marketPda = getMarketPda(marketId, program.programId);
  const [yesMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("yes_mint"), marketPda.toBuffer()],
    program.programId
  );
  const [noMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("no_mint"), marketPda.toBuffer()],
    program.programId
  );
  const [treasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), marketPda.toBuffer()],
    program.programId
  );
  
  const tx = await program.methods
    .initializeMarket(
      question,
      description,
      category,
      oracleFeedId,
      targetPrice,
      targetExpo,
      comparison,
      endTs,
      resolveTs,
      sharePriceLamports
    )
    .accounts({
      admin: admin.publicKey,
      config: configPda,
      market: marketPda,
      yesMint: yesMintPda,
      noMint: noMintPda,
      treasury: treasuryPda,
    } as any)
    .signers([admin])
    .rpc();
    
  return {
    tx,
    marketId,
    marketPda,
    yesMintPda,
    noMintPda,
    treasuryPda,
  };
}
