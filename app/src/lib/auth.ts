import { cookies } from "next/headers";
import { PublicKey } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import { sign } from "jsonwebtoken";
import { verify } from "jsonwebtoken";
import { randomBytes, randomUUID } from "crypto";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// Challenge nonce registry: nonce → expiry timestamp. A nonce is issued by
// generateChallenge, must be redeemed within NONCE_TTL_MS, and is consumed on
// first use (consume-once) so a captured signature can never be replayed.
// NOTE: in-memory Map — for multi-instance production deployments replace with
// a Redis key with the same TTL.
const NONCE_TTL_MS = 5 * 60 * 1000;
const nonceCache = new Map<string, number>();

/**
 * Session signing secret. In production a missing SESSION_SECRET is a fatal
 * configuration error — failing loudly is safer than silently signing
 * sessions with a well-known default (which would let anyone forge admin
 * sessions). In development a fallback keeps the local flow working.
 */
function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.trim().length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is not set (or is shorter than 16 chars). " +
      "The application refuses to start in production without a real signing secret."
    );
  }
  return "dev-secret-change-in-prod";
}

const SESSION_SECRET = sessionSecret();

export interface Session {
  wallet: string;
  username?: string;
  avatarUrl?: string;
  iat: number;
  exp: number;
}

export function generateChallenge(wallet: string): string {
  // Cryptographically random nonce (rule: no Math.random for application data).
  // A 128-bit random hex nonce prevents replay of old signed messages.
  const nonce = randomBytes(16).toString("hex");
  // Register the nonce with a 5-minute expiry so verifySignature can reject
  // stale or already-redeemed challenges.
  nonceCache.set(nonce, Date.now() + NONCE_TTL_MS);
  const issuedAt = new Date().toISOString();
  return [
    "solpredict.xyz wants you to sign in with your Solana account:",
    wallet,
    "",
    "Sign this message to prove ownership of this wallet.",
    "",
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    "Version: 1",
  ].join("\n");
}

export function verifySignature(message: string, signature: Uint8Array, wallet: PublicKey): boolean {
  try {
    // Challenge-format messages carry a `Nonce: <hex>` line. For those,
    // enforce consume-once + expiry: the nonce must have been issued by
    // generateChallenge, must not be expired, and is deleted on first use.
    // (Messages without a Nonce line — e.g. the SOLPredict admin/user request
    // format — are validated purely cryptographically as before.)
    const nonceMatch = /\bNonce:\s*([0-9a-fA-F]{8,})/.exec(message);
    if (nonceMatch) {
      const nonce = nonceMatch[1];
      const expiry = nonceCache.get(nonce);
      if (expiry === undefined || expiry < Date.now()) return false;
      nonceCache.delete(nonce); // consume-once: a signature can't be replayed
    }
    const messageBytes = new TextEncoder().encode(message);
    return ed25519.verify(signature, messageBytes, wallet.toBytes());
  } catch {
    return false;
  }
}

export function createSessionToken(payload: { wallet: string; username?: string; avatarUrl?: string }): string {
  return sign(
    {
      wallet: payload.wallet,
      username: payload.username,
      avatarUrl: payload.avatarUrl,
      iat: Date.now(),
      exp: Date.now() + SESSION_DURATION_MS,
    },
    SESSION_SECRET,
  );
}

export function verifySessionToken(token: string): Session | null {
  try {
    const decoded = verify(token, SESSION_SECRET) as Session;
    if (decoded.exp < Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value;
    if (!token) return null;
    return verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS / 1000,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

export function isAdmin(session: Session | null, adminWallets?: string[]): boolean {
  if (!session) return false;
  return isAdminWallet(session.wallet, adminWallets);
}

export function isAdminWallet(wallet: string | null | undefined, adminWallets?: string[]): boolean {
  if (!wallet) return false;
  const configured = adminWallets || (process.env.ADMIN_WALLET ? process.env.ADMIN_WALLET.split(",") : []);
  if (configured.length === 0) {
    // Fail CLOSED in production: with no admin wallets configured, nobody is
    // an admin. (The previous `return true` made every connected wallet an
    // admin whenever ADMIN_WALLET was unset — a critical authorization hole.)
    return process.env.NODE_ENV !== "production";
  }
  return configured.map(w => w.trim()).includes(wallet.trim());
}