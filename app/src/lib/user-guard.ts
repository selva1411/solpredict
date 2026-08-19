import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { verifySignature, verifySessionToken, type Session } from "./auth";
import { USER_MESSAGE_PREFIX } from "./user-message";

export interface UserIdentity {
  wallet: string;
  method: "signature" | "session" | "dev";
}

function userResponse(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Server-side guard for wallet-scoped user routes.
 *
 * Verifies that the caller really owns the wallet they are acting on behalf
 * of, closing the IDOR hole where a client could pass any `?wallet=` (or body
 * `wallet`) and read/modify another user's data. Accepts either:
 *  1. A wallet-signed proof of ownership via `x-wallet`, `x-message`,
 *     `x-signature` headers (message must be signed by the wallet itself), or
 *  2. A valid session cookie whose wallet matches `expectedWallet`.
 *
 * When `expectedWallet` is given (the wallet the request claims to target),
 * the verified identity MUST match it — otherwise the request is rejected.
 * In production authentication is always required.
 */
export async function requireUser(
  req: NextRequest,
  expectedWallet?: string,
): Promise<{ ok: true; identity: UserIdentity } | { ok: false; response: NextResponse }> {
  // Development (localnet): the wallet adapter signs via the browser, but the
  // seed/tests exercise the endpoints directly. Skip proof-of-ownership in
  // development only; production below always enforces it.
  if (process.env.NODE_ENV === "development") {
    const wallet = expectedWallet ?? req.headers.get("x-wallet") ?? "dev";
    return { ok: true, identity: { wallet, method: "dev" } };
  }

  // Path 1: signed proof of ownership.
  const wallet = req.headers.get("x-wallet")?.trim();
  const message = req.headers.get("x-message");
  const signature = req.headers.get("x-signature");

  if (wallet && message && signature) {
    if (expectedWallet && wallet !== expectedWallet) {
      return { ok: false, response: userResponse(403, "Wallet does not match request target") };
    }
    let pubkey: PublicKey;
    try {
      pubkey = new PublicKey(wallet);
    } catch {
      return { ok: false, response: userResponse(401, "Invalid wallet address") };
    }
    if (!message.startsWith(USER_MESSAGE_PREFIX)) {
      return { ok: false, response: userResponse(401, "Invalid message format") };
    }
    let sigBytes: Uint8Array;
    try {
      sigBytes = Buffer.from(signature, "base64");
    } catch {
      return { ok: false, response: userResponse(401, "Invalid signature encoding") };
    }
    if (!verifySignature(message, sigBytes, pubkey)) {
      return { ok: false, response: userResponse(401, "Signature verification failed") };
    }
    return { ok: true, identity: { wallet, method: "signature" } };
  }

  // Path 2: session cookie.
  const token = req.cookies.get("session")?.value;
  if (token) {
    const session: Session | null = verifySessionToken(token);
    if (session) {
      if (expectedWallet && session.wallet !== expectedWallet) {
        return { ok: false, response: userResponse(403, "Wallet does not match request target") };
      }
      return { ok: true, identity: { wallet: session.wallet, method: "session" } };
    }
  }

  return { ok: false, response: userResponse(401, "User authentication required") };
}