/**
 * SolPredict on-chain indexer.
 *
 * Runs a continuous reconcile loop: pulls every initialized market account
 * via the RPC proxy and reduces it into the DB cache, then backfills recent
 * program transactions into the trades table. Every write goes through the
 * idempotent reducer (onConflictDoNothing / onConflictDoUpdate), so re-runs
 * converge and never duplicate.
 *
 * Usage:
 *   npx tsx src/workers/indexer.ts            # single pass
 *   npx tsx src/workers/indexer.ts --loop     # continuous
 *   npx tsx src/workers/indexer.ts --once --trades=50
 */
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, type Idl } from "@coral-xyz/anchor";
import { reconcileMarkets, reconcileTrades, reconcilePositions } from "@/lib/indexer/reconciler";
import { logger } from "@/lib/logger";
import type { Solpredict } from "@/lib/idl/solpredict";

const NEXT_PUBLIC_RPC = process.env.NEXT_PUBLIC_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "";
// Standalone workers run outside the Next.js dev server, so the app's own
// /api/rpc proxy (localhost:3000) is unavailable. Fall back to the local
// validator directly.
const RPC_URL =
  NEXT_PUBLIC_RPC.includes("localhost:3000") || NEXT_PUBLIC_RPC.includes("127.0.0.1:3000")
    ? process.env.LOCALNET_RPC_URL ?? "http://127.0.0.1:8899"
    : NEXT_PUBLIC_RPC || "https://api.devnet.solana.com";
const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID
  ?? "HVshSwptqBYKWM9MpZrA1bdP7zQ6RzJXVbr5PUR7wvtr";

interface Args {
  loop: boolean;
  intervalMs: number;
  marketsLimit: number;
  tradesPerPass: number;
  once: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    loop: false,
    intervalMs: 30_000,
    marketsLimit: 500,
    tradesPerPass: 20,
    once: false,
  };
  for (const a of argv) {
    if (a === "--loop") args.loop = true;
    if (a === "--once") args.once = true;
    const m = a.match(/^--interval=(\d+)$/); if (m) args.intervalMs = Number(m[1]);
    const n = a.match(/^--markets=(\d+)$/); if (n) args.marketsLimit = Number(n[1]);
    const t = a.match(/^--trades=(\d+)$/); if (t) args.tradesPerPass = Number(t[1]);
  }
  return args;
}

function buildProgram(): Program<Solpredict> | null {
  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const provider = new AnchorProvider(
      connection,
      new Wallet(Keypair.generate()),
      { commitment: "confirmed" },
    );
    const rawIdl = require("../lib/idl/solpredict.json") as Solpredict;
    const idl = { ...rawIdl, address: PROGRAM_ID };
    return new Program(idl as Idl, provider);
  } catch (e) {
    logger.error("[indexer] failed to build program:", e);
    return null;
  }
}

async function runPass(args: Args): Promise<void> {
  const connection = new Connection(RPC_URL, "confirmed");
  const program = buildProgram();
  if (!program) {
    logger.error("[indexer] no program — aborting pass");
    return;
  }

  const started = Date.now();
  const markets = await reconcileMarkets({ connection, program, limit: args.marketsLimit });
  const pos = await reconcilePositions({ connection, program });
  let cursor: string | null | undefined;
  let trades = pos.trades;
  for (let i = 0; i < 3 && args.tradesPerPass > 0; i++) {
    const res = await reconcileTrades({ connection, program, before: cursor ?? undefined, limit: args.tradesPerPass });
    trades += res.trades;
    if (!res.nextCursor) break;
    cursor = res.nextCursor;
  }

  logger.info(`[indexer] pass done: ${markets} markets, ${trades} trades in ${Date.now() - started}ms`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  logger.info(`[indexer] starting (rpc=${RPC_URL}, program=${PROGRAM_ID})`);
  await runPass(args);

  if (args.loop) {
    logger.info(`[indexer] continuous loop every ${args.intervalMs}ms`);
    setInterval(() => {
      runPass(args).catch((e) => logger.error("[indexer] loop error:", e));
    }, args.intervalMs);
  }
}

main().catch((e) => {
  logger.error("[indexer] fatal:", e);
  process.exit(1);
});
