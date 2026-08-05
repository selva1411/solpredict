import { describe, it, expect, vi, afterEach } from "vitest";
import { Keypair } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import { requireAdmin } from "./admin-guard";
import { buildAdminMessage } from "./admin-message";
import { createSessionToken } from "./auth";
import { NextRequest } from "next/server";

function makeRequest(headers: Record<string, string>, cookies = ""): NextRequest {
  const url = "http://localhost/api/test";
  const req = new NextRequest(url, { headers });
  if (cookies) {
    Object.defineProperty(req, "cookies", { value: { get: () => ({ value: cookies }) } });
  }
  return req;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requireAdmin", () => {
  it("rejects with 401 when no auth provided in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await requireAdmin(makeRequest({}));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(401);
  });

  it("rejects non-admin wallet signature", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ADMIN_WALLET", Keypair.generate().publicKey.toBase58());
    const stranger = Keypair.generate();
    const message = buildAdminMessage("1234");
    const signature = ed25519.sign(new TextEncoder().encode(message), stranger.secretKey.slice(0, 32));
    const res = await requireAdmin(
      makeRequest({
        "x-wallet": stranger.publicKey.toBase58(),
        "x-message": message,
        "x-signature": Buffer.from(signature).toString("base64"),
      }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(403);
  });

  it("accepts a valid signature from the configured admin wallet", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const admin = Keypair.generate();
    vi.stubEnv("ADMIN_WALLET", admin.publicKey.toBase58());

    const message = buildAdminMessage("5678");
    const signature = ed25519.sign(new TextEncoder().encode(message), admin.secretKey.slice(0, 32));
    const res = await requireAdmin(
      makeRequest({
        "x-wallet": admin.publicKey.toBase58(),
        "x-message": message,
        "x-signature": Buffer.from(signature).toString("base64"),
      }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.identity.method).toBe("signature");
  });

  it("rejects a signature over a wrong message format", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const admin = Keypair.generate();
    vi.stubEnv("ADMIN_WALLET", admin.publicKey.toBase58());

    const message = "unrelated message";
    const signature = ed25519.sign(new TextEncoder().encode(message), admin.secretKey.slice(0, 32));
    const res = await requireAdmin(
      makeRequest({
        "x-wallet": admin.publicKey.toBase58(),
        "x-message": message,
        "x-signature": Buffer.from(signature).toString("base64"),
      }),
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.response.status).toBe(401);
  });

  it("accepts a session cookie for an admin wallet", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "test-secret");
    const admin = Keypair.generate();
    vi.stubEnv("ADMIN_WALLET", admin.publicKey.toBase58());
    const token = createSessionToken({ wallet: admin.publicKey.toBase58() });
    const res = await requireAdmin(makeRequest({}, token));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.identity.method).toBe("session");
  });

  it("allows requests in development without auth", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const res = await requireAdmin(makeRequest({}));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.identity.method).toBe("dev");
  });
});
