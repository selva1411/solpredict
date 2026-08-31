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

const STORAGE_KEY = "solpredict-user-proofs:v1";

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function loadStoredProofs(): Record<string, UserAuth> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, UserAuth>) : {};
  } catch {
    return {};
  }
}

/**
 * Persist the signed proof per wallet so a page refresh / navigation does not
 * re-trigger the wallet sign-message prompt. The proof stays cryptographically
 * valid (server verifies prefix + ed25519 signature), so once signed it is
 * reused until the connected wallet changes.
 */
function persistProof(proof: UserAuth): void {
  if (typeof window === "undefined") return;
  try {
    const proofs = loadStoredProofs();
    proofs[proof.wallet] = proof;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(proofs));
  } catch {
    // Storage unavailable/full — the in-memory cache still works for the session.
  }
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
  const walletKey = wallet.publicKey.toBase58();
  if (cached && cached.wallet === walletKey) return cached;

  // Reuse a previously-signed proof for this wallet instead of re-prompting.
  const stored = loadStoredProofs()[walletKey];
  if (stored) {
    cached = stored;
    return stored;
  }

  if (!signMessage) return null;

  if (!signing) {
    signing = (async () => {
      try {
        const message = buildUserMessage(String(Date.now()));
        const signature = await signMessage(new TextEncoder().encode(message));
        const proof = { wallet: walletKey, message, signature: toBase64(signature) };
        cached = proof;
        persistProof(proof);
        return proof;
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
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // noop
  }
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