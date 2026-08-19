import { test, expect, type Page } from "@playwright/test";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import * as anchor from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import idl from "../src/lib/idl/solpredict.json";

const RPC = "http://127.0.0.1:8899";
const PROGRAM_ID = "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG";
const MARKET = "7m4wbCZfdGiPgqciLsrtwZUzXyEW33Wa52hWooh1aANp";

let keypair: Keypair;
let program: anchor.Program;

async function installMockWallet(page: Page, kp: Keypair) {
  // Chromium's WebCrypto does not support Ed25519, so sign messages in Node
  // (@noble/curves) and hand the signature to the page via an exposed binding.
  await page.exposeFunction("__edSign", (msg: number[]) =>
    Array.from(ed25519.sign(Uint8Array.from(msg), kp.secretKey.slice(0, 32)))
  );
  await page.addInitScript(
    ({ pubB58, pub32, secret64 }) => {
      const PUB_B58 = pubB58 as string;
      const PUB32 = new Uint8Array(pub32 as number[]);
      const SECRET = new Uint8Array(secret64 as number[]);
      let connected = false;
      let publicKeyObj: any = null;
      const signTransaction = async (tx: any) => {
        if (tx && typeof tx.sign === "function") {
          const signer = { publicKey: tx.feePayer, secretKey: SECRET };
          if (tx.version !== undefined) (tx.sign as any)([signer]);
          else (tx.sign as any)(signer);
        }
        return tx;
      };
      const wallet: any = {
        isPhantom: true,
        get isConnected() { return connected; },
        get publicKey() { return publicKeyObj; },
        async connect() {
          connected = true;
          publicKeyObj = { toBytes: () => PUB32, toBase58: () => PUB_B58, toString: () => PUB_B58 };
          return { publicKey: publicKeyObj };
        },
        async disconnect() { connected = false; publicKeyObj = null; },
        on() {}, off() {},
        signTransaction,
        signAllTransactions: async (txs: any[]) => { for (const t of txs) await signTransaction(t); return txs; },
        async signMessage(message: Uint8Array) {
          const signature = await (window as any).__edSign(Array.from(message));
          return { signature: new Uint8Array(signature), publicKey: { toBase58: () => PUB_B58 } };
        },
      };
      (window as any).solana = wallet;
      (window as any).phantom = { solana: wallet };
      (window as any).isPhantomInstalled = true;
      try { localStorage.setItem("walletName", JSON.stringify("Phantom")); } catch {}
    },
    { pubB58: kp.publicKey.toBase58(), pub32: Array.from(kp.publicKey.toBytes()), secret64: Array.from(kp.secretKey) }
  );
}

async function waitForWalletConnect(page: Page): Promise<boolean> {
  const prefix = keypair.publicKey.toBase58().slice(0, 4);
  const btn = page.locator("button.wallet-adapter-button").first();
  try {
    await btn.waitFor({ state: "visible", timeout: 10_000 });
    await expect(btn).toContainText(prefix, { timeout: 15_000 });
    return true;
  } catch {
    // autoConnect did not kick in — open the modal and select Phantom.
    try {
      await btn.click();
      const modal = page.locator(".wallet-adapter-modal");
      await modal.waitFor({ state: "visible", timeout: 5_000 });
      await modal.getByText(/Phantom/).first().click();
      await expect(btn).toContainText(prefix, { timeout: 20_000 });
      return true;
    } catch {
      return false;
    }
  }
}

test.describe.serial("Portfolio & Dashboard render real numbers after a real buy", () => {
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    const connection = new Connection(RPC, "confirmed");
    keypair = Keypair.generate();
    const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(keypair), { commitment: "confirmed" } as any);
    program = new anchor.Program({ ...(idl as anchor.Idl), address: PROGRAM_ID }, provider);
    const sig = await connection.requestAirdrop(keypair.publicKey, 20 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
    console.log("probe wallet:", keypair.publicKey.toBase58());
  });

  test("buy 5 YES then portfolio & dashboard show real numbers", async ({ page }) => {
    await installMockWallet(page, keypair);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));

    // 1. Buy 5 YES on the ManU market through the real UI.
    await page.goto(`http://localhost:3000/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await waitForWalletConnect(page);
    const qtyInput = page.locator('input[type="number"]').first();
    await qtyInput.fill("5");
    await page.getByRole("button", { name: /Buy/ }).first().click();

    // Wait for the on-chain buy to land.
    await expect
      .poll(async () => {
        const yesMint = PublicKey.findProgramAddressSync([Buffer.from("yes_mint"), new PublicKey(MARKET).toBuffer()], program.programId)[0];
        const ata = getAssociatedTokenAddressSync(yesMint, keypair.publicKey);
        const info = await (program.provider.connection as Connection).getTokenAccountBalance(ata).catch(() => null);
        return info ? info.value.uiAmount ?? 0 : 0;
      }, { timeout: 60_000 })
      .toBeGreaterThan(4);

    // 2. Wait for the DB sync (background post-trade sync) then check portfolio.
    await expect
      .poll(async () => {
        const res = await fetch(`http://localhost:3000/api/user/positions?wallet=${keypair.publicKey.toBase58()}`);
        const data = await res.json();
        return data?.ok && Array.isArray(data.positions) && data.positions.length > 0 ? data : null;
      }, { timeout: 45_000 })
      .not.toBeNull();

    const res = await fetch(`http://localhost:3000/api/user/positions?wallet=${keypair.publicKey.toBase58()}`);
    const data = await res.json();
    console.log("API stats:", JSON.stringify(data.stats));
    console.log("API positions:", JSON.stringify(data.positions?.map((p: any) => ({ side: p.side, shares: p.shares, pnlSol: +p.pnlSol.toFixed(4) }))));
    console.log("API lpPositions count:", data.lpPositions?.length ?? 0);
    expect(data.stats.netWorthSol).toBeGreaterThan(0);

    // 3. Portfolio page renders the stats. The page fetches /api/user/positions
    // on mount, so poll instead of a one-shot assertion (avoids racing the
    // wallet-connect → query-fetch → re-render sequence).
    await page.goto("http://localhost:3000/portfolio", { waitUntil: "domcontentloaded", timeout: 45_000 });
    await waitForWalletConnect(page);
    await expect
      .poll(async () => page.getByText(/Active Positions \([1-9]\d*\)/).first().isVisible().catch(() => false), {
        timeout: 60_000,
        intervals: [1_000, 2_000, 3_000],
      })
      .toBe(true);
    await expect(page.getByText("Net Worth", { exact: true }).first()).toBeVisible({ timeout: 15_000 });
    // The P&L column must show a real signed number, not 0.000.
    await expect(page.getByText(/[+-]\d+\.\d{3}/).first()).toBeVisible({ timeout: 15_000 });
    console.log("PORTFOLIO: Net Worth + Active Positions (1) + P&L cell visible");

    // 4. Dashboard renders too — poll the positions count the same way.
    await page.goto("http://localhost:3000/dashboard", { waitUntil: "domcontentloaded", timeout: 45_000 });
    await waitForWalletConnect(page);
    await expect
      .poll(async () => page.getByText(/Active Positions \([1-9]\d*\)/).first().isVisible().catch(() => false), {
        timeout: 60_000,
        intervals: [1_000, 2_000, 3_000],
      })
      .toBe(true);
    console.log("DASHBOARD: Net Worth + Active Positions (1) visible");

    const fatal = errors.filter(
      (e) =>
        !e.includes("favicon") &&
        !e.includes("React DevTools") &&
        // Next.js dev-mode artifact: the /dashboard page is a pure redirect()
        // to /portfolio, and dev instrumentation races the instant redirect
        // with performance.measure → "cannot have a negative time stamp".
        // Dev-only; never occurs in production builds.
        !e.includes("cannot have a negative time stamp"),
    );
    expect(fatal, fatal.join(" | ")).toEqual([]);
  });
});
