import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  Connection,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  TokenAccountNotFoundError,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";
import { getEmergencyPausePda, getOrderEscrowPda, getOrderPda } from "../app/src/lib/pda";

const RPC_URL = process.env.RPC_URL || "http://127.0.0.1:8899";
const connection = new Connection(RPC_URL, "confirmed");

const idlPath = path.join(__dirname, "../app/src/lib/idl/solpredict.json");
if (!fs.existsSync(idlPath)) {
  console.error("IDL not found at", idlPath);
  process.exit(1);
}
const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
const programId = new PublicKey(idl.address || idl.metadata?.address);

// 5 deterministic bot wallets
const NUM_TRADERS = 5;
const traders: Keypair[] = Array.from({ length: NUM_TRADERS }, (_, i) => {
  const seed = Buffer.alloc(32);
  seed.write(`solpredict_bot_trader_${i + 1}`);
  return Keypair.fromSeed(seed);
});

// ── helpers ──────────────────────────────────────────────────────────────────

function isOpen(statusOrObj: any): boolean {
  if (!statusOrObj) return false;
  if (typeof statusOrObj === "object") return "open" in statusOrObj;
  return statusOrObj === 0;
}

function isOrderOpen(order: any): boolean {
  const s = order.status;
  if (!s) return false;
  if (typeof s === "object") return "open" in s;
  return s === 0;
}

async function ensureAirdrop(pubkey: PublicKey, label: string) {
  try {
    const bal = await connection.getBalance(pubkey);
    if (bal < 1 * LAMPORTS_PER_SOL) {
      process.stdout.write(`  💰 Funding ${label}... `);
      try {
        const sig = await connection.requestAirdrop(pubkey, 2 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(sig, "confirmed");
        console.log("✓ (airdrop)");
      } catch (airdropErr) {
        // Fallback: Transfer from local wallet if airdrop rate limited/internal error
        try {
          const defaultWalletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
          if (fs.existsSync(defaultWalletPath)) {
            const secret = JSON.parse(fs.readFileSync(defaultWalletPath, "utf8"));
            const adminPayer = Keypair.fromSecretKey(Uint8Array.from(secret));
            const tx = new anchor.web3.Transaction().add(
              anchor.web3.SystemProgram.transfer({
                fromPubkey: adminPayer.publicKey,
                toPubkey: pubkey,
                lamports: 2 * LAMPORTS_PER_SOL,
              })
            );
            await anchor.web3.sendAndConfirmTransaction(connection, tx, [adminPayer]);
            console.log("✓ (faucet transfer)");
          }
        } catch (transferErr: any) {
          console.warn(`⚠ Funding failed: ${transferErr.message?.slice(0, 60)}`);
        }
      }
    } else {
      console.log(`  ✓  ${label}: ${(bal / LAMPORTS_PER_SOL).toFixed(2)} SOL`);
    }
  } catch (e: any) {
    console.warn(`  ⚠ Funding check failed for ${label}: ${e.message?.slice(0, 60)}`);
  }
}

/** Return SPL token balance (in base units) or null if ATA missing */
async function getTokenBalance(
  mint: PublicKey,
  owner: PublicKey
): Promise<bigint | null> {
  try {
    const ata = getAssociatedTokenAddressSync(mint, owner);
    const acc = await getAccount(connection, ata);
    return acc.amount;
  } catch (e) {
    if (e instanceof TokenAccountNotFoundError) return null;
    return null;
  }
}

async function syncTradeToNeon(
  signature: string,
  marketPubkey: string,
  trader: string,
  side: "YES" | "NO",
  qty: number,
  isBuy: boolean
) {
  try {
    // The sync API verifies the on-chain transaction before recording, so the
    // REAL tx signature is mandatory — client-reported amounts are discarded.
    await fetch("http://localhost:3000/api/sync/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature,
        marketPubkey,
        trader,
        side,
        lamportsIn: isBuy ? qty * 10_000_000 : 0,
        tokensOut: qty * 1_000_000,
      }),
    });
  } catch {}
}

async function syncMarketToNeon(marketPubkey: string, question: string) {
  try {
    await fetch("http://localhost:3000/api/sync/market", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketPubkey,
        marketId: 0,
        question,
        description: "Auto-synced prediction market",
        category: "Crypto",
        status: "open",
        yesPoolSol: 0,
        noPoolSol: 0,
      }),
    });
  } catch {}
}

// ── create a fresh market if needed ─────────────────────────────────────────

async function ensureFreshMarket(
  program: Program<any>,
  admin: Keypair
): Promise<{ marketPda: PublicKey; market: any } | null> {
  // Check existing open markets first
  const all = await (program.account as any).market.all();
  const open = all.filter((m: any) => isOpen(m.account.status));

  if (open.length > 0) {
    const chosen = open[0];
    const endTs = chosen.account.endTs.toNumber();
    const now = Math.floor(Date.now() / 1000);
    if (endTs > now) {
      console.log(`  ✓ Using existing market #${chosen.account.marketId} (expires in ${Math.round((endTs - now) / 60)} min)`);
      return { marketPda: chosen.publicKey, market: chosen.account };
    }
  }

  // Need to create a new one
  console.log("  ⚡ No valid open markets — creating a fresh one...");

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  );

  // Init config if needed
  try {
    await (program.account as any).config.fetch(configPda);
  } catch {
    await program.methods
      .initializeConfig(500)
      .accounts({ admin: admin.publicKey, config: configPda } as any)
      .rpc();
    console.log("  ✓ Config initialized");
  }

  const configAcc = await (program.account as any).config.fetch(configPda) as any;
  const marketId = configAcc.marketCount;
  const marketIdBuf = marketId.toArrayLike(Buffer, "le", 8);

  const [marketPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), marketIdBuf],
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

  const now = Math.floor(Date.now() / 1000);
  const endTs = now + 3600;       // 1 hour
  const resolveTs = now + 5400;   // 1.5 hours

  const feedId = Buffer.alloc(32);
  feedId.write("sol_usd_mock_feed_id_for_test___");

  await program.methods
    .initializeMarket(
      "Will SOL exceed $200.00 in the next 1 hour?",
      "Simulation test market. Resolves YES if SOL/USD > $200 at resolution time.",
      0,
      Array.from(feedId),
      new anchor.BN(20000),
      -2,
      0,
      new anchor.BN(endTs),
      new anchor.BN(resolveTs),
      new anchor.BN(0.01 * LAMPORTS_PER_SOL)
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

  const market = await (program.account as any).market.fetch(marketPda);
  await syncMarketToNeon(marketPda.toBase58(), "Will SOL exceed $200.00 in the next 1 hour?");
  console.log(`  ✅ Created Market #${marketId.toNumber()} — expires in 60 min`);
  return { marketPda, market };
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  🤖 SolPredict — Polymarket Automated Trading Simulator  ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  RPC: ${RPC_URL}  |  Program: ${programId.toBase58()}`);
  console.log("──────────────────────────────────────────────────────────");

  // Admin wallet (needed to create markets)
  let adminWallet: anchor.Wallet;
  const defaultWalletPath = path.join(process.env.HOME || "", ".config/solana/id.json");
  if (process.env.ANCHOR_WALLET && fs.existsSync(process.env.ANCHOR_WALLET)) {
    adminWallet = anchor.Wallet.local();
  } else if (fs.existsSync(defaultWalletPath)) {
    const secret = JSON.parse(fs.readFileSync(defaultWalletPath, "utf8"));
    adminWallet = new anchor.Wallet(Keypair.fromSecretKey(Uint8Array.from(secret)));
  } else {
    adminWallet = new anchor.Wallet(Keypair.generate());
  }
  const adminKeypair = adminWallet.payer;
  const provider = new anchor.AnchorProvider(connection, adminWallet, {
    commitment: "confirmed",
  });
  const program = new Program(idl, provider) as any;

  // Fund bots
  console.log("\n[Phase 1] Funding bot wallets...");
  await ensureAirdrop(adminKeypair.publicKey, "Admin");
  for (let i = 0; i < NUM_TRADERS; i++) {
    await ensureAirdrop(traders[i].publicKey, `Bot_${i + 1}`);
  }

  // Ensure open market
  console.log("\n[Phase 2] Verifying open markets...");
  const mktInfo = await ensureFreshMarket(program, adminKeypair);
  if (!mktInfo) {
    console.error("  ❌ Failed to get or create a market");
    process.exit(1);
  }
  let { marketPda } = mktInfo;

  console.log("\n[Phase 3] Starting live trading simulation...");
  console.log("  Press Ctrl+C to stop.\n");

  let step = 0;
  let wins = 0;
  let errs = 0;

  while (true) {
    step++;

    // Refresh market data every 15 steps
    if (step % 15 === 1) {
      const fresh = await ensureFreshMarket(program, adminKeypair);
      if (fresh) marketPda = fresh.marketPda;
    }

    // Fetch current market state
    let marketAcc: any;
    try {
      marketAcc = await (program.account as any).market.fetch(marketPda);
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    if (!isOpen(marketAcc.status)) {
      console.log("  ⏸  Market closed. Checking for open markets...");
      const fresh = await ensureFreshMarket(program, adminKeypair);
      if (fresh) marketPda = fresh.marketPda;
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    const endTs = marketAcc.endTs.toNumber();
    const now = Math.floor(Date.now() / 1000);
    if (now >= endTs) {
      console.log("  ⏰ Market expired. Creating new one...");
      const fresh = await ensureFreshMarket(program, adminKeypair);
      if (fresh) marketPda = fresh.marketPda;
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    // Pick random bot
    const botIdx = Math.floor(Math.random() * NUM_TRADERS);
    const botKP = traders[botIdx];
    const botPub = botKP.publicKey;
    const botName = `Bot_${botIdx + 1}`;

    const botWallet = new anchor.Wallet(botKP);
    const botProvider = new anchor.AnchorProvider(connection, botWallet, {
      commitment: "confirmed",
    });
    const botProgram = new Program(idl, botProvider) as any;

    // Derive common PDAs
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
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), botPub.toBuffer()],
      programId
    );

    const botYesAta = getAssociatedTokenAddressSync(yesMintPda, botPub);
    const botNoAta = getAssociatedTokenAddressSync(noMintPda, botPub);

    // Probability display
    const yesPool = marketAcc.yesPoolLamports?.toNumber?.() ?? 0;
    const noPool = marketAcc.noPoolLamports?.toNumber?.() ?? 0;
    const totalPool = yesPool + noPool;
    const yesProb = totalPool > 0 ? Math.round((yesPool / totalPool) * 100) : 50;

    // Weighted random action:
    // 0–54  → AMM Buy (55%)  — builds liquidity
    // 55–74 → Limit Bid (20%)
    // 75–89 → AMM Sell (15%) — only if bot has shares
    // 90–99 → P2P Fill (10%) — only if matching open orders exist
    const roll = Math.floor(Math.random() * 100);
    const sideParam = Math.random() > 0.5 ? { yes: {} } : { no: {} };
    const sideStr = "yes" in sideParam ? "YES" : "NO";
    const qty = Math.floor(Math.random() * 20) + 5;

    try {
      if (roll < 55) {
        // ── AMM Buy ──────────────────────────────────────────────────────
        console.log(
          `  [${step}] [${botName}] 📈 BUY ${qty} ${sideStr}` +
          `  │ YES: ${yesProb}%  NO: ${100 - yesProb}%  Pool: ${(totalPool / LAMPORTS_PER_SOL).toFixed(3)} SOL`
        );
        const buySig = await botProgram.methods
          .buyShares(sideParam, new anchor.BN(qty), new anchor.BN(5_000_000_000))
          .accounts({
            buyer: botPub,
            market: marketPda,
            treasury: treasuryPda,
            yesMint: yesMintPda,
            noMint: noMintPda,
            buyerYesAta: botYesAta,
            buyerNoAta: botNoAta,
            userPosition: positionPda,
            emergencyPause: getEmergencyPausePda(programId),
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          } as any)
          .rpc();
        await syncTradeToNeon(buySig, marketPda.toBase58(), botPub.toBase58(), sideStr as "YES" | "NO", qty, true);
        wins++;

      } else if (roll < 75) {
        // ── Limit Buy Bid (always buy side so we don't need tokens) ──────
        const priceBps = Math.floor(Math.random() * 3000) + 3500; // 0.35–0.65
        const limitQty = Math.floor(Math.random() * 8) + 2;
        const orderId = new anchor.BN(Date.now() % 1_000_000_000 + Math.floor(Math.random() * 99999));
        const orderPda = getOrderPda(marketPda, botPub, orderId, programId);
        const orderEscrowPda = getOrderEscrowPda(marketPda, botPub, orderId, programId);
        const chosenMint = "yes" in sideParam ? yesMintPda : noMintPda;
        const makerTokenAta = getAssociatedTokenAddressSync(chosenMint, botPub);
        const orderTokenEscrow = getAssociatedTokenAddressSync(chosenMint, orderPda, true);

        console.log(
          `  [${step}] [${botName}] 📊 LIMIT BID ${limitQty} ${sideStr} @ ${(priceBps / 10000).toFixed(2)} SOL`
        );
        await botProgram.methods
          .placeOrder(orderId, sideParam, true, new anchor.BN(priceBps), new anchor.BN(limitQty))
          .accounts({
            maker: botPub,
            market: marketPda,
            order: orderPda,
            makerTokenAta,
            orderTokenEscrow,
            orderEscrow: orderEscrowPda,
            emergencyPause: getEmergencyPausePda(programId),
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            systemProgram: anchor.web3.SystemProgram.programId,
          } as any)
          .rpc();
        wins++;

      } else if (roll < 90) {
        // ── AMM Sell — ONLY if bot actually has the tokens ───────────────
        const mint = "yes" in sideParam ? yesMintPda : noMintPda;
        const balance = await getTokenBalance(mint, botPub);

        if (balance === null || Number(balance) === 0) {
          // No tokens — do a buy instead
          console.log(`  [${step}] [${botName}] 📈 BUY ${qty} ${sideStr} (no ${sideStr} tokens for sell)`);
          await botProgram.methods
            .buyShares(sideParam, new anchor.BN(qty), new anchor.BN(5_000_000_000))
            .accounts({
              buyer: botPub,
              market: marketPda,
              treasury: treasuryPda,
              yesMint: yesMintPda,
              noMint: noMintPda,
              buyerYesAta: botYesAta,
              buyerNoAta: botNoAta,
              userPosition: positionPda,
              emergencyPause: getEmergencyPausePda(programId),
              tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
              associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
              systemProgram: anchor.web3.SystemProgram.programId,
            } as any)
            .rpc();
          wins++;
        } else {
          // Convert balance to shares (balance is in base units = shares * 1e6)
          const maxShares = Math.floor(Number(balance) / 1_000_000);
          const sellQty = Math.min(qty, maxShares, 5); // sell at most 5 at a time
          if (sellQty > 0) {
            console.log(`  [${step}] [${botName}] 📉 SELL ${sellQty} ${sideStr} (have ${maxShares} shares)`);
            const sellSig = await botProgram.methods
              .sellShares(sideParam, new anchor.BN(sellQty), new anchor.BN(0))
              .accounts({
                seller: botPub,
                market: marketPda,
                treasury: treasuryPda,
                yesMint: yesMintPda,
                noMint: noMintPda,
                sellerYesAta: botYesAta,
                sellerNoAta: botNoAta,
                userPosition: positionPda,
                emergencyPause: getEmergencyPausePda(programId),
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId,
              } as any)
              .rpc();
            await syncTradeToNeon(
              sellSig,
              marketPda.toBase58(),
              botPub.toBase58(),
              sideStr as "YES" | "NO",
              sellQty,
              false
            );
            wins++;
          }
        }

      } else {
        // ── P2P Fill — only buy-type orders (maker has SOL in escrow, taker gives tokens) ──
        const allOrders = await (program.account as any).order.all();
        // Only fill BUY orders where maker wants tokens and will pay SOL
        // Taker sends tokens, receives SOL
        const fillable = allOrders.filter((o: any) => {
          const acc = o.account;
          if (!acc.market.equals(marketPda)) return false;
          if (acc.maker.equals(botPub)) return false; // can't fill own order
          if (!isOrderOpen(acc)) return false;
          if (!acc.isBuy) return false; // only fill BUY orders (taker provides tokens)
          return true;
        });

        if (fillable.length > 0) {
          const target = fillable[Math.floor(Math.random() * fillable.length)];
          const ord = target.account;
          const orderSide = (typeof ord.side === "object" && "yes" in ord.side) ? "YES" : "NO";
          const mint = orderSide === "YES" ? yesMintPda : noMintPda;

          // Check if taker has enough tokens
          const takerBalance = await getTokenBalance(mint, botPub);
          const remaining = ord.quantity.toNumber() - ord.filledQuantity.toNumber();
          const fillQty = Math.min(3, remaining);

          if (takerBalance !== null && Number(takerBalance) >= fillQty * 1_000_000 && fillQty > 0) {
            try {
              console.log(
                `  [${step}] [${botName}] ⚡ P2P FILL ${fillQty} ${orderSide} from ${ord.maker.toBase58().slice(0, 6)}...`
              );
              const takerTokenAta = getAssociatedTokenAddressSync(mint, botPub);
              const makerTokenAta = getAssociatedTokenAddressSync(mint, ord.maker);
              const orderTokenEscrow = getAssociatedTokenAddressSync(mint, target.publicKey, true);

              await botProgram.methods
                .fillOrder(new anchor.BN(fillQty))
                .accounts({
                  taker: botPub,
                  maker: ord.maker,
                  market: marketPda,
                  order: target.publicKey,
                  takerTokenAta,
                  makerTokenAta,
                  orderTokenEscrow,
                  emergencyPause: getEmergencyPausePda(programId),
                  tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                  systemProgram: anchor.web3.SystemProgram.programId,
                } as any)
                .rpc();
              wins++;
            } catch {
              // Fallback to AMM Buy if order fill failed
              console.log(`  [${step}] [${botName}] 📈 BUY ${qty} ${sideStr} (fallback)`);
              await botProgram.methods
                .buyShares(sideParam, new anchor.BN(qty), new anchor.BN(5_000_000_000))
                .accounts({
                  buyer: botPub,
                  market: marketPda,
                  treasury: treasuryPda,
                  yesMint: yesMintPda,
                  noMint: noMintPda,
                  buyerYesAta: botYesAta,
                  buyerNoAta: botNoAta,
                  userPosition: positionPda,
                  emergencyPause: getEmergencyPausePda(programId),
                  tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                  associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
                  systemProgram: anchor.web3.SystemProgram.programId,
                } as any)
                .rpc();
              wins++;
            }
          } else {
            // Fall back to buy
            console.log(`  [${step}] [${botName}] 📈 BUY ${qty} ${sideStr} (no tokens for P2P fill)`);
            await botProgram.methods
              .buyShares(sideParam, new anchor.BN(qty), new anchor.BN(5_000_000_000))
              .accounts({
                buyer: botPub,
                market: marketPda,
                treasury: treasuryPda,
                yesMint: yesMintPda,
                noMint: noMintPda,
                buyerYesAta: botYesAta,
                buyerNoAta: botNoAta,
                userPosition: positionPda,
                emergencyPause: getEmergencyPausePda(programId),
                tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
                associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
                systemProgram: anchor.web3.SystemProgram.programId,
              } as any)
              .rpc();
            wins++;
          }
        } else {
          // No fillable orders — just buy
          console.log(`  [${step}] [${botName}] 📈 BUY ${qty} ${sideStr} (no fillable orders)`);
          await botProgram.methods
            .buyShares(sideParam, new anchor.BN(qty), new anchor.BN(5_000_000_000))
            .accounts({
              buyer: botPub,
              market: marketPda,
              treasury: treasuryPda,
              yesMint: yesMintPda,
              noMint: noMintPda,
              buyerYesAta: botYesAta,
              buyerNoAta: botNoAta,
              userPosition: positionPda,
              emergencyPause: getEmergencyPausePda(programId),
              tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
              associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
              systemProgram: anchor.web3.SystemProgram.programId,
            } as any)
            .rpc();
          wins++;
        }
      }
    } catch (err: any) {
      errs++;
      const msg = err?.message || String(err);
      const short = msg.includes("AnchorError")
        ? msg.match(/Error Code: (\w+)/)?.[1] ?? msg.slice(0, 80)
        : msg.slice(0, 80);
      console.log(`  [${step}] [${botName}] ⚠ ${short}`);
    }

    if (step % 10 === 0) {
      console.log(`\n  ── Stats: ${wins}✓ / ${errs}✗ / ${step} total ──\n`);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
