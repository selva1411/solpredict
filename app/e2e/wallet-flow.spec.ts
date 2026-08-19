import { test, expect, Page } from "@playwright/test";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import idl from "../src/lib/idl/solpredict.json";

/**
 * End-to-end wallet UI flow against the localnet validator:
 *  1. A fresh keypair is generated + funded (50 SOL airdrop).
 *  2. A mock "Phantom" injected wallet is installed in the browser BEFORE the
 *     app bundle loads, so the wallet adapter auto-connects.
 *  3. The real market page UI is driven: BUY 100 YES → SELL 40 YES → LP 0.5 SOL.
 *  4. Every step is verified on-chain (token balances + pool reserves) and the
 *     browser console is asserted to be free of fatal errors.
 *
 * The mock signs with the real ed25519 keypair via web3.js's bundled tweetnacl
 * (Transaction.sign), so the produced signatures are cryptographically valid.
 */

const RPC = "http://127.0.0.1:8899";
const PROGRAM_ID = "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG";
const MARKET = "7m4wbCZfdGiPgqciLsrtwZUzXyEW33Wa52hWooh1aANp";
const BUY_QTY = 100;
const SELL_QTY = 40;
const LP_SOL = 0.5;

let connection: Connection;
let program: anchor.Program;
let keypair: Keypair;
let yesMint: PublicKey;
let noMint: PublicKey;
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
  noMint = PublicKey.findProgramAddressSync(
    [Buffer.from("no_mint"), marketPda.toBuffer()],
    program.programId
  )[0];

  const sig = await connection.requestAirdrop(keypair.publicKey, 50 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
  console.log(
    `wallet ${keypair.publicKey.toBase58()} funded: ${(await connection.getBalance(keypair.publicKey)) / LAMPORTS_PER_SOL} SOL`
  );
});

/** Install a mock Phantom injected-wallet before the app bundle runs. */
async function installMockWallet(page: Page, kp: Keypair) {
  // Chromium's WebCrypto does not support Ed25519, so sign messages in Node
  // (@noble/curves) and hand the signature to the page via an exposed binding.
  await page.exposeFunction("__edSign", (msg: number[]) =>
    Array.from(ed25519.sign(Uint8Array.from(msg), kp.secretKey.slice(0, 32)))
  );
  await page.addInitScript(
    ({ pubB58, pub32, secret64, seed32 }) => {
      const PUB_B58 = pubB58 as string;
      const PUB32 = new Uint8Array(pub32 as number[]);
      const SECRET = new Uint8Array(secret64 as number[]);
      const SEED = new Uint8Array(seed32 as number[]);

      const pubDuck = {
        toBase58: () => PUB_B58,
        toString: () => PUB_B58,
        equals: (other: any) => {
          try {
            return (
              !!other &&
              typeof other.toBase58 === "function" &&
              other.toBase58() === PUB_B58
            );
          } catch {
            return false;
          }
        },
      };

      let connected = false;
      let publicKeyObj: any = null;

      const signTransaction = async (tx: any) => {
        if (tx && typeof tx.sign === "function") {
          // Use tx.feePayer (a REAL web3.js PublicKey) as the signer key.
          // web3.js's PublicKey.equals accesses `this._bn` directly, so a
          // duck-typed publicKey crashes (Cannot read 'negative' of undefined).
          // Anchor always sets tx.feePayer = wallet.publicKey before signing.
          const signer = { publicKey: tx.feePayer, secretKey: SECRET };
          if (tx.version !== undefined) {
            // VersionedTransaction: sign(signers: Signer[])
            (tx.sign as any)([signer]);
          } else {
            // Legacy Transaction: sign(...signers) — spread, NOT an array
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
          publicKeyObj = {
            toBytes: () => PUB32,
            toBase58: () => PUB_B58,
            toString: () => PUB_B58,
          };
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
      seed32: Array.from(kp.secretKey.slice(0, 32)),
    }
  );
}

/** Wait until the WalletMultiButton shows the connected wallet address. */
async function ensureConnected(page: Page) {
  const btn = page.locator("button.wallet-adapter-button").first();
  const prefix = keypair.publicKey.toBase58().slice(0, 4);
  try {
    await expect(btn).toContainText(prefix, { timeout: 20_000 });
    return;
  } catch {
    // autoConnect did not kick in — open the modal and select Phantom.
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
    e.includes("Download the React DevTools")
  );
}

async function getPools(): Promise<{ yes: number; no: number }> {
  const m = await (program as any).account.market.fetch(new PublicKey(MARKET));
  return {
    yes: m.yesPoolLamports.toNumber() / 1e9,
    no: m.noPoolLamports.toNumber() / 1e9,
  };
}

async function getShareBalance(mint: PublicKey): Promise<number> {
  const ata = getAssociatedTokenAddressSync(mint, keypair.publicKey);
  const info = await connection.getTokenAccountBalance(ata).catch(() => null);
  return info ? (info.value.uiAmount ?? 0) : 0;
}

test.describe.serial("Wallet UI flow: buy / sell / LP on-chain", () => {
  test.setTimeout(180_000);

  test("BUY 100 YES shares via UI and verify on-chain", async ({ page }) => {
    test.skip(!marketReady, "Manchester United market is not deployed on-chain");
    await installMockWallet(page, keypair);
    const errors = collectErrors(page);
    const perf: string[] = [];
    page.on("console", (m) => { const t = m.text(); if (t.includes("[perf]")) perf.push(t); });

    const poolsBefore = await getPools();
    await page.goto(`/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

    await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: 30_000 });
    await ensureConnected(page);

    const tClick = Date.now();
    await page.getByTestId("buy-quantity").fill(String(BUY_QTY));
    await page.getByTestId("buy-submit").click();

    await expect(page.getByText(/✓ Done/).first()).toBeVisible({ timeout: 60_000 });
    console.log(`BUY click->success: ${Date.now() - tClick}ms | perf: ${JSON.stringify(perf)}`);

    await expect.poll(async () => getShareBalance(yesMint), { timeout: 30_000 }).toBe(BUY_QTY);
    const poolsAfter = await getPools();

    // CONSISTENCY: the DB cache (markets_cache) must reflect the exact on-chain
    // pools so home / /markets / detail / related-markets all render the same
    // numbers. The UI syncs real lamports after every trade.
    await expect
      .poll(async () => {
        const res = await fetch(`http://localhost:3000/api/markets/cached?status=open&limit=100`);
        // 429 (rate limit) is transient — retry rather than fail.
        if (res.status === 429) return null;
        if (!res.ok) return null;
        const data = await res.json();
        const row = (data.markets ?? []).find((m: any) => m.marketPubkey === MARKET);
        return row ? { yes: Number(row.yesPoolLamports ?? 0), no: Number(row.noPoolLamports ?? 0) } : null;
      }, { timeout: 60_000, intervals: [1_000, 2_000, 3_000] })
      .toEqual({ yes: Math.round(poolsAfter.yes * 1e9), no: Math.round(poolsAfter.no * 1e9) });

    expect(poolsAfter.yes).toBeGreaterThan(poolsBefore.yes);
    // One-sided pool model: buying YES only credits the YES pool; the NO pool
    // is used for CPMM pricing but is NOT debited on a buy.
    expect(poolsAfter.no).toBeCloseTo(poolsBefore.no, 6);
    console.log(
      `BUY ok: yesPool ${poolsBefore.yes.toFixed(3)} → ${poolsAfter.yes.toFixed(3)}, ` +
        `noPool ${poolsBefore.no.toFixed(3)} → ${poolsAfter.no.toFixed(3)}, ` +
        `YES balance = ${await getShareBalance(yesMint)}`
    );

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
  });

  test("SELL 40 YES shares via UI and verify on-chain", async ({ page }) => {
    test.skip(!marketReady, "Manchester United market is not deployed on-chain");
    await installMockWallet(page, keypair);
    const errors = collectErrors(page);

    const poolsBefore = await getPools();
    await page.goto(`/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

    await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: 30_000 });
    await ensureConnected(page);

    // UI balance must refresh to the 100 shares bought in the previous test.
    await expect(page.getByText(/100\.0 YES held/).first()).toBeVisible({ timeout: 30_000 });

    await page.getByTestId("tab-sell").click();
    await expect(page.getByText("100.0").first()).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("sell-quantity").fill(String(SELL_QTY));
    await page.getByTestId("sell-submit").click();

    await expect
      .poll(async () => getShareBalance(yesMint), { timeout: 60_000 })
      .toBe(BUY_QTY - SELL_QTY);

    const poolsAfter = await getPools();
    expect(poolsAfter.yes).toBeLessThan(poolsBefore.yes);
    expect(poolsAfter.no).toBeCloseTo(poolsBefore.no, 6);
    console.log(
      `SELL ok: yesPool ${poolsBefore.yes.toFixed(3)} → ${poolsAfter.yes.toFixed(3)}, ` +
        `noPool ${poolsBefore.no.toFixed(3)} → ${poolsAfter.no.toFixed(3)}, ` +
        `YES balance = ${await getShareBalance(yesMint)}`
    );

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
  });

  test("LP deposit 0.5 SOL (balanced) via UI and verify on-chain", async ({ page }) => {
    test.skip(!marketReady, "Manchester United market is not deployed on-chain");
    await installMockWallet(page, keypair);
    const errors = collectErrors(page);

    const poolsBefore = await getPools();
    await page.goto(`/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 30_000 });

    await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: 30_000 });
    await ensureConnected(page);

    await page.getByTestId("tab-liquidity").click();
    await page.getByTestId("lp-amount").fill(String(LP_SOL));
    await page.getByTestId("lp-submit").click();

    await expect(page.getByText(/Successfully deposited/).first()).toBeVisible({ timeout: 60_000 });

    // Balanced 0.5 SOL → 0.25 into each pool.
    await expect
      .poll(async () => (await getPools()).yes, { timeout: 60_000 })
      .toBeGreaterThan(poolsBefore.yes + 0.24);
    const poolsAfter = await getPools();
    expect(poolsAfter.no).toBeGreaterThan(poolsBefore.no + 0.24);
    console.log(
      `LP ok: yesPool ${poolsBefore.yes.toFixed(3)} → ${poolsAfter.yes.toFixed(3)}, ` +
        `noPool ${poolsBefore.no.toFixed(3)} → ${poolsAfter.no.toFixed(3)}`
    );

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
  });

  test("LP with an UNFUNDED wallet shows a friendly error (not the cryptic runtime error)", async ({ page }) => {
    test.skip(!marketReady, "Manchester United market is not deployed on-chain");
    // Fresh keypair with NO airdrop → 0 SOL balance.
    const broke = Keypair.generate();
    const bal = await connection.getBalance(broke.publicKey);
    console.log(`broke wallet balance: ${bal / LAMPORTS_PER_SOL} SOL`);
    await installMockWallet(page, broke);

    await page.goto(`/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: 30_000 });
    const btn = page.locator("button.wallet-adapter-button").first();
    await expect(btn).toContainText(broke.publicKey.toBase58().slice(0, 4), { timeout: 20_000 });

    await page.getByTestId("tab-liquidity").click();
    await page.getByTestId("lp-amount").fill("0.5");
    await page.getByTestId("lp-submit").click();

    // The pre-flight balance check should show a friendly toast.
    await expect(page.getByText(/Insufficient SOL for providing liquidity/).first()).toBeVisible({
      timeout: 20_000,
    });
    console.log("INSUFFICIENT-FUNDS UX: OK");
  });

  test("BUY auto-retries with a fresh blockhash when the tx blockhash expires", async ({ page }) => {
    test.skip(!marketReady, "Manchester United market is not deployed on-chain");
    await installMockWallet(page, keypair);
    const errors = collectErrors(page);

    // Simulate the exact failure a real Phantom user hits: the blockhash is
    // fetched, but wallet approval/signing outlives its ~60s localnet lifetime.
    // The FIRST sendTransaction RPC call fails with "Blockhash not found"; the
    // app must transparently retry with a fresh blockhash and land the tx on
    // the second attempt.
    let failedOnce = false;
    await page.route("**/api/rpc", async (route) => {
      const post = route.request().postDataJSON() as { method?: string; id?: number } | null;
      if (post?.method === "sendTransaction" && !failedOnce) {
        failedOnce = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: post.id ?? 1,
            error: { code: -32015, message: "Transaction simulation failed: Blockhash not found" },
          }),
        });
        return;
      }
      await route.continue();
    });

    const before = await getShareBalance(yesMint);
    await page.goto(`/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: 30_000 });
    await ensureConnected(page);

    await page.getByTestId("buy-quantity").fill(String(BUY_QTY));
    await page.getByTestId("buy-submit").click();

    // First attempt failed (simulated) — the retry must succeed.
    await expect(page.getByText(/✓ Done/).first()).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(async () => getShareBalance(yesMint), { timeout: 30_000 })
      .toBe(before + BUY_QTY);

    expect(failedOnce, "the first sendTransaction must have been intercepted").toBe(true);
    const pools = await getPools();
    console.log(
      `BLOCKHASH-RETRY ok: first send failed, retry landed (YES balance ${before + BUY_QTY}, yesPool ${pools.yes.toFixed(3)})`
    );

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
  });

  test("PLACE a limit buy order via UI, see it in My Orders, then CANCEL it", async ({ page }) => {
    test.skip(!marketReady, "Manchester United market is not deployed on-chain");
    await installMockWallet(page, keypair);
    const errors = collectErrors(page);

    // Pre-trade: the wallet holds shares from prior tests, so it can afford
    // the escrow for a limit order.
    await page.goto(`/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: 30_000 });
    await ensureConnected(page);

    // Open the Advanced panel and flip the limit-order switch (a real button,
    // not the adjacent label text).
    await page.getByText("Advanced: Limit Order").click();
    await page.getByTestId("limit-toggle").click();

    // Set a limit price BELOW the current spot so the order stays open
    // (a resting bid, not immediately matchable by the AMM).
    await page.getByTestId("limit-price").fill("0.10");

    // Fill quantity in the buy tab.
    await page.getByTestId("buy-quantity").fill("25");
    await page.getByTestId("buy-submit").click();

    // The limit order places via the on-chain placeOrder instruction.
    await expect(page.getByText(/Limit Buy Bid placed/i).first()).toBeVisible({ timeout: 60_000 });

    // CONSISTENCY: the memcmp-optimized fetchUserOrders (market @ offset 8,
    // maker @ offset 40) must surface the new order in "Your Open Orders"
    // without fetching the entire cluster's order accounts.
    await expect(page.getByText("Your Open Orders").first()).toBeVisible({ timeout: 30_000 });
    // The a11y tree renders the row as one blob ("BUY YES@ 0.10 SOL0/25 filled").
    await expect(page.getByText(/BUY YES\s*@\s*0\.10/).first()).toBeVisible({ timeout: 15_000 });
    console.log("LIMIT-ORDER ok: resting BUY YES @ 0.10 visible in My Orders (memcmp fetchUserOrders)");

    // Cancel it and confirm the order disappears from My Orders.
    await page.getByRole("button", { name: "Cancel" }).first().click();
    await expect(page.getByText(/Limit Order cancelled/i).first()).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText("Your Open Orders").first()).toHaveCount(0, { timeout: 30_000 });
    console.log("LIMIT-CANCEL ok: order removed from My Orders");

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
  });
});
