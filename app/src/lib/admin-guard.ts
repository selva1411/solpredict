import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { verifySignature, verifySessionToken, isAdminWallet, type Session } from "./auth";
import { ADMIN_MESSAGE_PREFIX } from "./admin-message";
import { getConfigPda } from "./pda";

export interface AdminIdentity {
  wallet: string;
  method: "signature" | "session" | "dev";
}

function adminResponse(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Server-side guard for admin-only API routes.
 *
 * Accepts either:
 *  1. A wallet-signed proof of ownership via `x-wallet`, `x-message`, `x-signature`
 *     headers (message must be signed by the wallet itself), or
 *  2. A valid session cookie whose wallet is an admin wallet, or
 *  3. (Development only) any request — the panel runs on localnet where the
 *     admin keypair is a CLI wallet, not a browser adapter.
 *
 * In production, authentication is always required.
 */
export async function requireAdmin(req: NextRequest): Promise<
  { ok: true; identity: AdminIdentity } | { ok: false; response: NextResponse }
> {
  // Development (localnet): the panel runs against a local test validator and
  // the admin wallet is any browser wallet connected to the app (e.g. it was
  // made the on-chain `config.admin` via "Initialize Config PDA"). Allow any
  // request here; production below still enforces real authentication.
  if (process.env.NODE_ENV === "development") {
    return { ok: true, identity: { wallet: "dev", method: "dev" } };
  }

  const configured = (process.env.ADMIN_WALLET || "").split(",").map((w) => w.trim()).filter(Boolean);

  // Build the admin allowlist: on-chain config.admin (source of truth) merged
  // with the static env var fallback. The on-chain value is fetched with a
  // short TTL cache so every API call doesn't hit the RPC.
  const onChainAdmin = await fetchOnChainAdmin();
  const envAdmins = configured.length > 0 ? configured : [];
  const allowed = onChainAdmin
    ? [onChainAdmin, ...envAdmins.filter((w) => w !== onChainAdmin)]
    : envAdmins;

  // Path 1: signed proof of ownership
  const wallet = req.headers.get("x-wallet")?.trim();
  const message = req.headers.get("x-message");
  const signature = req.headers.get("x-signature");

  if (wallet && message && signature) {
    if (!isAdminWallet(wallet, allowed)) {
      return { ok: false, response: adminResponse(403, "Wallet is not an admin") };
    }
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(wallet);
    } catch {
      return { ok: false, response: adminResponse(401, "Invalid wallet address") };
    }
    if (!message.startsWith(ADMIN_MESSAGE_PREFIX)) {
      return { ok: false, response: adminResponse(401, "Invalid message format") };
    }
    let sigBytes: Uint8Array;
    try {
      sigBytes = Buffer.from(signature, "base64");
    } catch {
      return { ok: false, response: adminResponse(401, "Invalid signature encoding") };
    }
    if (!verifySignature(message, sigBytes, pubkey)) {
      return { ok: false, response: adminResponse(401, "Signature verification failed") };
    }
    return { ok: true, identity: { wallet, method: "signature" } };
  }

  // Path 2: session cookie
  const token = req.cookies.get("session")?.value;
  if (token) {
    const session: Session | null = verifySessionToken(token);
    if (session && isAdminWallet(session.wallet, allowed)) {
      return { ok: true, identity: { wallet: session.wallet, method: "session" } };
    }
  }

  return { ok: false, response: adminResponse(401, "Admin authentication required") };
}

// ---------------------------------------------------------------------------
// On-chain config.admin fetcher with in-memory TTL cache.
//
// The config PDA stores the canonical admin pubkey. This function reads it via
// a lightweight `getAccountInfo` RPC call and caches the result for 60 s so
// every API request doesn't round-trip to the validator. If the RPC is
// unreachable (validator down, network blip), the cache serves stale data;
// if there's no cache at all we fall through and rely solely on env vars.
// ---------------------------------------------------------------------------
const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID || "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG",
);

let cachedAdmin: { wallet: string; ts: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

async function fetchOnChainAdmin(): Promise<string | null> {
  // Serve from cache if still fresh
  if (cachedAdmin && Date.now() - cachedAdmin.ts < CACHE_TTL_MS) {
    return cachedAdmin.wallet;
  }

  try {
    const rpcUrl =
      process.env.NEXT_PUBLIC_RPC_URL?.replace(
        /localhost:\d+|127\.0\.0\.1:\d+/,
        "127.0.0.1:8899",
      ) || process.env.LOCALNET_RPC_URL || "http://127.0.0.1:8899";

    const conn = new Connection(rpcUrl, "confirmed");
    const configPda = getConfigPda(PROGRAM_ID);
    const info = await conn.getAccountInfo(configPda);
    if (!info || !info.data) return null;

    // Config account layout: admin (32 bytes) is the first field.
    const adminPubkey = new PublicKey(info.data.subarray(0, 32));
    const wallet = adminPubkey.toBase58();

    cachedAdmin = { wallet, ts: Date.now() };
    return wallet;
  } catch {
    // RPC unreachable — serve stale cache if available
    return cachedAdmin?.wallet ?? null;
  }
}
