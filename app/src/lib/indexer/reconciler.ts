import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, type IdlAccounts } from "@coral-xyz/anchor";
import { getDb } from "@/lib/db/client";
import { getConfigPda, getMarketPda } from "@/lib/pda";
import { decodeMarket } from "@/lib/idl/decoders";
import { applyEvent } from "@/lib/indexer/reducer";
import { logger } from "@/lib/logger";
import type { Solpredict } from "@/lib/idl/solpredict";

/**
 * Reducer writes are idempotent (upserts / onConflictDoNothing), so a single
 * retry is always safe. Neon's serverless compute occasionally hiccups
 * mid-session (observed once per ~10k ops); without this the affected market
 * would silently skip a sync pass until the next loop.
 */
async function applyEventSafe(ev: Parameters<typeof import("./reducer").applyEvent>[0]): Promise<void> {
  try {
    await applyEvent(ev);
  } catch {
    await new Promise((r) => setTimeout(r, 500));
    await applyEvent(ev);
  }
}


type MarketAccount = IdlAccounts<Solpredict>["market"];
type ConfigAccount = IdlAccounts<Solpredict>["config"];

const CATEGORY_NAMES = ["Crypto", "Sports", "Politics", "Tech", "Other"] as const;
const STATUS_NAMES = ["open", "settled", "cancelled"] as const;
const OUTCOME_NAMES = ["unset", "yes", "no"] as const;

interface ReconcileOptions {
  connection: Connection;
  program: Program<Solpredict>;
  limit?: number;
}

function toLamports(value: number): number {
  return Math.floor(value);
}

/**
 * Convert a BN (u64) lamport value to a JS number at the DB boundary.
 *
 * Solana u64 values can exceed Number.MAX_SAFE_INTEGER (2^53 — the max safe
 * integer) for pools/supply above ~9e15 lamports. `BN.toNumber()` silently
 * corrupts those values, so we detect precision loss and fail loud instead of
 * persisting wrong numbers (rule: never trust Number() on u64/lamport values).
 *
 * Practical note: real market pools stay far below this threshold, so this is
 * a guard, not a hot path.
 */
function bnToNumber(v: unknown): number {
  let num: number;
  if (typeof v === "object" && v !== null && "toNumber" in (v as Record<string, unknown>)) {
    const bn = v as { toString(base?: number): string; toNumber(): number };
    const str = bn.toString(10);
    if (str.length > 15) {
      // > 9e15 lamports — precision is at risk. Fail loud rather than store a
      // corrupted value; callers with genuine u64 overflow must switch the
      // boundary to bigint/string.
      const parsed = BigInt(str);
      if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new Error(`bnToNumber: u64 value ${str} exceeds Number.MAX_SAFE_INTEGER`);
      }
    }
    num = bn.toNumber();
  } else {
    num = Number(v ?? 0);
  }
  if (num !== 0 && !Number.isSafeInteger(num)) {
    throw new Error(`bnToNumber: value ${num} is not a safe integer`);
  }
  return num;
}

/**
 * Pull every market PDA the program has initialized, decode the Anchor
 * account, and reduce it into the DB cache. Idempotent: reruns converge.
 */
export async function reconcileMarkets({ connection, program, limit = 500 }: ReconcileOptions): Promise<number> {
  if (!getDb()) return 0;

  const configPda = getConfigPda(program.programId);
  let nextMarketId = 0;

  try {
    const configAcct = await program.account.config.fetchNullable(configPda) as ConfigAccount | null;
    if (configAcct) {
      nextMarketId = bnToNumber((configAcct as Record<string, unknown>).marketCount);
    }
  } catch (e) {
    logger.warn("reconcileMarkets: could not read config, defaulting nextMarketId=0:", e);
  }

  let synced = 0;
  for (let marketId = 0; marketId < nextMarketId; marketId++) {
    if (marketId >= limit) break;
    const pda = getMarketPda(new (await import("@coral-xyz/anchor")).BN(marketId), program.programId);
    try {
      const acct = await program.account.market.fetchNullable(pda) as MarketAccount | null;
      if (!acct) continue;
      const m = decodeMarket(acct);
      const category = CATEGORY_NAMES[m.category] ?? "Other";
      const status = STATUS_NAMES[m.status] ?? "open";
      const outcome = OUTCOME_NAMES[m.winningOutcome] ?? "unset";
      await applyEventSafe({
        type: "market",
        marketPubkey: pda.toBase58(),
        marketId,
        // The Market account's authority is the admin/creator that initialized
        // it — surface it so every page can attribute markets without falling
        // back to null.
        creator: m.authority?.toBase58(),
        question: m.question,
        description: m.description,
        category,
        status,
        winningOutcome: outcome === "unset" ? undefined : outcome,
        yesPoolLamports: toLamports(m.yesPoolLamports),
        noPoolLamports: toLamports(m.noPoolLamports),
        yesSupply: toLamports(m.yesSupply),
        noSupply: toLamports(m.noSupply),
        feeCollectedLamports: toLamports(m.feeCollected),
        totalPayoutPoolLamports: toLamports(m.totalPayoutPool),
        endTs: m.endTs,
        resolveTs: m.resolveTs,
        // Only meaningful once the market has actually settled (0 otherwise).
        settledAt: m.settledAt > 0 ? m.settledAt : undefined,
      });
      synced++;
    } catch (e) {
      logger.debug(`reconcileMarkets: skip market ${marketId}:`, e);
    }
  }

  logger.info(`[indexer] reconciled ${synced} markets`);
  return synced;
}

/**
 * Fetch recent transactions for the program and reduce swap/trade activity
 * into the DB. Uses getSignaturesForAddress so it stays cursor-based.
 */
export async function reconcileTrades({
  connection,
  program,
  before,
  limit = 20,
}: ReconcileOptions & { before?: string }): Promise<{ trades: number; nextCursor: string | null }> {
  if (!getDb()) return { trades: 0, nextCursor: null };

  const sigs = await connection.getSignaturesForAddress(program.programId, { limit, before }, "confirmed");
  if (sigs.length === 0) return { trades: 0, nextCursor: null };

  let trades = 0;
  for (const s of sigs) {
    try {
      const tx = await connection.getParsedTransaction(s.signature, {
        maxSupportedTransactionVersion: 0,
      });
      // Skip only FAILED transactions. meta.err is null on success — the
      // previous `!tx.meta?.err` inverted this and dropped every successful
      // trade from the index.
      if (!tx || tx.meta?.err) continue;

      const msg = tx.transaction.message;
      const meta = tx.meta;
      if (!meta) continue;
      const accountKeys = msg.accountKeys;
      const preBalances = meta.preBalances ?? [];
      const postBalances = meta.postBalances ?? [];

      for (const ix of msg.instructions) {
        const prog = (ix as { programId?: PublicKey }).programId;
        if (!prog?.equals(program.programId)) continue;

        const decoded: any = (program.coder.instruction as any).decode(
          Buffer.from((ix as { data?: string }).data ?? "", "base64")
        );
        const name: string = decoded?.name ?? "";
        if (name !== "buyShares" && name !== "buy_shares" && name !== "sellShares" && name !== "sell_shares") continue;
        const isBuy = name === "buyShares" || name === "buy_shares";

        const accounts = (ix as { accounts?: PublicKey[] }).accounts ?? [];
        const trader = accounts[0] as PublicKey | undefined;
        const marketPubkey = accounts[1] as PublicKey | undefined;
        const treasury = accounts[2] as PublicKey | undefined;
        if (!trader || !marketPubkey || !treasury) continue;

        const args = decoded.data;
        const sideArg = (args?.side ?? args?.sideYes ?? {});
        // buy/sell side enum: { yes: {} } | { no: {} }
        const isNo = (sideArg as Record<string, unknown>).no !== undefined;
        const side = isNo ? "NO" : "YES";

        // Shares received or sold, on-chain base units (quantity * 1e6).
        const quantity = Number((args?.quantity as unknown) ?? 0);
        const tokensOut = isBuy ? quantity * 1_000_000 : -(quantity * 1_000_000);

        // Cost = SOL moved out of / into the treasury.
        const tIdx = accountKeys.findIndex((k) => (k.pubkey as PublicKey).equals(treasury));
        const rawCost = tIdx >= 0 ? (postBalances[tIdx] ?? 0) - (preBalances[tIdx] ?? 0) : 0;
        const lamportsIn = isBuy ? Math.abs(rawCost) : -Math.abs(rawCost);

        await applyEventSafe({
          type: "trade",
          signature: s.signature,
          marketPubkey: marketPubkey.toBase58(),
          trader: trader.toBase58(),
          side,
          outcomeIndex: side === "YES" ? 0 : 1,
          lamportsIn,
          tokensOut,
          pricePerToken: tokensOut > 0 ? Math.abs(lamportsIn) / LAMPORTS_PER_SOL / Math.abs(tokensOut) : 0,
          blockTime: s.blockTime ?? Math.floor(Date.now() / 1000),
          slot: s.slot,
        });
        trades++;
      }
    } catch (e) {
      logger.debug("reconcileTrades: skip tx:", e);
    }
  }

  return { trades, nextCursor: sigs[sigs.length - 1]?.signature ?? null };
}

type PositionAccount = IdlAccounts<Solpredict>["userPosition"];

export interface ReconcilePositionsResult {
  trades: number;
  positions: number;
}

/**
 * Reconstruct trades from the on-chain `user_position` accounts. This is
 * signature-independent (works even when the RPC does not index transaction
 * signatures, as on a bare solana-test-validator). Each holding is emitted as
 * one YES and/or NO trade; cost is split proportionally when both sides held.
 */
export async function reconcilePositions({ program }: ReconcileOptions): Promise<ReconcilePositionsResult> {
  if (!getDb()) return { trades: 0, positions: 0 };

  let positions = 0;
  let trades = 0;
  try {
    const accts = await program.account.userPosition.all();
    for (const a of accts) {
      const { publicKey: pda, account } = a as {
        publicKey: PublicKey;
        account: Record<string, unknown>;
      };
      const owner = account.owner as PublicKey | undefined;
      const market = account.market as PublicKey | undefined;
      if (!owner || !market) continue;

      const yesAmount = bnToNumber(account.yesAmount);
      const noAmount = bnToNumber(account.noAmount);
      const totalSpent = bnToNumber(account.totalSpentLamports) ?? bnToNumber(account.totalSpent);
      const totalShares = yesAmount + noAmount;
      if (totalShares === 0) continue;
      positions++;

      const split = (amt: number) =>
        totalSpent > 0 ? Math.round((totalSpent * amt) / totalShares) : 0;

      const sides: { side: "YES" | "NO"; amt: number; cost: number }[] = [];
      if (yesAmount > 0) sides.push({ side: "YES", amt: yesAmount, cost: split(yesAmount) });
      if (noAmount > 0) sides.push({ side: "NO", amt: noAmount, cost: split(noAmount) });

      const now = Math.floor(Date.now() / 1000);
      for (const s of sides) {
        await applyEventSafe({
          type: "trade",
          signature: `${pda.toBase58()}-${s.side === "YES" ? "y" : "n"}`,
          marketPubkey: market.toBase58(),
          trader: owner.toBase58(),
          side: s.side,
          outcomeIndex: s.side === "YES" ? 0 : 1,
          lamportsIn: s.cost,
          tokensOut: s.amt,
          pricePerToken: s.amt > 0 ? s.cost / LAMPORTS_PER_SOL / s.amt : 0,
          blockTime: now,
          slot: 0,
        });
        trades++;
      }
    }
  } catch (e) {
    logger.warn("reconcilePositions: skipped:", e);
  }

  logger.info(`[indexer] reconcilePositions: ${positions} positions, ${trades} trades`);
  return { trades, positions };
}
