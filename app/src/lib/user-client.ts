import type { MessageSignerWalletAdapterProps } from "@solana/wallet-adapter-base";
import { PublicKey } from "@solana/web3.js";
import { buildUserMessage } from "./user-message";

interface UserAuth {
  wallet: string;
  message: string;
  signature: string;
}

let cached: UserAuth | null = null;
let signing: Promise<UserAuth | null> | null = null;

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

export interface UserSigner {
  publicKey: PublicKey | null;
  signMessage?: MessageSignerWalletAdapterProps["signMessage"];
}

/**
 * Sign a fresh ownership proof with the connected wallet and cache it.
 * The signed message proves the caller controls the wallet they're acting
 * as — the server (`requireUser`) verifies the signature before touching
 * wallet-scoped data, so no one can spoof another user's wallet.
 */
export async function signUserProof(
  wallet: UserSigner,
  signMessage: MessageSignerWalletAdapterProps["signMessage"] | undefined,
): Promise<UserAuth | null> {
  if (!wallet?.publicKey) return null;
  if (cached && cached.wallet === wallet.publicKey.toBase58()) return cached;
  if (!signMessage) return null;

  if (!signing) {
    signing = (async () => {
      try {
        const walletKey = wallet.publicKey!.toBase58();
        const message = buildUserMessage(String(Date.now()));
        const signature = await signMessage(new TextEncoder().encode(message));
        cached = { wallet: walletKey, message, signature: toBase64(signature) };
        return cached;
      } catch {
        return null;
      } finally {
        signing = null;
      }
    })();
  }
  return signing;
}

export function clearUserProof(): void {
  cached = null;
}

function applyHeaders(init?: RequestInit): RequestInit | undefined {
  if (!cached) return init;
  const headers = new Headers(init?.headers);
  headers.set("x-wallet", cached.wallet);
  headers.set("x-message", cached.message);
  headers.set("x-signature", cached.signature);
  return { ...init, headers };
}

/**
 * fetch wrapper that attaches the wallet-ownership proof headers when a proof
 * is cached. Use for every wallet-scoped user API call.
 */
export async function userFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, applyHeaders(init));
}