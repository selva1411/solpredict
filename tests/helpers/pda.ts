import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export function getConfigPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );
  return pda;
}

export function getMarketPda(marketId: anchor.BN, programId: PublicKey): PublicKey {
  // Convert BN to 8-byte little-endian buffer
  const marketIdBuffer = marketId.toArrayLike(Buffer, "le", 8);
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), marketIdBuffer],
    programId
  );
  return pda;
}

export function getYesMintPda(marketPda: PublicKey, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("yes_mint"), marketPda.toBuffer()],
    programId
  );
  return pda;
}

export function getNoMintPda(marketPda: PublicKey, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("no_mint"), marketPda.toBuffer()],
    programId
  );
  return pda;
}

export function getTreasuryPda(marketPda: PublicKey, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("treasury"), marketPda.toBuffer()],
    programId
  );
  return pda;
}

export function getUserPositionPda(
  marketPda: PublicKey,
  userPubkey: PublicKey,
  programId: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("position"),
      marketPda.toBuffer(),
      userPubkey.toBuffer(),
    ],
    programId
  );
  return pda;
}
