import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import { Solpredict } from "../target/types/solpredict";
import {
  program,
  connection,
  admin,
  fundAccount,
  bootstrapConfig,
} from "./helpers/setup";
import {
  getConfigPda,
  getProposalPda,
  getProposalVaultPda,
} from "./helpers/pda";

describe("reject_market flow", () => {
  let configPda: PublicKey;

  before(async () => {
    const { configPda: cfg } = await bootstrapConfig(200);
    configPda = cfg;
  });

  async function propose(question: string, proposer: Keypair) {
    const config = await program.account.config.fetch(configPda);
    const id = config.marketCount;
    const proposalPda = getProposalPda(id, program.programId);
    const vaultPda = getProposalVaultPda(id, program.programId);

    const now = Math.floor(Date.now() / 1000);
    await program.methods
      .proposeMarket(
        question,
        "Rejected in focused test",
        0,
        Array(32).fill(0),
        new anchor.BN(200_000_00000000),
        0,
        0,
        new anchor.BN(now + 3700),
        new anchor.BN(now + 3700),
        new anchor.BN(10_000_000)
      )
      .accounts({
        proposer: proposer.publicKey,
        config: configPda,
        proposal: proposalPda,
        proposalVault: vaultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([proposer])
      .rpc();

    return { id, proposalPda, vaultPda };
  }

  async function reject(adminKey: Keypair, proposalPda: PublicKey, vaultPda: PublicKey) {
    return program.methods
      .rejectMarket()
      .accounts({
        admin: adminKey.publicKey,
        config: configPda,
        proposal: proposalPda,
        proposalVault: vaultPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([adminKey])
      .rpc();
  }

  it("rejects a pending proposal: closes the account and slashes the bond", async () => {
    const proposer = Keypair.generate();
    await fundAccount(proposer.publicKey, 10);

    const { proposalPda, vaultPda } = await propose("Will BTC hit $200k? (reject me)", proposer);

    const vaultBefore = await connection.getBalance(vaultPda);
    const adminBefore = await connection.getBalance(admin.publicKey);
    expect(vaultBefore).to.be.greaterThan(0); // bond escrowed

    await reject(admin, proposalPda, vaultPda);

    // Proposal PDA is closed (no longer exists on-chain).
    const closed = await connection.getAccountInfo(proposalPda);
    expect(closed).to.be.null;

    // Bond was slashed: vault drained, admin received the bond lamports.
    const vaultAfter = await connection.getBalance(vaultPda);
    const adminAfter = await connection.getBalance(admin.publicKey);
    expect(vaultAfter).to.equal(0);
    expect(adminAfter - adminBefore).to.be.greaterThanOrEqual(vaultBefore);
  });

  it("fails to reject a proposal that was already approved", async () => {
    const proposer = Keypair.generate();
    await fundAccount(proposer.publicKey, 10);

    const { id, proposalPda, vaultPda } = await propose("Will ETH hit $10k? (approved first)", proposer);

    // Approve it first (creates the market, keeps the proposal account with status Approved).
    await program.methods
      .approveMarket()
      .accounts({
        admin: admin.publicKey,
        config: configPda,
        proposal: proposalPda,
        proposalVault: vaultPda,
        proposer: proposer.publicKey,
      } as any)
      .signers([admin])
      .rpc();

    const proposalAccount = await program.account.marketProposal.fetch(proposalPda);
    expect(proposalAccount.status).to.deep.equal({ approved: {} });

    try {
      await reject(admin, proposalPda, vaultPda);
      expect.fail("Should have failed with ProposalNotPending");
    } catch (err: any) {
      expect(err.message).to.include("ProposalNotPending");
    }
  });

  it("non-admin cannot reject a proposal", async () => {
    const fakeAdmin = Keypair.generate();
    await fundAccount(fakeAdmin.publicKey, 2);

    const proposer = Keypair.generate();
    await fundAccount(proposer.publicKey, 10);

    const { proposalPda, vaultPda } = await propose("Will DOGE reach $1? (guarded)", proposer);

    try {
      await reject(fakeAdmin, proposalPda, vaultPda);
      expect.fail("Should have failed with Unauthorized");
    } catch (err: any) {
      expect(err.message).to.include("Unauthorized");
    }

    // Proposal is still pending and vault untouched.
    const proposalAccount = await program.account.marketProposal.fetch(proposalPda);
    expect(proposalAccount.status).to.deep.equal({ pending: {} });
    const vaultAfter = await connection.getBalance(vaultPda);
    expect(vaultAfter).to.be.greaterThan(0);
  });
});
