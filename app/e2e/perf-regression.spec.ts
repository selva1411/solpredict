import { test, expect, Page } from "@playwright/test";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";

/**
 * PERFORMANCE REGRESSION GUARD.
 *
 * The app used to take 11-15s to load pages and felt slow on buy/sell/LP
 * clicks. Root causes (all fixed): Neon cold-start on first DB query (~15s),
 * a dead-weight /api/markets/{id} call that blocked every fetch, duplicate
 * /api/markets/cached + /api/markets/stats calls, and a MarketDataProvider
 * that fetched the entire on-chain market set on every page with no consumers.
 *
 * These tests fail if a page load or the buy flow ever regresses past a
 * generous budget. Budgets are ~4-6× the current measured times so CI stays
 * stable while still catching real regressions (cold starts, slow DB, blocked
 * fetches, missing caches).
 */

const BASE = "http://localhost:3000";
const MARKET = "7m4wbCZfdGiPgqciLsrtwZUzXyEW33Wa52hWooh1aANp";
const RPC = "http://127.0.0.1:8899";

// Budgets (ms) — generous, but would catch a 10s+ regression.
const HOME_BUDGET = 8_000; // measured ~1.7s to "Trending Markets"
const MARKETS_BUDGET = 8_000; // measured ~1.7s
const DETAIL_BUDGET = 10_000; // measured ~1.8s (was 15s before fix)
const BUY_BUDGET = 15_000; // measured ~0.4s; 15s absorbs validator-idle blockhash retry

test.describe("Performance regression budgets", () => {
  test.setTimeout(90_000);

  // Warm the route once (unmeasured) so the measured navigation below reflects
  // real render time, not the dev server's first-time Turbopack compile of the
  // route (which can take 10s+ during a full-suite run and would trip the
  // budget even though the app itself is fast — prod timings are ~0.8s).
  async function warmRoute(page: Page, path: string, waitForText?: string | RegExp) {
    await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 60_000 });
    // Wait for the route's actual content to render, not just the initial HTML:
    // on-demand Turbopack compilation completes lazily, so domcontentloaded can
    // fire before the JS chunks for this route are ready. Waiting on real
    // content guarantees the warm-up visit finished compiling the route.
    if (waitForText) {
      await expect(page.getByText(waitForText).first()).toBeVisible({ timeout: 60_000 });
    }
    await page.waitForTimeout(500);
  }

  test("home page renders hero within budget", async ({ page }) => {
    await warmRoute(page, "/", "Conviction,");
    const t0 = Date.now();
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByText("Conviction,").first()).toBeVisible({ timeout: HOME_BUDGET });
    console.log(`PERF home hero visible: ${Date.now() - t0}ms (budget ${HOME_BUDGET}ms)`);
    expect(Date.now() - t0).toBeLessThan(HOME_BUDGET);
  });

  test("markets directory renders within budget", async ({ page }) => {
    await warmRoute(page, "/markets", "Directory");
    const t0 = Date.now();
    await page.goto(BASE + "/markets", { waitUntil: "domcontentloaded", timeout: 30_000 });
    // The directory lists market rows; wait for the heading.
    await expect(page.getByText("Directory").first()).toBeVisible({ timeout: MARKETS_BUDGET });
    console.log(`PERF markets dir visible: ${Date.now() - t0}ms (budget ${MARKETS_BUDGET}ms)`);
    expect(Date.now() - t0).toBeLessThan(MARKETS_BUDGET);
  });

  test("market detail page renders within budget", async ({ page }) => {
    test.skip(!(await marketDeployed()), "Manchester United market is not deployed on-chain");
    await warmRoute(page, `/market/${MARKET}`, /Manchester United/i);
    const t0 = Date.now();
    await page.goto(`${BASE}/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: DETAIL_BUDGET });
    console.log(`PERF market detail visible: ${Date.now() - t0}ms (budget ${DETAIL_BUDGET}ms)`);
    expect(Date.now() - t0).toBeLessThan(DETAIL_BUDGET);
  });

  test("buy click reaches wallet signing within budget", async ({ page }) => {
    test.skip(!(await marketDeployed()), "Manchester United market is not deployed on-chain");
    const kp = Keypair.generate();
    const conn = new Connection(RPC, "confirmed");
    const sig = await conn.requestAirdrop(kp.publicKey, 50 * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
    await installMockWallet(page, kp);

    await page.goto(`${BASE}/market/${MARKET}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByText(/Manchester United/i).first()).toBeVisible({ timeout: 15_000 });

    // Wait for auto-connect (mock wallet).
    const btn = page.locator("button.wallet-adapter-button").first();
    await expect(btn).toContainText(kp.publicKey.toBase58().slice(0, 4), { timeout: 20_000 });

    const t0 = Date.now();
    await page.getByTestId("buy-quantity").fill("5");
    await page.getByTestId("buy-submit").click();

    // The critical user-perceived metric: click → wallet approval/success.
    // The mock wallet signs instantly, so "✓ Done" should appear quickly.
    await expect(page.getByText(/✓ Done/).first()).toBeVisible({ timeout: BUY_BUDGET });
    console.log(`PERF buy click→✓Done: ${Date.now() - t0}ms (budget ${BUY_BUDGET}ms)`);
    expect(Date.now() - t0).toBeLessThan(BUY_BUDGET);
  });
});

async function marketDeployed(): Promise<boolean> {
  try {
    const conn = new Connection(RPC, "confirmed");
    const acc = await conn.getAccountInfo(new PublicKey(MARKET));
    return !!acc;
  } catch {
    return false;
  }
}

/** Install a mock Phantom injected-wallet before the app bundle runs. */
async function installMockWallet(page: Page, kp: Keypair) {
  await page.addInitScript(
    ({ pubB58, pub32, secret64, seed32 }) => {
      const PUB_B58 = pubB58 as string;
      const PUB32 = new Uint8Array(pub32 as number[]);
      const SECRET = new Uint8Array(secret64 as number[]);
      const SEED = new Uint8Array(seed32 as number[]);

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
          const key = await crypto.subtle.importKey("raw", SEED as BufferSource, { name: "Ed25519" }, false, ["sign"]);
          const signature = await crypto.subtle.sign({ name: "Ed25519" }, key, message as BufferSource);
          return { signature: new Uint8Array(signature) };
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
