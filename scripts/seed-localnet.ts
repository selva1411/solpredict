/**
 * Seed the deployed SolPredict program on localnet with realistic data.
 *
 * Creates 13 markets (7 open, 4 settled, 2 cancelled), simulates YES/NO
 * trades across several buyers, then settles/cancels the terminal markets.
 * Everything is real on-chain state — the indexer later reduces it into the DB.
 *
 * Run with:
 *   npx tsx scripts/seed-localnet.ts
 *
 * Requires: a running `solana-test-validator` with the program deployed at
 * `AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG`.
 */
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const IDL = JSON.parse(
  readFileSync(join(process.cwd(), "target/idl/solpredict.json"), "utf8")
);

const RPC = process.env.LOCALNET_RPC_URL ?? "http://127.0.0.1:8899";
const PROGRAM_ID = new PublicKey(
  "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG"
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function feedId(hex: string): number[] {
  const bytes = Buffer.from(hex.replace(/^0x/, ""), "hex");
  const arr: number[] = [];
  for (let i = 0; i < 32; i++) arr.push(bytes[i] ?? 0);
  return arr;
}

const FEED = {
  // Full 64-char Pyth feed IDs (verified live against Hermes on 2026-08-20).
  // The previous values were 63-char (one hex digit short), so feedId() padded
  // the last byte with 0x00 and produced mangled IDs that 404 on Hermes.
  SOL: feedId(
    "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
  ),
  BTC: feedId(
    "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
  ),
  ETH: feedId(
    "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"
  ),
};

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const secret = JSON.parse(
    readFileSync(join(homedir(), ".config/solana/id.json"), "utf8")
  );
  const wallet = new anchor.Wallet(
    Keypair.fromSecretKey(Uint8Array.from(secret))
  );
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = new anchor.Program(
    { ...(IDL as anchor.Idl), address: PROGRAM_ID.toBase58() } as anchor.Idl,
    provider
  );
  const pgm = program as any;
  const programId = PROGRAM_ID;

  console.log("Fee payer:", provider.wallet.publicKey.toBase58());
  console.log(
    "Balance:",
    (await connection.getBalance(provider.wallet.publicKey)) / LAMPORTS_PER_SOL,
    "SOL"
  );

  const getConfigPda = () =>
    PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0];
  const getMarketPda = (id: anchor.BN) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("market"), id.toArrayLike(Buffer, "le", 8)],
      programId
    )[0];
  const getMintPda = (seed: string, m: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from(seed), m.toBuffer()],
      programId
    )[0];
  const getTreasuryPda = (m: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("treasury"), m.toBuffer()],
      programId
    )[0];
  const getPositionPda = (m: PublicKey, u: PublicKey) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("position"), m.toBuffer(), u.toBuffer()],
      programId
    )[0];
  const emergencyPause = PublicKey.findProgramAddressSync(
    [Buffer.from("emergency_pause")],
    programId
  )[0];

  async function fund(pub: PublicKey, sol = 5) {
    const tx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: pub,
        lamports: sol * LAMPORTS_PER_SOL,
      })
    );
    await provider.sendAndConfirm(tx);
  }

  // Admin is the persisted CLI keypair (~/.config/solana/id.json, i.e.
  // 2zPRxY...), so the on-chain config admin is a wallet users can import and
  // the admin panel can actually execute on-chain ops. Do NOT generate a
  // throwaway admin here — its key material would be lost after the run.
  const admin = wallet.payer;
  const buyers = [0, 1, 2, 3, 4].map(() => Keypair.generate());

  await fund(admin.publicKey, 50);
  for (const b of buyers) await fund(b.publicKey, 50);

  const configPda = getConfigPda();
  const existingConfig = await connection.getAccountInfo(configPda);
  if (existingConfig) {
    console.log("[config] already initialized — skipping");
  } else {
    console.log("\n[config] initializeConfig fee=200");
    await pgm.methods
      .initializeConfig(new anchor.BN(200))
      .accounts({ admin: admin.publicKey, config: configPda })
      .signers([admin])
      .rpc();
  }

  // The emergency-pause account is required (as a key) by every trading IX and
  // must exist on-chain. Initialize it paused, then immediately unpause.
  const pauseAcct = await connection.getAccountInfo(emergencyPause);
  if (!pauseAcct) {
    console.log("[emergency_pause] initializing (paused)");
    await pgm.methods
      .emergencyPause()
      .accounts({
        admin: admin.publicKey,
        config: configPda,
        emergencyPause,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();
  }
  const pauseState: any = await program.account.emergencyPause
    .fetch(emergencyPause)
    .catch(() => null);
  if (pauseState && pauseState.paused) {
    console.log("[emergency_pause] unpausing");
    await pgm.methods
      .emergencyUnpause()
      .accounts({
        admin: admin.publicKey,
        config: configPda,
        emergencyPause,
        systemProgram: SystemProgram.programId,
      })
      .remainingAccounts([
        { pubkey: admin.publicKey, isSigner: true, isWritable: false },
      ])
      .signers([admin])
      .rpc();
  } else if (!pauseState) {
    console.warn("[emergency_pause] account still missing — trading may fail");
  }

  const NOW = Math.floor(Date.now() / 1000);
  const DAY = 24 * 3600;
  const SHARE = 10_000_000; // 0.01 SOL/share
  const FAST = process.argv.includes("--fast") || process.argv.includes("--skip-wait");

  interface MarketDef {
    cat: number;
    q: string;
    d: string;
    feed: number[];
    tp: number;
    cmp: number;
    end: number;
    res: number;
    st: "open" | "settle" | "cancel";
  }

  const defs: MarketDef[] = [
    {
      cat: 0,
      q: "Will SOL exceed $300 by 15 Aug 2026?",
      d: "Settles via Pyth SOL/USD price feed.",
      feed: FEED.SOL,
      tp: 300_00000000,
      cmp: 1,
      end: NOW + 90 * DAY,
      res: NOW + 90 * DAY,
      st: "open",
    },
    {
      cat: 0,
      q: "Will BTC close above $120,000 on 31 Aug 2026?",
      d: "Settles via Pyth BTC/USD.",
      feed: FEED.BTC,
      tp: 120000_00000000,
      cmp: 1,
      end: NOW + 100 * DAY,
      res: NOW + 100 * DAY,
      st: "open",
    },
    {
      cat: 0,
      q: "Will ETH stay below $5,000 until 30 Sep 2026?",
      d: "Settles via Pyth ETH/USD.",
      feed: FEED.ETH,
      tp: 5000_00000000,
      cmp: 0,
      end: NOW + 120 * DAY,
      res: NOW + 120 * DAY,
      st: "open",
    },
    {
      cat: 0,
      q: "Will SOL drop below $150 by 1 Oct 2026?",
      d: "Settles via Pyth SOL/USD.",
      feed: FEED.SOL,
      tp: 150_00000000,
      cmp: 0,
      end: NOW + 130 * DAY,
      res: NOW + 130 * DAY,
      st: "open",
    },
    {
      cat: 0,
      q: "Will SOL hit $400 before 30 Nov 2026?",
      d: "Settles via Pyth SOL/USD.",
      feed: FEED.SOL,
      tp: 400_00000000,
      cmp: 0,
      end: NOW + 116 * DAY,
      res: NOW + 116 * DAY,
      st: "open",
    },
    {
      cat: 0,
      q: "Will the memecoin marketcap double by 31 Dec 2026?",
      d: "Settles via Pyth SOL/USD.",
      feed: FEED.SOL,
      tp: 200_00000000,
      cmp: 0,
      end: NOW + 147 * DAY,
      res: NOW + 147 * DAY,
      st: "open",
    },
    {
      cat: 1,
      q: "Will Manchester United finish Top 4 in 2026-27?",
      d: "Admin-settled sports market.",
      feed: feedId("00"),
      tp: 0,
      cmp: 0,
      end: NOW + 300 * DAY,
      res: NOW + 320 * DAY,
      st: "open",
    },
    {
      cat: 1,
      q: "Will India win the T20 Cricket World Cup 2026?",
      d: "Settled — YES wins.",
      feed: feedId("00"),
      tp: 0,
      cmp: 0,
      end: FAST ? NOW - 120 : NOW + 180,
      res: FAST ? NOW - 60 : NOW + 240,
      st: "settle",
    },
    {
      cat: 2,
      q: "Will the EU finalize AI regulation by Jul 2026?",
      d: "Settled — NO wins.",
      feed: feedId("00"),
      tp: 0,
      cmp: 0,
      end: FAST ? NOW - 120 : NOW + 180,
      res: FAST ? NOW - 60 : NOW + 240,
      st: "settle",
    },
    {
      cat: 3,
      q: "Will OpenAI ship GPT-6 before 1 Aug 2026?",
      d: "Settled — YES wins.",
      feed: feedId("00"),
      tp: 0,
      cmp: 0,
      end: FAST ? NOW - 120 : NOW + 180,
      res: FAST ? NOW - 60 : NOW + 240,
      st: "settle",
    },
    {
      cat: 4,
      q: "Will 2026 set a new global temperature record?",
      d: "Settled — NO wins.",
      feed: feedId("00"),
      tp: 0,
      cmp: 0,
      end: FAST ? NOW - 120 : NOW + 180,
      res: FAST ? NOW - 60 : NOW + 240,
      st: "settle",
    },
    {
      cat: 1,
      q: "Will Real Madrid win the UCL 2026-27?",
      d: "Cancelled — refund issued.",
      feed: feedId("00"),
      tp: 0,
      cmp: 0,
      end: NOW + 300 * DAY,
      res: NOW + 320 * DAY,
      st: "cancel",
    },
    {
      cat: 2,
      q: "Will the US lower rates below 2.5% in 2026?",
      d: "Cancelled — no pool.",
      feed: feedId("00"),
      tp: 0,
      cmp: 0,
      end: NOW + 60 * DAY,
      res: NOW + 61 * DAY,
      st: "cancel",
    },
  ];

  const getNextMarketId = async () => {
    const cfg = await program.account.config.fetch(configPda);
    return cfg.marketCount;
  };

  const summary: {
    marketId: number;
    status: string;
    question: string;
    trades: number;
  }[] = [];

  for (const d of defs) {
    const marketId = await getNextMarketId();
    const marketPda = getMarketPda(marketId);
    const yesMint = getMintPda("yes_mint", marketPda);
    const noMint = getMintPda("no_mint", marketPda);
    const treasury = getTreasuryPda(marketPda);

    console.log(`\n[market#${marketId}] ${d.q} (${d.st})`);
    await pgm.methods
      .initializeMarket(
        d.q,
        d.d,
        d.cat,
        d.feed,
        new anchor.BN(d.tp),
        -8,
        d.cmp,
        new anchor.BN(d.end),
        new anchor.BN(d.res),
        new anchor.BN(SHARE)
      )
      .accounts({
        admin: admin.publicKey,
        config: configPda,
        market: marketPda,
        yesMint,
        noMint,
        treasury,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([admin])
      .rpc();

    let trades = 0;
    if (d.st === "settle") {
      for (let i = 0; i < 3; i++) {
        const buyer = buyers[i % buyers.length];
        const side = i % 2 === 0 ? { yes: {} } : { no: {} };
        const qty = new anchor.BN(100 + i * 50);
        const buyerYesAta = getAssociatedTokenAddressSync(
          yesMint,
          buyer.publicKey
        );
        const buyerNoAta = getAssociatedTokenAddressSync(
          noMint,
          buyer.publicKey
        );
        const pos = getPositionPda(marketPda, buyer.publicKey);
        await pgm.methods
          .buyShares(side, qty, new anchor.BN(5_000_000_000))
          .accounts({
            buyer: buyer.publicKey,
            market: marketPda,
            treasury,
            yesMint,
            noMint,
            buyerYesAta,
            buyerNoAta,
            emergencyPause,
            userPosition: pos,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();
        trades++;
      }
    } else if (d.st === "open") {
      for (let i = 0; i < 2; i++) {
        const buyer = buyers[(i + 1) % buyers.length];
        const side = i % 2 === 0 ? { yes: {} } : { no: {} };
        const qty = new anchor.BN(150 + i * 75);
        const buyerYesAta = getAssociatedTokenAddressSync(
          yesMint,
          buyer.publicKey
        );
        const buyerNoAta = getAssociatedTokenAddressSync(
          noMint,
          buyer.publicKey
        );
        const pos = getPositionPda(marketPda, buyer.publicKey);
        await pgm.methods
          .buyShares(side, qty, new anchor.BN(5_000_000_000))
          .accounts({
            buyer: buyer.publicKey,
            market: marketPda,
            treasury,
            yesMint,
            noMint,
            buyerYesAta,
            buyerNoAta,
            emergencyPause,
            userPosition: pos,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();
        trades++;
      }
    } else if (d.st === "cancel" && summary.length % 2 === 1) {
      const buyer = buyers[0];
      const qty = new anchor.BN(50);
      const buyerYesAta = getAssociatedTokenAddressSync(
        yesMint,
        buyer.publicKey
      );
      const buyerNoAta = getAssociatedTokenAddressSync(noMint, buyer.publicKey);
      const pos = getPositionPda(marketPda, buyer.publicKey);
      await pgm.methods
        .buyShares({ yes: {} }, qty, new anchor.BN(5_000_000_000))
        .accounts({
          buyer: buyer.publicKey,
          market: marketPda,
          treasury,
          yesMint,
          noMint,
          buyerYesAta,
          buyerNoAta,
          emergencyPause,
          userPosition: pos,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc();
      trades++;
    }

    summary.push({
      marketId: marketId.toNumber(),
      status: d.st,
      question: d.q,
      trades,
    });
  }

  console.table(summary);

  if (!FAST) {
    console.log("\nWaiting for settled markets' resolve_ts to pass…");
    const nowSec = () => Math.floor(Date.now() / 1000);
    for (const m of summary.filter((s) => s.status === "settle")) {
      const pda = getMarketPda(new anchor.BN(m.marketId));
      const acc: any = await program.account.market.fetch(pda);
      const res = acc.resolveTs.toNumber();
      while (nowSec() < res) {
        console.log(`  waiting #${m.marketId}: ${res - nowSec()}s to resolve`);
        await sleep(5000);
      }
    }
  }

  for (let i = 0; i < defs.length; i++) {
    const d = defs[i];
    const marketId = summary[i].marketId;
    const marketPda = getMarketPda(new anchor.BN(marketId));
    if (d.st === "settle") {
      const outcome = i % 2 === 1 ? 2 : 1;
      await pgm.methods
        .settleMarketManual(outcome)
        .accounts({
          admin: admin.publicKey,
          config: configPda,
          market: marketPda,
        })
        .signers([admin])
        .rpc();
      console.log(`  settled #${marketId} outcome=${outcome}`);
    } else if (d.st === "cancel") {
      await pgm.methods
        .cancelMarket("Listed by mistake")
        .accounts({
          admin: admin.publicKey,
          config: configPda,
          market: marketPda,
        })
        .signers([admin])
        .rpc();
      console.log(`  cancelled #${marketId}`);
    }
  }

  // Register the dad wallet (browser admin, e.g. dad8hr...) as a guardian and
  // transfer config.admin to it. The CLI keypair (still admin at this point)
  // signs both. After this, the dad wallet is BOTH admin AND guardian, so it can
  // pause/unpause from the admin UI (unpause requires a guardian signature, and
  // guardian[0] would otherwise stay the CLI keypair — which the browser can't
  // sign with).
  const dadWalletStr =
    process.env.ADMIN_WALLET ?? "dad8hrG9n3xoJcUVSZcVcoQQxbBhMS7CEypM2HR3wqf";
  const dadWallet = new PublicKey(dadWalletStr);
  await fund(dadWallet, 20);

  console.log(
    "\n[admin] registering dad wallet as guardian + transferring admin…"
  );
  await pgm.methods
    .addGuardian(dadWallet)
    .accounts({
      admin: admin.publicKey,
      config: configPda,
      emergencyPause,
      systemProgram: SystemProgram.programId,
    })
    .signers([admin])
    .rpc();
  console.log("  guardian added:", dadWallet.toBase58());

  await pgm.methods
    .updateAdmin(dadWallet)
    .accounts({ admin: admin.publicKey, config: configPda })
    .signers([admin])
    .rpc();
  console.log("  admin transferred to:", dadWallet.toBase58());

  const cfgFinal: any = await pgm.account.config.fetch(configPda);
  if (cfgFinal.admin.toBase58() !== dadWallet.toBase58()) {
    throw new Error(
      "admin transfer failed — config.admin is still " +
        cfgFinal.admin.toBase58()
    );
  }

  console.log(
    "\nDone. Run `npm run indexer` (with app/.env.local) to populate the DB."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
