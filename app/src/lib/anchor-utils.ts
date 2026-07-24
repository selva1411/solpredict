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