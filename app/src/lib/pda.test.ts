import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  getEmergencyPausePda,
  getConfigPda,
  getMarketPda,
  getYesMintPda,
  getNoMintPda,
  getTreasuryPda,
  getUserPositionPda,
  getOrderPda,
  getProposalPda,
  getProposalVaultPda,
} from "./pda";

const MOCK_PROGRAM_ID = new PublicKey("HVshSwptqBYKWM9MpZrA1bdP7zQ6RzJXVbr5PUR7wvtr");
const MOCK_USER = new PublicKey("2zPRxYVxFDUZn6QEYU2m6bzyZcN7pCCJ4E25gc2EQcCS");

describe("PDA Derivations against Rust Seeds Spec", () => {
  it("derives config PDA with 'config' seed", () => {
    const pda = getConfigPda(MOCK_PROGRAM_ID);
    const [expected] = PublicKey.findProgramAddressSync([Buffer.from("config")], MOCK_PROGRAM_ID);
    expect(pda.toBase58()).toBe(expected.toBase58());
  });

  it("derives emergency pause PDA with 'emergency_pause' seed", () => {
    const pda = getEmergencyPausePda(MOCK_PROGRAM_ID);
    const [expected] = PublicKey.findProgramAddressSync([Buffer.from("emergency_pause")], MOCK_PROGRAM_ID);
    expect(pda.toBase58()).toBe(expected.toBase58());
  });

  it("derives market PDA with 'market' + 8-byte LE market_id", () => {
    const marketId = new anchor.BN(42);
    const pda = getMarketPda(marketId, MOCK_PROGRAM_ID);
    const buf = marketId.toArrayLike(Buffer, "le", 8);
    const [expected] = PublicKey.findProgramAddressSync([Buffer.from("market"), buf], MOCK_PROGRAM_ID);
    expect(pda.toBase58()).toBe(expected.toBase58());
  });

  it("derives YES mint PDA with 'yes_mint' + marketPda", () => {
    const marketPda = getMarketPda(new anchor.BN(1), MOCK_PROGRAM_ID);
    const pda = getYesMintPda(marketPda, MOCK_PROGRAM_ID);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("yes_mint"), marketPda.toBuffer()],
      MOCK_PROGRAM_ID
    );
    expect(pda.toBase58()).toBe(expected.toBase58());
  });

  it("derives NO mint PDA with 'no_mint' + marketPda", () => {
    const marketPda = getMarketPda(new anchor.BN(1), MOCK_PROGRAM_ID);
    const pda = getNoMintPda(marketPda, MOCK_PROGRAM_ID);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("no_mint"), marketPda.toBuffer()],
      MOCK_PROGRAM_ID
    );
    expect(pda.toBase58()).toBe(expected.toBase58());
  });

  it("derives treasury PDA with 'treasury' + marketPda", () => {
    const marketPda = getMarketPda(new anchor.BN(1), MOCK_PROGRAM_ID);
    const pda = getTreasuryPda(marketPda, MOCK_PROGRAM_ID);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), marketPda.toBuffer()],
      MOCK_PROGRAM_ID
    );
    expect(pda.toBase58()).toBe(expected.toBase58());
  });

  it("derives user position PDA with 'position' + marketPda + userPubkey", () => {
    const marketPda = getMarketPda(new anchor.BN(1), MOCK_PROGRAM_ID);
    const pda = getUserPositionPda(marketPda, MOCK_USER, MOCK_PROGRAM_ID);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), MOCK_USER.toBuffer()],
      MOCK_PROGRAM_ID
    );
    expect(pda.toBase58()).toBe(expected.toBase58());
  });

  it("derives order PDA with 'order' + marketPda + makerPubkey + 8-byte LE orderId", () => {
    const marketPda = getMarketPda(new anchor.BN(1), MOCK_PROGRAM_ID);
    const orderId = new anchor.BN(100);
    const pda = getOrderPda(marketPda, MOCK_USER, orderId, MOCK_PROGRAM_ID);
    const [expected] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("order"),
        marketPda.toBuffer(),
        MOCK_USER.toBuffer(),
        orderId.toArrayLike(Buffer, "le", 8),
      ],
      MOCK_PROGRAM_ID
    );
    expect(pda.toBase58()).toBe(expected.toBase58());
  });

  it("derives proposal PDA with 'proposal' + 8-byte LE proposalId", () => {
    const proposalId = new anchor.BN(5);
    const pda = getProposalPda(proposalId, MOCK_PROGRAM_ID);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal"), proposalId.toArrayLike(Buffer, "le", 8)],
      MOCK_PROGRAM_ID
    );
    expect(pda.toBase58()).toBe(expected.toBase58());
  });

  it("derives proposal vault PDA with 'proposal_vault' + 8-byte LE proposalId", () => {
    const proposalId = new anchor.BN(5);
    const pda = getProposalVaultPda(proposalId, MOCK_PROGRAM_ID);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("proposal_vault"), proposalId.toArrayLike(Buffer, "le", 8)],
      MOCK_PROGRAM_ID
    );
    expect(pda.toBase58()).toBe(expected.toBase58());
  });
});
