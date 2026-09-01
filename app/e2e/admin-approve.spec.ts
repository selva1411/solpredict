import { test, expect, Page } from "@playwright/test";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";

/**
 * Verify the "Approve & seed liquidity" flow in the Admin panel:
 *  - Approving a pending proposal ASKS for initial liquidity (YES/NO pools) at
 *    approval time, because approve_market creates a market with EMPTY pools.
 *  - The modal pre-fills a balanced 2.5/2.5 SOL split, validates that at least
 *    one side is funded, and offers "Approve without liquidity" as an escape
 *    hatch.
 * UI-only: a real on-chain approval is admin-gated to the dad wallet
 * (config.admin = dad8hr…), whose key material is only in the dev's browser,
 * so this spec verifies the UX + client-side guard without sending the
 * approve_market tx. A pending proposal is created on-chain via /create and
 * observed through the admin panel's Proposals tab.
 */

const RPC = "http://127.0.0.1:8899";

let connection: Connection;
let keypair: Keypair;

const fmtLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test.beforeAll(async () => {
  connection = new Connection(RPC, "confirmed");
  keypair = Keypair.generate();
  const sig = await connection.requestAirdrop(keypair.publicKey, 50 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`admin-approve wallet funded: ${keypair.publicKey.toBase58()}`);
});

async function installMockWallet(page: Page) {
  const kp = keypair;
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
        equals: (other: any) =>
          !!other && typeof other.toBase58 === "function" && other.toBase58() === PUB_B58,
      };
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

async function createPendingProposal(page: Page, question: string) {
  await page.goto("/create", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await ensureConnected(page);
  await page.getByPlaceholder(/Will SOL close above/).fill(question);
  await page.locator("textarea").fill("Automated E2E — approve & seed liquidity flow");
  await page.locator("select").nth(0).selectOption("1"); // Sports (no oracle step)
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const end = new Date(Date.now() + 2 * 86400000);
  const resolve = new Date(Date.now() + 3 * 86400000);
  await page.locator('input[type="date"]').nth(0).fill(fmtLocal(end));
  await page.locator('input[type="time"]').nth(0).fill("12:00");
  await page.locator('input[type="date"]').nth(1).fill(fmtLocal(resolve));
  await page.locator('input[type="time"]').nth(1).fill("13:00");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("N/A — resolved by admin")).toBeVisible();
  await page.getByRole("button", { name: /Submit Proposal/ }).click();

  // Wait for the DB row to appear (indexer/API async after the tx lands).
  for (let i = 0; i < 30; i++) {
    const res = await page.request.get("/api/admin/proposals");
    if (res.ok()) {
      const body = await res.json() as any;
      const rows = Array.isArray(body) ? body : body.proposals ?? [];
      if (rows.find((p: any) => p.question === question)) return;
    }
    await page.waitForTimeout(1000);
  }
  throw new Error("Pending proposal row never appeared in the admin API");
}

test.describe.serial("Admin approve & seed liquidity", () => {
  const question = `Approve & seed liquidity UI probe ${Date.now()}`;

  test("approve prompts for liquidity; validates non-zero; cancel leaves row pending", async ({ page }) => {
    await installMockWallet(page);
    await createPendingProposal(page, question);

    // Open the Admin panel and switch to the Proposals tab.
    await page.goto("/admin", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await ensureConnected(page);
    await page.getByRole("button", { name: "Proposals", exact: true }).click();

    const row = page.locator("div.py-4", { hasText: question });
    await expect(row, "pending proposal should be listed").toBeVisible({ timeout: 20_000 });
    await expect(row.getByText(/pending/)).toBeVisible();

    // Approving opens the liquidity modal (fresh markets start with empty pools).
    await row.getByRole("button", { name: /Approve/ }).click();
    await expect(page.getByRole("heading", { name: "Approve & seed liquidity" })).toBeVisible();
    await expect(page.getByText(/empty pools/)).toBeVisible();

    // Pre-filled balanced 2.5 / 2.5 SOL split.
    const [yesInput, noInput] = await page.locator('input[type="number"]').all();
    await expect(yesInput).toHaveValue("2.5");
    await expect(noInput).toHaveValue("2.5");
    await expect(page.getByRole("button", { name: "Approve without liquidity" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve & Seed" })).toBeVisible();

    // Both sides zero → client-side guard, no approval attempted; modal stays open.
    await yesInput.fill("0");
    await noInput.fill("0");
    await page.getByRole("button", { name: "Approve & Seed" }).click();
    await expect(page.getByText(/Enter initial liquidity for at least one side/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Approve & seed liquidity" })).toBeVisible();

    // Cancel leaves the proposal untouched (still pending in the review queue).
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Approve & seed liquidity" })).toHaveCount(0);
    await expect(row.getByText(/pending/)).toBeVisible();
  });
});