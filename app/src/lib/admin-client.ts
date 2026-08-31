import type { MessageSignerWalletAdapterProps } from "@solana/wallet-adapter-base";
import { PublicKey } from "@solana/web3.js";
import { buildAdminMessage } from "./admin-message";

interface AdminAuth {
  wallet: string;
  message: string;
  signature: string;
}

let cached: AdminAuth | null = null;
let signing: Promise<AdminAuth | null> | null = null;

const STORAGE_KEY = "solpredict-admin-proofs:v1";

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function loadStoredProofs(): Record<string, AdminAuth> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, AdminAuth>) : {};
  } catch {
    return {};
  }
}

function persistProof(proof: AdminAuth): void {
  if (typeof window === "undefined") return;
  try {
    const proofs = loadStoredProofs();
    proofs[proof.wallet] = proof;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(proofs));
  } catch {
    // Storage unavailable/full — the in-memory cache still works for the session.
  }
}

/**
 * Sign a fresh admin proof with the connected wallet and cache it.
 * Call from the admin page whenever the connected wallet changes.
 * Safe to call repeatedly — the cached proof is reused.
 */
export async function signAdminProof(
  wallet: { publicKey: PublicKey | null },
  signMessage: MessageSignerWalletAdapterProps["signMessage"] | undefined,
): Promise<AdminAuth | null> {
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
        const message = buildAdminMessage(String(Date.now()));
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

export function clearAdminProof(): void {
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

/** fetch wrapper that attaches the admin signature headers when a proof is cached. */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, applyHeaders(init));
}
