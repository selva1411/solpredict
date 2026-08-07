import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { verifySignature, verifySessionToken, isAdminWallet, type Session } from "./auth";
import { ADMIN_MESSAGE_PREFIX } from "./admin-message";

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

  // Fallback: allow the documented CLI admin keypair / dev admin wallet so the
  // panel keeps working before ADMIN_WALLET is set.
  const fallbackAdmins = ["2zPRxYVxFDUZn6QEYU2m6bzyZcN7pCCJ4E25gc2EQcCS"];
  const allowed = configured.length > 0 ? configured : fallbackAdmins;

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
