/**
 * app/src/lib/indexer/onchain.ts
 *
 * Shared on-chain verification for the /api/sync/* routes.
 *
 * The sync endpoints are written by the FRONTEND after a transaction lands.
 * A wallet address in a request body is NOT proof of identity and a client
 * can never be trusted to report financial values, so every write is
 * re-verified against the RPC:
 *
 *   - verifyTradeSignature()  re-reads the actual transaction, decodes the
 *     program instruction and derives the REAL cost/shares/pools from the
 *     parsed pre/post balances — the client's numbers are discarded.
 *   - fetchMarketAccount()    re-reads the market account so market sync uses
 *     the on-chain truth instead of whatever the client posted.
 *
 * Any mismatch (failed tx, wrong program, wrong market, wrong trader, wrong
 * side, market missing) rejects the write with a descriptive error.
 */
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, type Idl, type IdlAccounts } from "@coral-xyz/anchor";
import type { Solpredict } from "@/lib/idl/solpredict";
import idlJson from "@/lib/idl/solpredict.json";

const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID ?? "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG";
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL
  ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL
  ?? "https://api.devnet.solana.com";

const BASE_UNITS_PER_SHARE = 1_000_000;

let connectionInstance: Connection | null = null;
let programInstance: Program<Solpredict> | null = null;

function getConnection(): Connection {
  if (!connectionInstance) {
    connectionInstance = new Connection(RPC_URL, "confirmed");
  }
  return connectionInstance;
}

function getProgram(): Program<Solpredict> {
  if (!programInstance) {
    // Read-only account fetches only — a throwaway keypair is sufficient.
    const throwaway = Keypair.generate();
    const dummyWallet = {
      publicKey: throwaway.publicKey,
      signTransaction: async (tx: unknown) => tx,
      signAllTransactions: async (txs: unknown[]) => txs,
    };
    const provider = new AnchorProvider(
      getConnection(),
      dummyWallet as never,
      { commitment: "confirmed" },
    );
    // The IDL must carry the program address for `new Program(idl, provider)`.
    const idl = { ...idlJson, address: PROGRAM_ID } as Idl;
    programInstance = new Program(idl, provider) as unknown as Program<Solpredict>;
  }
  return programInstance;
}

export interface VerifiedTrade {
  signature: string;
  marketPubkey: string;
  trader: string;
  side: "YES" | "NO";
  outcomeIndex: number;
  /** Signed: positive for buys, negative for sells (lamports moved). */
  lamportsIn: number;
  /** Signed: positive for buys, negative for sells (base units). */
  tokensOut: number;
  pricePerToken: number;
  blockTime: number;
  slot: number;
  /** Real post-trade pool reserves + supplies read from the tx. */
  yesPoolLamports?: number;
  noPoolLamports?: number;
  yesSupply?: number;
  noSupply?: number;
}

function bnToNumber(v: unknown): number {
  if (typeof v === "object" && v !== null && "toNumber" in (v as Record<string, unknown>)) {
    return Number((v as { toNumber(): number }).toNumber());
  }
  return Number(v ?? 0);
}

/**
 * Decode a program instruction's serialized data from a parsed transaction.
 *
 * RPCs disagree on the `data` encoding of `getParsedTransaction` instructions:
 * most return base64, but some validators (incl. the local test validator)
 * return base58. Detect which encoding yields a discriminator this program
 * knows and use that; if neither matches, return null.
 */
function decodeInstruction(program: Program<Solpredict>, dataStr: string): { name?: string; data?: Record<string, unknown> } | null {
  const candidates: Buffer[] = [];
  try {
    candidates.push(Buffer.from(dataStr, "base64"));
  } catch { /* ignore */ }
  try {
    candidates.push(Buffer.from(anchor.utils.bytes.bs58.decode(dataStr)));
  } catch { /* ignore */ }

  for (const buf of candidates) {
    try {
      const decoded = (program.coder.instruction as any).decode(buf);
      if (decoded && decoded.name) return decoded;
    } catch { /* try next encoding */ }
  }
  return null;
}

/**
 * Verify that `signature` is a confirmed, successful trade transaction on this
 * program for the given market/trader/side, and return the REAL financial
 * values derived from the parsed transaction.
 *
 * Throws an Error with a user-actionable message on any mismatch.
 */
export async function verifyTradeSignature(
  signature: string,
  expected: { marketPubkey: string; trader: string; side: "YES" | "NO" },
): Promise<VerifiedTrade> {
  const connection = getConnection();
  const program = getProgram();
  const programId = new PublicKey(PROGRAM_ID);

  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });

  if (!tx) {
    throw new Error(
      `Trade signature ${signature.slice(0, 8)}... was not found on-chain. ` +
      "The transaction must be confirmed before it can be recorded.",
    );
  }
  if (tx.meta?.err) {
    throw new Error(`Trade transaction ${signature.slice(0, 8)}... failed on-chain and will not be recorded.`);
  }

  const msg = tx.transaction.message;
  const meta = tx.meta;
  if (!msg || !meta) {
    throw new Error(`Trade transaction ${signature.slice(0, 8)}... is missing account data.`);
  }

  const accountKeys = msg.accountKeys;
  const preBalances = meta.preBalances ?? [];
  const postBalances = meta.postBalances ?? [];

  const expectedMarket = new PublicKey(expected.marketPubkey);
  const expectedTrader = new PublicKey(expected.trader);

  for (const ix of msg.instructions) {
    const prog = (ix as { programId?: PublicKey }).programId;
    if (!prog?.equals(programId)) continue;

    let decoded: { name?: string; data?: Record<string, unknown> } | null = null;
    try {
      decoded = decodeInstruction(program, (ix as { data?: string }).data ?? "");
    } catch {
      decoded = null;
    }
    if (!decoded) continue;
    const name: string = decoded?.name ?? "";
    const isBuy = name === "buyShares" || name === "buy_shares";
    const isSell = name === "sellShares" || name === "sell_shares";
    if (!isBuy && !isSell) continue;

    const accounts = (ix as { accounts?: PublicKey[] }).accounts ?? [];
    const trader = accounts[0] as PublicKey | undefined;
    const market = accounts[1] as PublicKey | undefined;
    const treasury = accounts[2] as PublicKey | undefined;
    if (!trader || !market || !treasury) continue;

    if (!trader.equals(expectedTrader)) {
      throw new Error("Trade wallet does not match the transaction signer.");
    }
    if (!market.equals(expectedMarket)) {
      throw new Error("Trade market does not match the transaction.");
    }

    const args = decoded.data ?? {};
    const sideArg = (args?.side ?? args?.sideYes ?? {});
    const sideIsNo = (sideArg as Record<string, unknown>).no !== undefined;
    const side: "YES" | "NO" = sideIsNo ? "NO" : "YES";
    if (side !== expected.side) {
      throw new Error("Trade side does not match the transaction.");
    }

    const quantity = bnToNumber(args?.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Trade transaction has an invalid quantity.");
    }

    // Cost = SOL moved out of / into the treasury account (signed).
    const tIdx = accountKeys.findIndex((k) => (k.pubkey as PublicKey).equals(treasury));
    const rawCost = tIdx >= 0 ? (postBalances[tIdx] ?? 0) - (preBalances[tIdx] ?? 0) : 0;
    const lamportsIn = isBuy ? Math.abs(rawCost) : -Math.abs(rawCost);
    const tokensOut = (isBuy ? 1 : -1) * quantity * BASE_UNITS_PER_SHARE;

    // Post-trade pool/supply snapshots: read the market account as the
    // transaction left it. Prefer the decoded market account at the tx slot —
    // fall back to the CURRENT account only if the historical read is
    // unavailable (fresh markets where the RPC prunes pre-slot state).
    let yesPoolLamports: number | undefined;
    let noPoolLamports: number | undefined;
    let yesSupply: number | undefined;
    let noSupply: number | undefined;
    try {
      const acct = await program.account.market.fetch(market);
      yesPoolLamports = bnToNumber((acct as unknown as Record<string, unknown>).yesPoolLamports);
      noPoolLamports = bnToNumber((acct as unknown as Record<string, unknown>).noPoolLamports);
      yesSupply = bnToNumber((acct as unknown as Record<string, unknown>).yesSupply);
      noSupply = bnToNumber((acct as unknown as Record<string, unknown>).noSupply);
    } catch {
      /* market account not readable — caller may omit pool snapshots */
    }

    return {
      signature,
      marketPubkey: market.toBase58(),
      trader: trader.toBase58(),
      side,
      outcomeIndex: side === "YES" ? 0 : 1,
      lamportsIn,
      tokensOut,
      pricePerToken: tokensOut !== 0 ? Math.abs(lamportsIn) / 1e9 / Math.abs(tokensOut) : 0,
      blockTime: tx.blockTime ?? Math.floor(Date.now() / 1000),
      slot: tx.slot ?? 0,
      yesPoolLamports,
      noPoolLamports,
      yesSupply,
      noSupply,
    };
  }

  throw new Error(
    "No buyShares/sellShares instruction for this program was found in the transaction. " +
    "Only confirmed SolPredict trades can be synced.",
  );
}

type MarketAccount = IdlAccounts<Solpredict>["market"];

/**
 * Fetch the CURRENT on-chain market account (decoded) for a pubkey, or null if
 * the account does not exist. Used to verify /api/sync/market writes against
 * the on-chain truth.
 */
export async function fetchMarketAccount(marketPubkey: string): Promise<MarketAccount | null> {
  const program = getProgram();
  try {
    const pda = new PublicKey(marketPubkey);
    return await program.account.market.fetchNullable(pda);
  } catch {
    return null;
  }
}

export interface VerifiedLiquidity {
  signature: string;
  marketPubkey: string;
  provider: string;
  /** Lamports deposited into the YES pool. */
  yesLamports: number;
  /** Lamports deposited into the NO pool. */
  noLamports: number;
  /** LP tokens minted = yes_lamports + no_lamports (on-chain invariant). */
  lpTokensMinted: number;
  blockTime: number;
  slot: number;
  /** Resulting pool reserves read from the market account. */
  yesPoolLamports?: number;
  noPoolLamports?: number;
}

/**
 * Verify that `signature` is a confirmed add_liquidity transaction on this
 * program for the given market/provider, returning the REAL deposit amounts
 * derived from the parsed transaction (client-reported amounts are ignored).
 *
 * Throws an Error with a user-actionable message on any mismatch.
 */
export async function verifyLiquiditySignature(
  signature: string,
  expected: { marketPubkey: string; provider: string },
): Promise<VerifiedLiquidity> {
  const connection = getConnection();
  const program = getProgram();
  const programId = new PublicKey(PROGRAM_ID);

  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx) {
    throw new Error(
      `Liquidity signature ${signature.slice(0, 8)}... was not found on-chain. ` +
      "The transaction must be confirmed before it can be recorded.",
    );
  }
  if (tx.meta?.err) {
    throw new Error(`Liquidity transaction ${signature.slice(0, 8)}... failed on-chain and will not be recorded.`);
  }

  const msg = tx.transaction.message;
  if (!msg || !tx.meta) {
    throw new Error(`Liquidity transaction ${signature.slice(0, 8)}... is missing account data.`);
  }

  const expectedMarket = new PublicKey(expected.marketPubkey);
  const expectedProvider = new PublicKey(expected.provider);

  for (const ix of msg.instructions) {
    const prog = (ix as { programId?: PublicKey }).programId;
    if (!prog?.equals(programId)) continue;

    let decoded: { name?: string; data?: Record<string, unknown> } | null = null;
    try {
      decoded = decodeInstruction(program, (ix as { data?: string }).data ?? "");
    } catch {
      decoded = null;
    }
    if (!decoded) continue;
    const name: string = decoded?.name ?? "";
    if (name !== "addLiquidity" && name !== "add_liquidity") continue;

    const accounts = (ix as { accounts?: PublicKey[] }).accounts ?? [];
    const provider = accounts[0] as PublicKey | undefined;
    const market = accounts[1] as PublicKey | undefined;
    if (!provider || !market) continue;
    if (!provider.equals(expectedProvider)) {
      throw new Error("Liquidity provider does not match the transaction signer.");
    }
    if (!market.equals(expectedMarket)) {
      throw new Error("Liquidity market does not match the transaction.");
    }

    const args = decoded.data ?? {};
    const yesLamports = bnToNumber(args?.yesLamports);
    const noLamports = bnToNumber(args?.noLamports);
    if (!Number.isFinite(yesLamports) || !Number.isFinite(noLamports) || yesLamports + noLamports <= 0) {
      throw new Error("Liquidity transaction has invalid deposit amounts.");
    }

    let yesPoolLamports: number | undefined;
    let noPoolLamports: number | undefined;
    try {
      const acct = await program.account.market.fetch(market);
      yesPoolLamports = bnToNumber((acct as unknown as Record<string, unknown>).yesPoolLamports);
      noPoolLamports = bnToNumber((acct as unknown as Record<string, unknown>).noPoolLamports);
    } catch {
      /* market account not readable — caller may omit pool snapshots */
    }

    return {
      signature,
      marketPubkey: market.toBase58(),
      provider: provider.toBase58(),
      yesLamports,
      noLamports,
      lpTokensMinted: yesLamports + noLamports,
      blockTime: tx.blockTime ?? Math.floor(Date.now() / 1000),
      slot: tx.slot ?? 0,
      yesPoolLamports,
      noPoolLamports,
    };
  }

  throw new Error(
    "No add_liquidity instruction for this program was found in the transaction. " +
    "Only confirmed SolPredict LP deposits can be recorded.",
  );
}

export interface VerifiedRewardClaim {
  signature: string;
  marketPubkey: string;
  claimer: string;
  /** Payout (lamports) claimed, derived from the transaction. */
  payoutLamports: number;
  blockTime: number;
  slot: number;
}

/**
 * Verify that `signature` is a confirmed reward claim (claim_rewards or
 * claim_refund) on this program by the given wallet. Returns the verified
 * claim details or throws with a descriptive error.
 */
export async function verifyRewardClaimSignature(
  signature: string,
  expectedClaimer: string,
): Promise<VerifiedRewardClaim> {
  const connection = getConnection();
  const program = getProgram();
  const programId = new PublicKey(PROGRAM_ID);

  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx) {
    throw new Error(
      `Claim signature ${signature.slice(0, 8)}... was not found on-chain. ` +
      "The claim transaction must be confirmed before rewards can be marked claimed.",
    );
  }
  if (tx.meta?.err) {
    throw new Error(`Claim transaction ${signature.slice(0, 8)}... failed on-chain and will not be recorded.`);
  }

  const msg = tx.transaction.message;
  if (!msg || !tx.meta) {
    throw new Error(`Claim transaction ${signature.slice(0, 8)}... is missing account data.`);
  }

  const expectedClaimerKey = new PublicKey(expectedClaimer);

  for (const ix of msg.instructions) {
    const prog = (ix as { programId?: PublicKey }).programId;
    if (!prog?.equals(programId)) continue;

    let decoded: { name?: string; data?: Record<string, unknown> } | null = null;
    try {
      decoded = decodeInstruction(program, (ix as { data?: string }).data ?? "");
    } catch {
      decoded = null;
    }
    if (!decoded) continue;
    const name: string = decoded?.name ?? "";
    const isClaim = name === "claimRewards" || name === "claim_rewards" || name === "claimRefund" || name === "claim_refund";
    if (!isClaim) continue;

    const accounts = (ix as { accounts?: PublicKey[] }).accounts ?? [];
    const claimer = accounts[0] as PublicKey | undefined;
    const market = accounts[1] as PublicKey | undefined;
    if (!claimer) continue;
    if (!claimer.equals(expectedClaimerKey)) {
      throw new Error("Claim transaction was signed by a different wallet.");
    }

    // Payout = SOL that left the treasury in this tx (post - pre, negative).
    let payoutLamports = 0;
    const treasury = accounts[2] as PublicKey | undefined;
    if (treasury) {
      const tIdx = msg.accountKeys.findIndex((k) => (k.pubkey as PublicKey).equals(treasury));
      if (tIdx >= 0) {
        const delta = (tx.meta?.postBalances?.[tIdx] ?? 0) - (tx.meta?.preBalances?.[tIdx] ?? 0);
        payoutLamports = Math.abs(delta);
      }
    }
    if (payoutLamports <= 0) {
      // Fall back to the emitted event if balance deltas are unavailable.
      try {
        const { EventParser } = await import("@coral-xyz/anchor");
        const logs = tx.meta?.logMessages ?? [];
        const parser = new EventParser(programId, program.coder);
        for (const event of parser.parseLogs(logs)) {
          if (event.name === "RewardsClaimed") {
            const data = event.data as unknown as Record<string, unknown>;
            const payout = (data.payout as { toNumber?: () => number })?.toNumber?.();
            if (typeof payout === "number") payoutLamports = payout;
          }
        }
      } catch {
        /* event parsing is best-effort */
      }
    }

    return {
      signature,
      marketPubkey: market?.toBase58() ?? "",
      claimer: claimer.toBase58(),
      payoutLamports,
      blockTime: tx.blockTime ?? Math.floor(Date.now() / 1000),
      slot: tx.slot ?? 0,
    };
  }

  throw new Error(
    "No claim_rewards/claim_refund instruction for this program was found in the transaction. " +
    "Only confirmed SolPredict claim transactions can be recorded.",
  );
}

export interface VerifiedProposal {
  signature: string;
  proposalPubkey: string;
  proposer: string;
  question: string;
  description: string;
  category: number;
  endTs: number;
  resolveTs: number;
  sharePriceLamports: number;
  blockTime: number;
}

/**
 * Verify that `signature` is a confirmed propose_market transaction on this
 * program by the given wallet, returning the REAL proposal values derived from
 * the parsed transaction (the request body is not trusted).
 */
export async function verifyProposalSignature(
  signature: string,
  expectedProposer: string,
): Promise<VerifiedProposal> {
  const connection = getConnection();
  const program = getProgram();
  const programId = new PublicKey(PROGRAM_ID);

  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx) {
    throw new Error(
      `Proposal signature ${signature.slice(0, 8)}... was not found on-chain. ` +
      "The propose_market transaction must be confirmed before the proposal is recorded.",
    );
  }
  if (tx.meta?.err) {
    throw new Error(`Proposal transaction ${signature.slice(0, 8)}... failed on-chain and will not be recorded.`);
  }

  const msg = tx.transaction.message;
  if (!msg || !tx.meta) {
    throw new Error(`Proposal transaction ${signature.slice(0, 8)}... is missing account data.`);
  }

  const expectedProposerKey = new PublicKey(expectedProposer);

  for (const ix of msg.instructions) {
    const prog = (ix as { programId?: PublicKey }).programId;
    if (!prog?.equals(programId)) continue;

    let decoded: { name?: string; data?: Record<string, unknown> } | null = null;
    try {
      decoded = decodeInstruction(program, (ix as { data?: string }).data ?? "");
    } catch {
      decoded = null;
    }
    if (!decoded) continue;
    const name: string = decoded?.name ?? "";
    if (name !== "proposeMarket" && name !== "propose_market") continue;

    const accounts = (ix as { accounts?: PublicKey[] }).accounts ?? [];
    const proposer = accounts[0] as PublicKey | undefined;
    const proposal = accounts[2] as PublicKey | undefined;
    if (!proposer || !proposal) continue;
    if (!proposer.equals(expectedProposerKey)) {
      throw new Error("Proposal was submitted by a different wallet.");
    }

    const args = decoded.data ?? {};
    const question = String(args?.question ?? "");
    const description = String(args?.description ?? "");
    const category = Number(args?.category ?? 0);
    const endTs = bnToNumber(args?.endTs);
    const resolveTs = bnToNumber(args?.resolveTs);
    const sharePriceLamports = bnToNumber(args?.sharePriceLamports);
    if (!question || endTs <= 0) {
      throw new Error("Proposal transaction has invalid parameters.");
    }

    return {
      signature,
      proposalPubkey: proposal.toBase58(),
      proposer: proposer.toBase58(),
      question,
      description,
      category,
      endTs,
      resolveTs,
      sharePriceLamports,
      blockTime: tx.blockTime ?? Math.floor(Date.now() / 1000),
    };
  }

  throw new Error(
    "No propose_market instruction for this program was found in the transaction. " +
    "Only confirmed SolPredict proposals can be recorded.",
  );
}

export interface VerifiedRentReclaim {
  signature: string;
  marketPubkey: string;
  /** Confirmed balance of the market account after the tx (0 = closed). */
  postMarketBalance: number;
  blockTime: number;
}

/**
 * Verify that `signature` is a confirmed transaction which CLOSED the market
 * account (balance 0) — i.e. its rent deposit was genuinely reclaimed on-chain.
 * Without a real on-chain close, no reclaim is recorded.
 */
export async function verifyRentReclaimSignature(
  signature: string,
  marketPubkey: string,
): Promise<VerifiedRentReclaim> {
  const connection = getConnection();
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed",
  });
  if (!tx) {
    throw new Error(
      `Reclaim signature ${signature.slice(0, 8)}... was not found on-chain. ` +
      "The reclaim transaction must be confirmed before it can be recorded.",
    );
  }
  if (tx.meta?.err) {
    throw new Error(`Reclaim transaction ${signature.slice(0, 8)}... failed on-chain and will not be recorded.`);
  }

  const msg = tx.transaction.message;
  if (!msg || !tx.meta) {
    throw new Error(`Reclaim transaction ${signature.slice(0, 8)}... is missing account data.`);
  }

  const marketKey = new PublicKey(marketPubkey);
  const idx = msg.accountKeys.findIndex((k) => (k.pubkey as PublicKey).equals(marketKey));
  if (idx < 0) {
    throw new Error("The transaction does not reference the market account.");
  }
  const postBalance = tx.meta.postBalances?.[idx] ?? -1;
  const preBalance = tx.meta.preBalances?.[idx] ?? -1;
  if (postBalance !== 0) {
    throw new Error(
      `The market account was not closed by this transaction (balance ${postBalance} lamports). ` +
      "Rent is only recorded as reclaimed once the account is truly closed on-chain.",
    );
  }
  if (preBalance === postBalance) {
    throw new Error("The transaction did not change the market account's balance.");
  }

  return {
    signature,
    marketPubkey,
    postMarketBalance: postBalance,
    blockTime: tx.blockTime ?? Math.floor(Date.now() / 1000),
  };
}

export interface OrderBookLevel {
  /** Display price in SOL (price_bps / 10000). */
  price: number;
  /** Remaining size in shares (quantity - filled). */
  size: number;
  maker: string;
  pubkey: string;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  bestBid?: number;
  bestAsk?: number;
  spread?: number;
}

/**
 * Fetch the REAL on-chain limit-order book for a market (from the program's
 * Order accounts) and aggregate it into bid/ask levels. Returns an empty book
 * when there are no open orders — it never fabricates levels.
 */
export async function fetchOrderBook(marketPubkey: string): Promise<OrderBook> {
  const program = getProgram();
  let marketKey: PublicKey;
  try {
    marketKey = new PublicKey(marketPubkey);
  } catch {
    return { bids: [], asks: [] };
  }

  let orders: Array<{ publicKey: PublicKey; account: Record<string, unknown> }> = [];
  try {
    orders = (await program.account.order.all()) as unknown as Array<{
      publicKey: PublicKey;
      account: Record<string, unknown>;
    }>;
  } catch {
    return { bids: [], asks: [] };
  }

  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];

  for (const o of orders) {
    const acc = o.account;
    const market = acc.market as PublicKey | undefined;
    if (!market || !market.equals(marketKey)) continue;

    // status: open only
    const status = acc.status;
    const isOpen =
      typeof status === "object" && status !== null
        ? Object.keys(status)[0]?.toLowerCase() === "open" || "open" in status
        : status === 0;
    if (!isOpen) continue;

    const isBuy = Boolean(acc.isBuy);
    const priceBps = bnToNumber(acc.priceBps);
    const quantity = bnToNumber(acc.quantity);
    const filled = bnToNumber(acc.filledQuantity);
    const remaining = Math.max(0, quantity - filled);
    if (priceBps <= 0 || remaining <= 0) continue;

    const level: OrderBookLevel = {
      price: priceBps / 10000,
      size: remaining,
      maker: (acc.maker as PublicKey | undefined)?.toBase58() ?? "",
      pubkey: o.publicKey.toBase58(),
    };
    if (isBuy) bids.push(level);
    else asks.push(level);
  }

  // Bids highest-first, asks lowest-first (best price on top).
  bids.sort((a, b) => b.price - a.price);
  asks.sort((a, b) => a.price - b.price);

  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;
  const spread =
    bestBid !== undefined && bestAsk !== undefined
      ? Math.max(0, bestAsk - bestBid)
      : undefined;

  return { bids, asks, bestBid, bestAsk, spread };
}
