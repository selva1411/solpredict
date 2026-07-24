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

export function getMockPriceUpdatePda(payer: PublicKey, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("mock_price_feed"), payer.toBuffer()],
    programId
  );
  return pda;
}

export function getOrderPda(
  marketPda: PublicKey,
  makerPubkey: PublicKey,
  orderId: anchor.BN,
  programId: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("order"),
      marketPda.toBuffer(),
      makerPubkey.toBuffer(),
      orderId.toArrayLike(Buffer, "le", 8),
    ],
    programId
  );
  return pda;
}

export function getProposalPda(proposalId: anchor.BN, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("proposal"), proposalId.toArrayLike(Buffer, "le", 8)],
    programId
  );
  return pda;
}

export function getProposalVaultPda(proposalId: anchor.BN, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("proposal_vault"), proposalId.toArrayLike(Buffer, "le", 8)],
    programId
  );
  return pda;
}
