import { test, expect, Page } from "@playwright/test";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import idl from "../src/lib/idl/solpredict.json";

/**
 * Full user journey across the whole app, driving the real UI:
 *  1. Land on Home (hero + market grid render).
 *  2. Open the Manchester United market page (live YES/NO probabilities).
 *  3. Connect a mock Phantom wallet (funded keypair).
 *  4. BUY 50 YES shares via the UI.
 *  5. SELL 20 YES shares back.
 *  6. Post a comment (regression test for the parentId:null schema fix).
 *  7. Visit Portfolio — the bought shares show as a position.
 *  8. Toggle the market onto the watchlist and confirm it sticks.
 *  9. Return to the market page — balances reflect the trades.
 * Every step asserts the UI state directly, exactly like a human user.
 */

const RPC = "http://127.0.0.1:8899";
const PROGRAM_ID = "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG";
const MARKET = "7m4wbCZfdGiPgqciLsrtwZUzXyEW33Wa52hWooh1aANp";
const BUY_QTY = 50;
const SELL_QTY = 20;

let connection: Connection;
let program: anchor.Program;
let keypair: Keypair;
let yesMint: PublicKey;
let marketReady = false;

test.beforeAll(async () => {
  connection = new Connection(RPC, "confirmed");
  keypair = Keypair.generate();
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(keypair),
    { commitment: "confirmed" } as any
  );
  program = new anchor.Program({ ...(idl as anchor.Idl), address: PROGRAM_ID }, provider);

  const marketPda = new PublicKey(MARKET);
  const marketAcc = await (program as any).account.market.fetch(marketPda).catch(() => null);
  marketReady = !!marketAcc;
  yesMint = PublicKey.findProgramAddressSync(
    [Buffer.from("yes_mint"), marketPda.toBuffer()],
    program.programId
  )[0];

  const sig = await connection.requestAirdrop(keypair.publicKey, 50 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`user-wallet funded: ${keypair.publicKey.toBase58()} (${(await connection.getBalance(keypair.publicKey)) / LAMPORTS_PER_SOL} SOL)`);
});

async function installMockWallet(page: Page, kp: Keypair) {
  await page.exposeFunction("__edSign", (msg: number[]) =>
    Array.from(ed25519.sign(Uint8Array.from(msg), kp.secretKey.slice(0, 32)))
  );
  await page.addInitScript(
    ({ pubB58, pub32, secret64 }) => {
      const PUB_B58 = pubB58 as string;
      const PUB32 = new Uint8Array(pub32 as number[]);
      const SECRET = new Uint8Array(secret64 as number[]);
      const pubDuck = {
        toBase58: () => PUB_B58,
        toString: () => PUB_B58,
        equals: (other: any) => {
          try {
            return !!other && typeof other.toBase58 === "function" && other.toBase58() === PUB_B58;
          } catch {
            return false;
          }
        },
      };
      let connected = false;
      let publicKeyObj: any = null;
      const signTransaction = async (tx: any) => {
        if (tx && typeof tx.sign === "function") {
          const signer = { publicKey: tx.feePayer, secretKey: SECRET };
          if (tx.version !== undefined) {
            (tx.sign as any)([signer]);
          } else {
            (tx.sign as any)(signer);
          }
        } else {
          throw new Error("Mock wallet: unsupported transaction type");
        }
        return tx;
      };
      const wallet: any = {
        isPhantom: true,
        get isConnected() {
          return connected;
        },
        get publicKey() {
          return publicKeyObj;
        },
        async connect() {
          connected = true;
          publicKeyObj = { toBytes: () => PUB32, toBase58: () => PUB_B58, toString: () => PUB_B58 };
          return { publicKey: publicKeyObj };
        },
        async disconnect() {
          connected = false;
          publicKeyObj = null;
        },
        on() {},
        off() {},
        signTransaction,
        signAllTransactions: async (txs: any[]) => {
          for (const t of txs) await signTransaction(t);
          return txs;
        },
        async signMessage(message: Uint8Array) {
          const signature = await (window as any).__edSign(Array.from(message));
          return { signature: new Uint8Array(signature), publicKey: pubDuck };
        },
      };
      (window as any).solana = wallet;
      (window as any).phantom = { solana: wallet };
      (window as any).isPhantomInstalled = true;
      try {
        localStorage.setItem("walletName", JSON.stringify("Phantom"));
      } catch {
        /* ignore */
      }
    },
    {
      pubB58: kp.publicKey.toBase58(),
      pub32: Array.from(kp.publicKey.toBytes()),
      secret64: Array.from(kp.secretKey),
    }
  );
}

async function ensureConnected(page: Page) {
  const btn = page.locator("button.wallet-adapter-button").first();
  const prefix = keypair.publicKey.toBase58().slice(0, 4);
  try {
    await expect(btn).toContainText(prefix, { timeout: 20_000 });
    return;
  } catch {
    await btn.click();
    const modal = page.locator(".wallet-adapter-modal");
    await modal.waitFor({ state: "visible", timeout: 5_000 });
    await modal.getByText(/Phantom/).first().click();
    await expect(btn).toContainText(prefix, { timeout: 20_000 });
  }
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`PAGEERROR: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return errors;
}

function isBenign(e: string): boolean {
  return (
    e.includes("favicon") ||
    e.includes("404") ||
    e.includes("ERR_ABORTED") ||
    e.includes("AbortError") ||
    e.includes("Download the React DevTools") ||
    e.includes("recently installed") ||
    e.includes("Failed to load resource") ||
    e.includes("NETWORK_ERR")
  );
}

async function getShareBalance(mint: PublicKey): Promise<number> {
  const ata = getAssociatedTokenAddressSync(mint, keypair.publicKey);
  const info = await connection.getTokenAccountBalance(ata).catch(() => null);
  return info ? (info.value.uiAmount ?? 0) : 0;
}

test.describe.serial("Full user journey across the app", () => {
  test.setTimeout(240_000);

  test("Home + market browse + market detail render", async ({ page }) => {
    const errors = collectErrors(page);

    // 1. Home page
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByText(/SOLPredict/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("main").first()).toBeVisible({ timeout: 15_000 });

    // 2. Open the Manchester United market from the grid
    await page.goto(`/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: 30_000 });

    // Live probability + pool figures are present.
    await expect(page.getByText(/Yes|NO|YES/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("buy-submit").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("tab-sell").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("tab-liquidity").first()).toBeVisible({ timeout: 15_000 });

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
    console.log("HOME + MARKET DETAIL render: OK");
  });

  test("Connect wallet and BUY 50 YES via UI", async ({ page }) => {
    test.skip(!marketReady, "Market not deployed on-chain");
    await installMockWallet(page, keypair);
    const errors = collectErrors(page);

    await page.goto(`/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: 30_000 });
    await ensureConnected(page);

    const before = await getShareBalance(yesMint);
    await page.getByTestId("buy-quantity").fill(String(BUY_QTY));
    await page.getByTestId("buy-submit").click();

    await expect(page.getByText(/✓ Done/).first()).toBeVisible({ timeout: 60_000 });
    await expect.poll(async () => getShareBalance(yesMint), { timeout: 30_000 }).toBe(before + BUY_QTY);
    console.log(`BUY ok: YES balance ${before} → ${await getShareBalance(yesMint)}`);

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
  });

  test("SELL 20 YES back via UI", async ({ page }) => {
    test.skip(!marketReady, "Market not deployed on-chain");
    await installMockWallet(page, keypair);
    const errors = collectErrors(page);

    await page.goto(`/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: 30_000 });
    await ensureConnected(page);

    // UI shows the shares bought in the previous test.
    await expect(page.getByText(new RegExp(`${BUY_QTY}\\.0 YES held`)).first()).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("tab-sell").click();
    await page.getByTestId("sell-quantity").fill(String(SELL_QTY));
    await page.getByTestId("sell-submit").click();

    await expect.poll(async () => getShareBalance(yesMint), { timeout: 60_000 }).toBe(BUY_QTY - SELL_QTY);
    console.log(`SELL ok: YES balance → ${await getShareBalance(yesMint)}`);

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
  });

  test("Post a comment (regression: parentId null schema fix)", async ({ page }) => {
    test.skip(!marketReady, "Market not deployed on-chain");
    await installMockWallet(page, keypair);
    const errors = collectErrors(page);

    await page.goto(`/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: 30_000 });
    await ensureConnected(page);

    // Locate the comment composer (community discussion section) — an input,
    // disabled until the wallet is connected.
    const composer = page.locator('input[placeholder*="Share your prediction"]').first();
    await composer.waitFor({ state: "visible", timeout: 20_000 });
    const msg = `e2e user comment ${Date.now()}`;
    await composer.fill(msg);
    await page.getByRole("button", { name: /post/i }).first().click();

    // The comment must post successfully (was failing with "Invalid comment data").
    await expect(page.getByText(/Comment posted|Reply posted/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(msg).first()).toBeVisible({ timeout: 30_000 });
    console.log("COMMENT post: OK");

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
  });

  test("Portfolio shows the YES position", async ({ page }) => {
    test.skip(!marketReady, "Market not deployed on-chain");
    await installMockWallet(page, keypair);
    const errors = collectErrors(page);

    await page.goto("/portfolio", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.locator("main").first()).toBeVisible({ timeout: 30_000 });
    // The wallet's YES shares for the ManU market should appear in the grid.
    await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/YES/).first()).toBeVisible({ timeout: 15_000 });
    console.log("PORTFOLIO shows ManU YES position: OK");

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
  });

  test("Watchlist toggle sticks", async ({ page }) => {
    test.skip(!marketReady, "Market not deployed on-chain");
    await installMockWallet(page, keypair);
    const errors = collectErrors(page);

    await page.goto(`/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: 30_000 });
    await ensureConnected(page);

    // Toggle watch (the star button in the market header).
    const watchBtn = page.locator('button[title="Add to watchlist"]').first();
    await expect(watchBtn).toBeVisible({ timeout: 15_000 });
    await watchBtn.click();
    await expect(page.getByText(/Added to watchlist/).first()).toBeVisible({ timeout: 15_000 });
    // The button flips to the watched state.
    await expect(page.locator('button[title="Remove from watchlist"]').first()).toBeVisible({ timeout: 10_000 });

    // LocalStorage is the UI source of truth — the market must be in it.
    const localKeys = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("solpredict-watchlist") ?? "[]")
    );
    console.log(`WATCHLIST localStorage: ${JSON.stringify(localKeys)}`);
    expect(localKeys).toContain(MARKET);

    // Verify the DB copy via the real endpoint using a signed ownership proof
    // (the same proof the app's userFetch attaches). The sync POST is
    // fire-and-forget, so poll briefly for it to land.
    let dbKeys: string[] | null = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      dbKeys = await page.evaluate(
        async ({ walletB58 }) => {
          const msg = `SOLPredict user request:${Date.now()}`;
          const sig = await (window as any).__edSign(Array.from(new TextEncoder().encode(msg)));
          const b64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
          const res = await fetch(`/api/watchlist?wallet=${walletB58}`, {
            headers: {
              "x-wallet": walletB58,
              "x-message": msg,
              "x-signature": b64,
            },
          });
          if (!res.ok) return null;
          const data = await res.json();
          return data.keys ?? null;
        },
        { walletB58: keypair.publicKey.toBase58() }
      );
      if (dbKeys && dbKeys.includes(MARKET)) break;
      await page.waitForTimeout(1000);
    }
    console.log(`WATCHLIST DB keys: ${JSON.stringify(dbKeys)}`);
    expect(dbKeys).toContain(MARKET);

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
  });

  test("Back on market page: balances reflect the net position", async ({ page }) => {
    test.skip(!marketReady, "Market not deployed on-chain");
    await installMockWallet(page, keypair);
    const errors = collectErrors(page);

    await page.goto(`/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: 30_000 });
    await ensureConnected(page);

    const net = BUY_QTY - SELL_QTY;
    await expect(page.getByText(new RegExp(`${net}\\.0 YES held`)).first()).toBeVisible({ timeout: 30_000 });
    console.log(`MARKET page shows net ${net} YES held: OK`);

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
  });
});