import { PublicKey, Transaction } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

export function txAccounts<T extends Record<string, unknown>>(accounts: T): Record<string, unknown> {
  return accounts as Record<string, unknown>;
}

export function typedWindowSolana(): { solana?: { isPhantom?: boolean; connect(): Promise<{ publicKey: PublicKey }> } } | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown) as { solana?: { isPhantom?: boolean; connect(): Promise<{ publicKey: PublicKey }> } };
}

export function typedPhantomSolana(): { solana?: { isPhantom?: boolean } } | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown) as { solana?: { isPhantom?: boolean } };
}

const BLOCKHASH_NOT_FOUND = "Blockhash not found";

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Minimal shape an Anchor `MethodsBuilder` exposes for building a transaction. */
export interface TxBuilderLike {
  transaction(): Promise<Transaction>;
}

/** Structural view of an Anchor `Program` — accepts typed IDL programs too. */
interface HasProvider {
  provider: anchor.Provider;
}

/**
 * Build, sign and SEND a transaction, returning the signature IMMEDIATELY
 * (one RTT). Confirmation runs in the BACKGROUND.
 *
 * Anchor's `builder.rpc()` = send + block up to 30s waiting for confirmation,
 * then throws `TransactionExpiredTimeoutError` — even when the tx actually
 * landed on a slow validator. Send-first fixes that: the UI gets the signature
 * right after the wallet popup, and the on-chain account subscription + the
 * post-trade `readFreshAccount` poll keep the UI and DB in sync when the block
 * lands.
 *
 * Preflight simulation is left ON (default) so genuinely-bad transactions
 * (insufficient balance, invalid accounts, ...) fail fast with a clear error
 * instead of silently never landing.
 */
export async function buildSignSendConfirm(
  program: HasProvider,
  builder: TxBuilderLike,
  opts: { skipPreflight?: boolean } = { skipPreflight: false },
): Promise<string> {
  const provider = program.provider as anchor.AnchorProvider;
  const tx = await builder.transaction();
  tx.feePayer = tx.feePayer ?? provider.wallet.publicKey;
  const bh = await provider.connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = bh.blockhash;
  const signed = await provider.wallet.signTransaction(tx);
  const raw = signed.serialize();
  const signature = await provider.connection.sendRawTransaction(raw, {
    skipPreflight: opts.skipPreflight ?? false,
    preflightCommitment: "confirmed",
  });
  // Fire-and-forget confirmation — never blocks the UI. A failure here (e.g.
  // the blockhash expired before the block landed) does not mean the tx failed;
  // onAccountChange + readFreshAccount are the real UI sync.
  void provider.connection
    .confirmTransaction(
      { signature, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight },
      "confirmed",
    )
    .catch(() => {});
  return signature;
}

export async function sendWithRetry<T>(
  program: HasProvider,
  builder: TxBuilderLike,
  retries = 3,
): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await buildSignSendConfirm(program, builder);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes(BLOCKHASH_NOT_FOUND) && attempt < retries - 1) {
        const delay = 1000 + attempt * 500;
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw new Error("sendWithRetry exhausted");
}