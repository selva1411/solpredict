import { cookies } from "next/headers";
import { PublicKey } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import { sign } from "jsonwebtoken";
import { verify } from "jsonwebtoken";

const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-in-prod";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export interface Session {
  wallet: string;
  username?: string;
  avatarUrl?: string;
  iat: number;
  exp: number;
}

export function generateChallenge(wallet: string): string {
  const nonce = Math.random().toString(36).slice(2, 10);
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
  const wallets = adminWallets || (process.env.ADMIN_WALLET ? [process.env.ADMIN_WALLET] : []);
  return wallets.includes(session.wallet);
}