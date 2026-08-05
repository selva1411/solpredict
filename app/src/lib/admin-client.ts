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

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
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
  if (cached && cached.wallet === wallet.publicKey.toBase58()) return cached;
  if (!signMessage) return null;

  if (!signing) {
    signing = (async () => {
      try {
        const walletKey = wallet.publicKey!.toBase58();
        const message = buildAdminMessage(String(Date.now()));
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

export function clearAdminProof(): void {
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

/** fetch wrapper that attaches the admin signature headers when a proof is cached. */
export async function adminFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, applyHeaders(init));
}
