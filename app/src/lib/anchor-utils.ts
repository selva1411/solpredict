import { PublicKey } from "@solana/web3.js";
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

export async function sendWithRetry<T>(
  builder: { rpc: () => Promise<string> },
  retries = 3,
): Promise<string> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await builder.rpc();
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