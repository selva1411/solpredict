import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createTransferInstruction } from "@solana/spl-token";
import { expect } from "chai";
import { Solpredict } from "../target/types/solpredict";
import {
  program,
  connection,
  provider,
  admin,
  buyer1,
  buyer2,
  fundAccount,
  bootstrapConfig,
  bootstrapMarket,
  getMockPriceUpdatePda,
} from "./helpers/setup";
import {
  getConfigPda,
  getMarketPda,
  getYesMintPda,
  getNoMintPda,
  getTreasuryPda,
  getUserPositionPda,
} from "./helpers/pda";

async function ensureTimePassed(targetTs: number) {
  let currentSlotVal = await connection.getSlot();
  let currentTime = await connection.getBlockTime(currentSlotVal) || Math.floor(Date.now() / 1000);
  while (currentTime < targetTs) {
    // Send a tiny transaction to force a block to be mined, which advances the clock
    await fundAccount(Keypair.generate().publicKey, 0.001);
    await new Promise((resolve) => setTimeout(resolve, 500));
    currentSlotVal = await connection.getSlot();
    currentTime = await connection.getBlockTime(currentSlotVal) || Math.floor(Date.now() / 1000);
  }
}

describe("SOLPredict Integration Suite", () => {
  let configPda: PublicKey;
  let oracleFeedId = Array(32).fill(0); // Standard feed ID mock
  oracleFeedId[0] = 1; // [1, 0, 0, ...]
  
  before(async () => {
    // Wait until the local validator is responsive
    let retries = 20;
    while (retries > 0) {
      try {
        await connection.getLatestBlockhash();
        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Fund buyer accounts
    await fundAccount(buyer1.publicKey, 10);
    await fundAccount(buyer2.publicKey, 10);
  });

  describe("Phase 2: initialize_config + initialize_market", () => {
    it("Initialize Config fails when fee is too high (>10%)", async () => {
      const failAdmin = Keypair.generate();
      await fundAccount(failAdmin.publicKey, 2);
      
      const failConfigPda = getConfigPda(program.programId);
      try {
        await program.methods
          .initializeConfig(1500) // 15% fee
          .accounts({
            admin: failAdmin.publicKey,
            config: failConfigPda,
          } as any)
          .signers([failAdmin])
          .rpc();
        expect.fail("Should have failed with FeeTooHigh");
      } catch (err: any) {
        console.log("HIGH FEE ERROR MESSAGE:", err.message);
        console.log("HIGH FEE ERROR OBJECT:", err);
        expect(err.message).to.satisfy((msg: string) => 
          msg.includes("FeeTooHigh") || msg.includes("0x1783") || msg.includes("6019")
        );
      }
    });

    it("Initialize Config successfully", async () => {
      const result = await bootstrapConfig(200); // 2% fee
      configPda = result.configPda;

      const configAccount = await program.account.config.fetch(configPda);
      expect(configAccount.admin.toBase58()).to.equal(admin.publicKey.toBase58());
      expect(configAccount.feeBps).to.equal(200);
      expect(configAccount.marketCount.toNumber()).to.equal(0);
    });

    it("Initialize Config fails on duplicate initialization", async () => {
      try {
        await program.methods
          .initializeConfig(200)
          .accounts({
            admin: admin.publicKey,
            config: configPda,
          } as any)
          .signers([admin])
          .rpc();
        expect.fail("Should have failed due to account already in use");
      } catch (err: any) {
        // Anchor init constraint throws already in use / custom error
        expect(err.message).to.include("already in use");
      }
    });

    it("Initialize Market successfully", async () => {
      const { marketPda, marketId } = await bootstrapMarket(configPda);
      const marketAccount = await program.account.market.fetch(marketPda);

      expect(marketAccount.marketId.toNumber()).to.equal(0);
      expect(marketAccount.question).to.equal("Will SOL exceed $250 by Dec 2026?");
      expect(marketAccount.status).to.deep.equal({ open: {} });
      expect(marketAccount.winningOutcome).to.deep.equal({ unset: {} });
      expect(marketAccount.yesSupply.toNumber()).to.equal(0);
      expect(marketAccount.noSupply.toNumber()).to.equal(0);
      expect(marketAccount.sharePriceLamports.toNumber()).to.equal(10_000_000); // 0.01 SOL
    });

    it("Initialize Market fails with unauthorized admin key", async () => {
      const fakeAdmin = Keypair.generate();
      await fundAccount(fakeAdmin.publicKey, 2);

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

      try {
        await program.methods
          .initializeMarket(
            "Fake Question?",
            "Description",
            0,
            oracleFeedId,
            new anchor.BN(100),
            -2,
            0,
            new anchor.BN(Math.floor(Date.now() / 1000) + 1000),
            new anchor.BN(Math.floor(Date.now() / 1000) + 1000),
            new anchor.BN(10_000_000)
          )
          .accounts({
            admin: fakeAdmin.publicKey,
            config: configPda,
            market: marketPda,
            yesMint: yesMintPda,
            noMint: noMintPda,
          } as any)
          .signers([fakeAdmin])
          .rpc();
        expect.fail("Should have failed with Unauthorized");
      } catch (err: any) {
        expect(err.message).to.include("Unauthorized");
      }
    });

    it("Initialize Market fails if end time is in the past", async () => {
      const pastEnd = new anchor.BN(Math.floor(Date.now() / 1000) - 10);
      try {
        await bootstrapMarket(
          configPda,
          "Past market?",
          "Desc",
          0,
          oracleFeedId,
          new anchor.BN(250),
          -2,
          0,
          pastEnd,
          pastEnd
        );
        expect.fail("Should have failed with InvalidEndTime");
      } catch (err: any) {
        expect(err.message).to.include("InvalidEndTime");
      }
    });
  });

  describe("Phase 3: buy_shares", () => {
    let marketPda: PublicKey;
    let yesMintPda: PublicKey;
    let noMintPda: PublicKey;
    let treasuryPda: PublicKey;

    before(async () => {
      // Create a fresh market for buying tests
      const result = await bootstrapMarket(configPda, "Buy Shares Test Market?", "Desc", 0, oracleFeedId);
      marketPda = result.marketPda;
      yesMintPda = result.yesMintPda;
      noMintPda = result.noMintPda;
      treasuryPda = result.treasuryPda;
    });

    it("Buyer1 buys 10 YES shares successfully", async () => {
      const quantity = new anchor.BN(10); // 10 shares
      const buyerYesAta = getAssociatedTokenAddressSync(yesMintPda, buyer1.publicKey);
      const buyerNoAta = getAssociatedTokenAddressSync(noMintPda, buyer1.publicKey);
      const positionPda = getUserPositionPda(marketPda, buyer1.publicKey, program.programId);

      const beforeBalance = await connection.getBalance(buyer1.publicKey);
      
      console.log("buyer1.publicKey:", buyer1.publicKey.toBase58());
      console.log("marketPda:", marketPda.toBase58());
      console.log("treasuryPda:", treasuryPda.toBase58());
      console.log("yesMintPda:", yesMintPda.toBase58());
      console.log("noMintPda:", noMintPda.toBase58());
      console.log("buyerYesAta:", buyerYesAta.toBase58());
      console.log("buyerNoAta:", buyerNoAta.toBase58());
      console.log("positionPda:", positionPda.toBase58());

      const tx = await program.methods
        .buyShares({ yes: {} } as any, quantity)
        .accounts({
          buyer: buyer1.publicKey,
          market: marketPda,
          treasury: treasuryPda,
          yesMint: yesMintPda,
          noMint: noMintPda,
          buyerYesAta: buyerYesAta,
          buyerNoAta: buyerNoAta,
          userPosition: positionPda,
        } as any)
        .signers([buyer1])
        .rpc();

      const afterBalance = await connection.getBalance(buyer1.publicKey);
      const marketAccount = await program.account.market.fetch(marketPda);
      const positionAccount = await program.account.userPosition.fetch(positionPda);

      // Cost was 10 shares * 10_000_000 lamports = 100_000_000 lamports (0.1 SOL)
      expect(marketAccount.yesPoolLamports.toNumber()).to.equal(100_000_000);
      expect(marketAccount.yesSupply.toNumber()).to.equal(10_000_000); // 10 * 10^6 base units
      expect(positionAccount.yesAmount.toNumber()).to.equal(10_000_000);
      expect(positionAccount.totalSpentLamports.toNumber()).to.equal(100_000_000);
      expect(beforeBalance - afterBalance).to.be.greaterThan(100_000_000); // Cost + transaction fees
    });

    it("Buyer2 buys 20 NO shares successfully", async () => {
      const quantity = new anchor.BN(20);
      const buyerYesAta = getAssociatedTokenAddressSync(yesMintPda, buyer2.publicKey);
      const buyerNoAta = getAssociatedTokenAddressSync(noMintPda, buyer2.publicKey);
      const positionPda = getUserPositionPda(marketPda, buyer2.publicKey, program.programId);

      await program.methods
        .buyShares({ no: {} } as any, quantity)
        .accounts({
          buyer: buyer2.publicKey,
          market: marketPda,
          treasury: treasuryPda,
          yesMint: yesMintPda,
          noMint: noMintPda,
          buyerYesAta: buyerYesAta,
          buyerNoAta: buyerNoAta,
          userPosition: positionPda,
        } as any)
        .signers([buyer2])
        .rpc();

      const marketAccount = await program.account.market.fetch(marketPda);
      const positionAccount = await program.account.userPosition.fetch(positionPda);

      expect(marketAccount.noPoolLamports.toNumber()).to.equal(200_000_000); // 0.2 SOL
      expect(marketAccount.noSupply.toNumber()).to.equal(20_000_000);
      expect(positionAccount.noAmount.toNumber()).to.equal(20_000_000);
      expect(positionAccount.totalSpentLamports.toNumber()).to.equal(200_000_000);
    });

    it("Buying fails if quantity is zero", async () => {
      const buyerYesAta = getAssociatedTokenAddressSync(yesMintPda, buyer1.publicKey);
      const buyerNoAta = getAssociatedTokenAddressSync(noMintPda, buyer1.publicKey);
      const positionPda = getUserPositionPda(marketPda, buyer1.publicKey, program.programId);

      try {
        await program.methods
          .buyShares({ yes: {} } as any, new anchor.BN(0))
          .accounts({
            buyer: buyer1.publicKey,
            market: marketPda,
            treasury: treasuryPda,
            yesMint: yesMintPda,
            noMint: noMintPda,
            buyerYesAta: buyerYesAta,
            buyerNoAta: buyerNoAta,
            userPosition: positionPda,
          } as any)
          .signers([buyer1])
          .rpc();
        expect.fail("Should have failed with InvalidQuantity");
      } catch (err: any) {
        console.log("QTY ERROR MESSAGE:", err.message);
        expect(err.message).to.satisfy((msg: string) => 
          msg.includes("InvalidQuantity") || msg.includes("0x177d") || msg.includes("6013")
        );
      }
    });
  });

  describe("Phase 4: settle_market + Oracle", () => {
    let marketPda: PublicKey;
    let yesMintPda: PublicKey;
    let noMintPda: PublicKey;
    let treasuryPda: PublicKey;
    let mockPriceUpdatePda: PublicKey;
    let feedId = Array(32).fill(0); // Devnet SOL/USD feed ID mock
    feedId[0] = 55; // Unique feed ID for this market
    let resolveTsVal: number;

    before(async () => {
      // 1. Create a market with short duration so it resolves quickly
      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const now = blockTime ? blockTime : Math.floor(Date.now() / 1000);
      resolveTsVal = now + 10;
      
      const result = await bootstrapMarket(
        configPda,
        "Will SOL be above $200?",
        "Oracle Settle Test",
        0, // Category Crypto
        feedId,
        new anchor.BN(200_00000), // Target price $200.00 (5 decimals)
        -5, // Exponent -5 (matching 5 decimals)
        0, // GreaterThan comparison
        new anchor.BN(now + 10), // endTs (expires in 10 seconds)
        new anchor.BN(now + 10)  // resolveTs
      );
      marketPda = result.marketPda;
      yesMintPda = result.yesMintPda;
      noMintPda = result.noMintPda;
      treasuryPda = result.treasuryPda;

      // 2. Derive mock price update account PDA (owned by our program, which is allowed)
      mockPriceUpdatePda = getMockPriceUpdatePda(admin.publicKey, program.programId);

      // 3. User buys positions so market has supplies
      const buyerYesAta = getAssociatedTokenAddressSync(yesMintPda, buyer1.publicKey);
      const buyerNoAta = getAssociatedTokenAddressSync(noMintPda, buyer1.publicKey);
      const positionPda = getUserPositionPda(marketPda, buyer1.publicKey, program.programId);
      
      await program.methods
        .buyShares({ yes: {} } as any, new anchor.BN(5))
        .accounts({
          buyer: buyer1.publicKey,
          market: marketPda,
          treasury: treasuryPda,
          yesMint: yesMintPda,
          noMint: noMintPda,
          buyerYesAta: buyerYesAta,
          buyerNoAta: buyerNoAta,
          userPosition: positionPda,
        } as any)
        .signers([buyer1])
        .rpc();

      const buyerYesAta2 = getAssociatedTokenAddressSync(yesMintPda, buyer2.publicKey);
      const buyerNoAta2 = getAssociatedTokenAddressSync(noMintPda, buyer2.publicKey);
      const positionPda2 = getUserPositionPda(marketPda, buyer2.publicKey, program.programId);

      await program.methods
        .buyShares({ no: {} } as any, new anchor.BN(10))
        .accounts({
          buyer: buyer2.publicKey,
          market: marketPda,
          treasury: treasuryPda,
          yesMint: yesMintPda,
          noMint: noMintPda,
          buyerYesAta: buyerYesAta2,
          buyerNoAta: buyerNoAta2,
          userPosition: positionPda2,
        } as any)
        .signers([buyer2])
        .rpc();

      // Wait until validator clock actually passes resolveTsVal
      await ensureTimePassed(resolveTsVal);
    });

    it("Fails settlement if oracle price is stale (>60s age)", async () => {
      // Create price update with publish time 120s in the past
      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const now = blockTime ? blockTime : Math.floor(Date.now() / 1000);
      const staleTime = new anchor.BN(now - 120);
      
      const mockPayer = Keypair.generate();
      await fundAccount(mockPayer.publicKey, 1);
      const currentMockPda = getMockPriceUpdatePda(mockPayer.publicKey, program.programId);

      await program.methods
        .mockCreatePriceUpdate(
          feedId,
          new anchor.BN(220_000000), // Price $220 (6 decimals)
          new anchor.BN(100), // Confidence
          -6, // Exponent
          staleTime
        )
        .accounts({
          payer: mockPayer.publicKey,
          priceUpdate: currentMockPda,
        } as any)
        .signers([mockPayer])
        .rpc();

      try {
        await program.methods
          .settleMarket()
          .accounts({
            market: marketPda,
            config: configPda,
            priceUpdate: currentMockPda,
          } as any)
          .rpc();
        expect.fail("Should have failed with StaleOracle");
      } catch (err: any) {
        expect(err.message).to.include("StaleOracle");
      }
    });

    it("Fails settlement if price update contains wrong feed ID", async () => {
      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const now = blockTime ? blockTime : Math.floor(Date.now() / 1000);
      const rightTime = new anchor.BN(now);
      const wrongFeedId = Array(32).fill(9); // Totally different feed ID
      
      const mockPayer = Keypair.generate();
      await fundAccount(mockPayer.publicKey, 1);
      const currentMockPda = getMockPriceUpdatePda(mockPayer.publicKey, program.programId);

      await program.methods
        .mockCreatePriceUpdate(
          wrongFeedId,
          new anchor.BN(220_000000),
          new anchor.BN(100),
          -6,
          rightTime
        )
        .accounts({
          payer: mockPayer.publicKey,
          priceUpdate: currentMockPda,
        } as any)
        .signers([mockPayer])
        .rpc();

      try {
        await program.methods
          .settleMarket()
          .accounts({
            market: marketPda,
            config: configPda,
            priceUpdate: currentMockPda,
          } as any)
          .rpc();
        expect.fail("Should have failed with InvalidOracleFeed");
      } catch (err: any) {
        expect(err.message).to.include("InvalidOracleFeed");
      }
    });

    it("Fails settlement if oracle confidence is too low (>2% conf/price)", async () => {
      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const now = blockTime ? blockTime : Math.floor(Date.now() / 1000);
      const rightTime = new anchor.BN(now);
      
      const mockPayer = Keypair.generate();
      await fundAccount(mockPayer.publicKey, 1);
      const currentMockPda = getMockPriceUpdatePda(mockPayer.publicKey, program.programId);

      // Price = 220, confidence = 10 (which is 10/220 = 4.5% > 2% max threshold)
      await program.methods
        .mockCreatePriceUpdate(
          feedId,
          new anchor.BN(220_00000),
          new anchor.BN(10_00000), // Huge confidence interval ($10 difference)
          -5,
          rightTime
        )
        .accounts({
          payer: mockPayer.publicKey,
          priceUpdate: currentMockPda,
        } as any)
        .signers([mockPayer])
        .rpc();

      try {
        await program.methods
          .settleMarket()
          .accounts({
            market: marketPda,
            config: configPda,
            priceUpdate: currentMockPda,
          } as any)
          .rpc();
        expect.fail("Should have failed with LowOracleConfidence");
      } catch (err: any) {
        expect(err.message).to.include("LowOracleConfidence");
      }
    });

    it("Settle Market successfully: YES wins (with exponent normalization)", async () => {
      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const now = blockTime ? blockTime : Math.floor(Date.now() / 1000);
      const rightTime = new anchor.BN(now);
      
      const mockPayer = Keypair.generate();
      await fundAccount(mockPayer.publicKey, 1);
      const currentMockPda = getMockPriceUpdatePda(mockPayer.publicKey, program.programId);

      // Target price: 200_00000 (5 decimals) = $200.00
      // Oracle price: 215_00000000 (8 decimals) = $215.00 (which is > $200, so YES wins)
      // Exponents: -8 (oracle) vs -5 (target).
      // Logic scaling scales target UP to -8: 200_00000 * 10^3 = 200_00000000
      // Direct compare: 215_00000000 > 200_00000000 -> True.
      await program.methods
        .mockCreatePriceUpdate(
          feedId,
          new anchor.BN(215_00000000),
          new anchor.BN(1), // Tight confidence
          -8, // -8 exponent
          rightTime
        )
        .accounts({
          payer: mockPayer.publicKey,
          priceUpdate: currentMockPda,
        } as any)
        .signers([mockPayer])
        .rpc();

      const tx = await program.methods
        .settleMarket()
        .accounts({
          market: marketPda,
          config: configPda,
          priceUpdate: currentMockPda,
        } as any)
        .rpc();

      const marketAccount = await program.account.market.fetch(marketPda);

      expect(marketAccount.status).to.deep.equal({ settled: {} });
      expect(marketAccount.winningOutcome).to.deep.equal({ yes: {} });
      expect(marketAccount.settledPrice.toNumber()).to.equal(215_00000000);
      
      // Fee collected from losing pool (NO pool = 10 shares * 0.01 = 100_000_000 lamports)
      // fee = 100_000_000 * 200 bps (2%) = 2_000_000 lamports
      // total_payout_pool = total pool (150_000_000) - fee (2_000_000) = 148_000_000 lamports
      expect(marketAccount.feeCollected.toNumber()).to.equal(2_000_000);
      expect(marketAccount.totalPayoutPool.toNumber()).to.equal(148_000_000);
    });

    it("settle_market_manual correctly settles a Sports market with outcome=1 (YES wins)", async () => {
      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const now = blockTime ? blockTime : Math.floor(Date.now() / 1000);
      const manualResolveTsVal = now + 10;

      const sportsFeedId = Array(32).fill(0);
      const result = await bootstrapMarket(
        configPda,
        "Will Team Giants win the game?",
        "Sports prediction",
        1,
        sportsFeedId,
        new anchor.BN(0),
        0,
        0,
        new anchor.BN(manualResolveTsVal),
        new anchor.BN(manualResolveTsVal)
      );

      const sportsMarketPda = result.marketPda;
      const sportsYesMint = result.yesMintPda;
      const sportsNoMint = result.noMintPda;

      const buyer1YesAta = getAssociatedTokenAddressSync(sportsYesMint, buyer1.publicKey);
      const buyer1NoAta = getAssociatedTokenAddressSync(sportsNoMint, buyer1.publicKey);
      const buyer2YesAta = getAssociatedTokenAddressSync(sportsYesMint, buyer2.publicKey);
      const buyer2NoAta = getAssociatedTokenAddressSync(sportsNoMint, buyer2.publicKey);
      const positionPda1 = getUserPositionPda(sportsMarketPda, buyer1.publicKey, program.programId);
      const positionPda2 = getUserPositionPda(sportsMarketPda, buyer2.publicKey, program.programId);

      await program.methods
        .buyShares({ yes: {} } as any, new anchor.BN(5))
        .accounts({
          buyer: buyer1.publicKey,
          market: sportsMarketPda,
          treasury: result.treasuryPda,
          yesMint: sportsYesMint,
          noMint: sportsNoMint,
          buyerYesAta: buyer1YesAta,
          buyerNoAta: buyer1NoAta,
          userPosition: positionPda1,
        } as any)
        .signers([buyer1])
        .rpc();

      await program.methods
        .buyShares({ no: {} } as any, new anchor.BN(10))
        .accounts({
          buyer: buyer2.publicKey,
          market: sportsMarketPda,
          treasury: result.treasuryPda,
          yesMint: sportsYesMint,
          noMint: sportsNoMint,
          buyerYesAta: buyer2YesAta,
          buyerNoAta: buyer2NoAta,
          userPosition: positionPda2,
        } as any)
        .signers([buyer2])
        .rpc();

      await ensureTimePassed(manualResolveTsVal);

      await program.methods
        .settleMarketManual(1)
        .accounts({
          admin: admin.publicKey,
          config: configPda,
          market: sportsMarketPda,
        } as any)
        .signers([admin])
        .rpc();

      const marketAccount = await program.account.market.fetch(sportsMarketPda);
      expect(marketAccount.status).to.deep.equal({ settled: {} });
      expect(marketAccount.winningOutcome).to.deep.equal({ yes: {} });
      expect(marketAccount.settledPrice.toNumber()).to.equal(0);
    });

    it("settle_market (oracle path) correctly rejects a Sports market with UseManualSettlement error", async () => {
      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const now = blockTime ? blockTime : Math.floor(Date.now() / 1000);
      const manualResolveTsVal = now + 10;

      const sportsFeedId = Array(32).fill(0);
      const result = await bootstrapMarket(
        configPda,
        "Will Team Giants win the game? (reject test)",
        "Sports prediction",
        1,
        sportsFeedId,
        new anchor.BN(0),
        0,
        0,
        new anchor.BN(manualResolveTsVal),
        new anchor.BN(manualResolveTsVal)
      );

      const sportsMarketPda = result.marketPda;
      
      await ensureTimePassed(manualResolveTsVal);

      const mockPayer = Keypair.generate();
      await fundAccount(mockPayer.publicKey, 1);
      const currentMockPda = getMockPriceUpdatePda(mockPayer.publicKey, program.programId);

      await program.methods
        .mockCreatePriceUpdate(
          sportsFeedId,
          new anchor.BN(215_00000000),
          new anchor.BN(1),
          -8,
          new anchor.BN(now)
        )
        .accounts({
          payer: mockPayer.publicKey,
          priceUpdate: currentMockPda,
        } as any)
        .signers([mockPayer])
        .rpc();

      try {
        await program.methods
          .settleMarket()
          .accounts({
            market: sportsMarketPda,
            config: configPda,
            priceUpdate: currentMockPda,
          } as any)
          .rpc();
        expect.fail("Should have failed with UseManualSettlement");
      } catch (err: any) {
        expect(err.message).to.include("UseManualSettlement");
      }
    });

    it("initialize_market rejects non-zero feed ID for Sports and Politics", async () => {
      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const now = blockTime ? blockTime : Math.floor(Date.now() / 1000);
      const resolveTs = now + 10;
      
      const nonZeroFeed = Array(32).fill(0);
      nonZeroFeed[0] = 12;

      try {
        await bootstrapMarket(
          configPda,
          "Sports with non-zero feed",
          "Should fail init",
          1, // Sports
          nonZeroFeed,
          new anchor.BN(100),
          0,
          0,
          new anchor.BN(resolveTs),
          new anchor.BN(resolveTs)
        );
        expect.fail("Should have failed with UseManualSettlement");
      } catch (err: any) {
        expect(err.message).to.include("UseManualSettlement");
      }
    });

    it("settle_market (oracle) successfully settles a Tech market with non-zero feed ID", async () => {
      const slot = await connection.getSlot();
      const blockTime = await connection.getBlockTime(slot);
      const now = blockTime ? blockTime : Math.floor(Date.now() / 1000);
      const resolveTs = now + 10;

      const techFeed = Array(32).fill(0);
      techFeed[0] = 88;

      const result = await bootstrapMarket(
        configPda,
        "Will NVDA hit target?",
        "Tech oracle settle",
        3, // Tech category
        techFeed,
        new anchor.BN(150_00), // Target $150
        -2,
        0, // GreaterThan
        new anchor.BN(resolveTs),
        new anchor.BN(resolveTs)
      );

      const techMarketPda = result.marketPda;
      const yesMint = result.yesMintPda;
      const noMint = result.noMintPda;

      const b1YesAta = getAssociatedTokenAddressSync(yesMint, buyer1.publicKey);
      const b1NoAta = getAssociatedTokenAddressSync(noMint, buyer1.publicKey);
      const pos1 = getUserPositionPda(techMarketPda, buyer1.publicKey, program.programId);

      await program.methods
        .buyShares({ yes: {} } as any, new anchor.BN(5))
        .accounts({ buyer: buyer1.publicKey, market: techMarketPda, treasury: result.treasuryPda, yesMint, noMint, buyerYesAta: b1YesAta, buyerNoAta: b1NoAta, userPosition: pos1 } as any)
        .signers([buyer1])
        .rpc();

      await ensureTimePassed(resolveTs);

      const mockPayer = Keypair.generate();
      await fundAccount(mockPayer.publicKey, 1);
      const mockPda = getMockPriceUpdatePda(mockPayer.publicKey, program.programId);

      await program.methods
        .mockCreatePriceUpdate(techFeed, new anchor.BN(160_00), new anchor.BN(1), -2, new anchor.BN(now))
        .accounts({ payer: mockPayer.publicKey, priceUpdate: mockPda } as any)
        .signers([mockPayer])
        .rpc();

      await program.methods
        .settleMarket()
        .accounts({
          market: techMarketPda,
          config: configPda,
          priceUpdate: mockPda,
        } as any)
        .rpc();

      const acc = await program.account.market.fetch(techMarketPda);
      expect(acc.status).to.deep.equal({ settled: {} });
      expect(acc.winningOutcome).to.deep.equal({ yes: {} });
    });
  });


  describe("Phase 5: claim_rewards, cancel_market, claim_refund, withdraw_fees", () => {
    let configPda2: PublicKey;
    let marketPda: PublicKey;
    let yesMintPda: PublicKey;
    let noMintPda: PublicKey;
    let treasuryPda: PublicKey;
    let mockPriceUpdatePda: PublicKey;
    let feedId = Array(32).fill(0);
    feedId[0] = 77; // Unique feed ID
    let resolveTsVal: number;

    before(async () => {
      try {
        // Setup config & market for Phase 5 tests (reuse Phase 2 config singleton)
        let slot = await connection.getSlot();
        let blockTime = await connection.getBlockTime(slot);
        const now = blockTime ? blockTime : Math.floor(Date.now() / 1000);
        resolveTsVal = now + 6;

        const result = await bootstrapMarket(
          configPda, // Reuse existing configPda
          "Fresh Market?",
          "Claim rewards test",
          0,
          feedId,
          new anchor.BN(150_00), // Target $150 (2 decimals)
          -2,
          0,
          new anchor.BN(now + 5), // endTs
          new anchor.BN(now + 6)  // resolveTs
        );
        marketPda = result.marketPda;
        yesMintPda = result.yesMintPda;
        noMintPda = result.noMintPda;
        treasuryPda = result.treasuryPda;

        mockPriceUpdatePda = getMockPriceUpdatePda(admin.publicKey, program.programId);

        // Buyer1 buys 30 YES shares
        const buyerYesAta1 = getAssociatedTokenAddressSync(yesMintPda, buyer1.publicKey);
        const buyerNoAta1 = getAssociatedTokenAddressSync(noMintPda, buyer1.publicKey);
        const positionPda1 = getUserPositionPda(marketPda, buyer1.publicKey, program.programId);
        
        await program.methods
          .buyShares({ yes: {} } as any, new anchor.BN(30))
          .accounts({
            buyer: buyer1.publicKey,
            market: marketPda,
            treasury: treasuryPda,
            yesMint: yesMintPda,
            noMint: noMintPda,
            buyerYesAta: buyerYesAta1,
            buyerNoAta: buyerNoAta1,
            userPosition: positionPda1,
          } as any)
          .signers([buyer1])
          .rpc();

        // Buyer2 buys 20 YES shares
        const buyerYesAta2 = getAssociatedTokenAddressSync(yesMintPda, buyer2.publicKey);
        const buyerNoAta2 = getAssociatedTokenAddressSync(noMintPda, buyer2.publicKey);
        const positionPda2 = getUserPositionPda(marketPda, buyer2.publicKey, program.programId);
        
        await program.methods
          .buyShares({ yes: {} } as any, new anchor.BN(20))
          .accounts({
            buyer: buyer2.publicKey,
            market: marketPda,
            treasury: treasuryPda,
            yesMint: yesMintPda,
            noMint: noMintPda,
            buyerYesAta: buyerYesAta2,
            buyerNoAta: buyerNoAta2,
            userPosition: positionPda2,
          } as any)
          .signers([buyer2])
          .rpc();

        // Settle market where NO wins
        await ensureTimePassed(resolveTsVal);

        slot = await connection.getSlot();
        blockTime = await connection.getBlockTime(slot);
        const nowTime = blockTime ? blockTime : Math.floor(Date.now() / 1000);
        const rightTime = new anchor.BN(nowTime);
        const mockPayer = Keypair.generate();
        await fundAccount(mockPayer.publicKey, 1);
        const currentMockPda = getMockPriceUpdatePda(mockPayer.publicKey, program.programId);
        mockPriceUpdatePda = currentMockPda;

        // Oracle price = $140, so YES fails target $150 (i.e. NO wins)
        await program.methods
          .mockCreatePriceUpdate(
            feedId,
            new anchor.BN(140),
            new anchor.BN(0),
            0,
            rightTime
          )
          .accounts({
            payer: mockPayer.publicKey,
            priceUpdate: currentMockPda,
          } as any)
          .signers([mockPayer])
          .rpc();
      } catch (err: any) {
        console.error("PHASE 5 BEFORE HOOK ERROR:", err);
        if (err.logs) {
          console.error("ERROR LOGS:", err.logs);
        }
        throw err;
      }
    });

    it("Auto-cancels if the winning side has zero supply (One-Sided Market check)", async () => {
      await program.methods
        .settleMarket()
        .accounts({
          market: marketPda,
          config: configPda,
          priceUpdate: mockPriceUpdatePda,
        } as any)
        .rpc();

      const marketAccount = await program.account.market.fetch(marketPda);
      expect(marketAccount.status).to.deep.equal({ cancelled: {} });
      expect(marketAccount.totalPayoutPool.toNumber()).to.equal(0);
    });

    it("Losers claim a full refund on cancelled market successfully", async () => {
      const claimer = buyer1;
      const claimerYesAta = getAssociatedTokenAddressSync(yesMintPda, claimer.publicKey);
      const claimerNoAta = getAssociatedTokenAddressSync(noMintPda, claimer.publicKey);
      const positionPda = getUserPositionPda(marketPda, claimer.publicKey, program.programId);

      const beforeBalance = await connection.getBalance(claimer.publicKey);

      await program.methods
        .claimRefund()
        .accounts({
          claimer: claimer.publicKey,
          market: marketPda,
          treasury: treasuryPda,
          yesMint: yesMintPda,
          noMint: noMintPda,
          claimerYesAta: claimerYesAta,
          claimerNoAta: claimerNoAta,
          userPosition: positionPda,
        } as any)
        .signers([claimer])
        .rpc();

      const afterBalance = await connection.getBalance(claimer.publicKey);
      const positionAccount = await program.account.userPosition.fetch(positionPda);

      expect(positionAccount.claimed).to.be.true;
      
      // Refund should be exact original spent (30 shares * 0.01 SOL = 300_000_000 lamports)
      // Balance difference = refund - tx fee, so it should be very close to 0.3 SOL
      expect(afterBalance - beforeBalance).to.be.greaterThan(299_000_000);
    });

    it("Withdraw fees fails if market is not settled (it was cancelled)", async () => {
      try {
        await program.methods
          .withdrawFees()
          .accounts({
            admin: admin.publicKey,
            config: configPda, // Use configPda instead of configPda2
            market: marketPda,
            treasury: treasuryPda,
          } as any)
          .signers([admin])
          .rpc();
        expect.fail("Should have failed with MarketNotSettled");
      } catch (err: any) {
        expect(err.message).to.include("MarketNotSettled");
      }
    });
  });

  describe("Phase 6: Fractional Refund Math bug validation", () => {
    let localMarketPda: PublicKey;
    let localYesMintPda: PublicKey;
    let localNoMintPda: PublicKey;
    let localTreasuryPda: PublicKey;
    let buyer = Keypair.generate();
    let recipient = Keypair.generate();

    before(async () => {
      await fundAccount(buyer.publicKey, 10);
      await fundAccount(recipient.publicKey, 5); // Fund for buying share + gas

      // Bootstrap a new market
      const res = await bootstrapMarket(
        configPda,
        "Will BTC exceed $100k for fractional test?",
        "Oracle mock",
        0,
        Array(32).fill(7), // feed ID
        new anchor.BN(100000 * 100000000),
        -8,
        0,
        new anchor.BN(Math.floor(Date.now() / 1000) + 120),
        new anchor.BN(Math.floor(Date.now() / 1000) + 120),
        new anchor.BN(10_000_000) // 0.01 SOL per share
      );

      localMarketPda = res.marketPda;
      localYesMintPda = res.yesMintPda;
      localNoMintPda = res.noMintPda;
      localTreasuryPda = res.treasuryPda;
    });

    it("Buys 2 full YES shares, transfers 1.5 YES shares to recipient, cancels market, and refunds recipient exactly 2.5 * share_price SOL", async () => {
      const buyerYesAta = getAssociatedTokenAddressSync(localYesMintPda, buyer.publicKey);
      const buyerNoAta = getAssociatedTokenAddressSync(localNoMintPda, buyer.publicKey);
      const buyerPositionPda = getUserPositionPda(localMarketPda, buyer.publicKey, program.programId);

      const recipientYesAta = getAssociatedTokenAddressSync(localYesMintPda, recipient.publicKey);
      const recipientNoAta = getAssociatedTokenAddressSync(localNoMintPda, recipient.publicKey);
      const recipientPositionPda = getUserPositionPda(localMarketPda, recipient.publicKey, program.programId);

      // 1. Recipient buys 1 NO share to initialize their position PDA and ATAs
      await program.methods
        .buyShares({ no: {} } as any, new anchor.BN(1))
        .accounts({
          buyer: recipient.publicKey,
          market: localMarketPda,
          treasury: localTreasuryPda,
          yesMint: localYesMintPda,
          noMint: localNoMintPda,
          buyerYesAta: recipientYesAta,
          buyerNoAta: recipientNoAta,
          userPosition: recipientPositionPda,
        } as any)
        .signers([recipient])
        .rpc();

      // 2. Buyer buys 2 YES shares
      await program.methods
        .buyShares({ yes: {} } as any, new anchor.BN(2))
        .accounts({
          buyer: buyer.publicKey,
          market: localMarketPda,
          treasury: localTreasuryPda,
          yesMint: localYesMintPda,
          noMint: localNoMintPda,
          buyerYesAta,
          buyerNoAta,
          userPosition: buyerPositionPda,
        } as any)
        .signers([buyer])
        .rpc();

      // 3. Buyer transfers 1.5 YES shares (1,500,000 base units) to recipient
      const tx = new anchor.web3.Transaction().add(
        createTransferInstruction(
          buyerYesAta,
          recipientYesAta,
          buyer.publicKey,
          1_500_000
        )
      );

      await anchor.web3.sendAndConfirmTransaction(connection, tx, [buyer]);

      // 4. Admin cancels the market
      await program.methods
        .cancelMarket()
        .accounts({
          admin: admin.publicKey,
          config: configPda,
          market: localMarketPda,
        } as any)
        .signers([admin])
        .rpc();

      // 5. Recipient claims refund
      const beforeBalance = await connection.getBalance(recipient.publicKey);

      await program.methods
        .claimRefund()
        .accounts({
          claimer: recipient.publicKey,
          market: localMarketPda,
          treasury: localTreasuryPda,
          yesMint: localYesMintPda,
          noMint: localNoMintPda,
          claimerYesAta: recipientYesAta,
          claimerNoAta: recipientNoAta,
          userPosition: recipientPositionPda,
        } as any)
        .signers([recipient])
        .rpc();

      const afterBalance = await connection.getBalance(recipient.publicKey);

      // Refund should be exact original spent (2.5 shares * 0.01 SOL = 25,000,000 lamports)
      // Balance difference = refund - tx fee, so it should be very close to 0.025 SOL
      expect(afterBalance - beforeBalance).to.be.greaterThan(24_900_000);
    });
  });
});
