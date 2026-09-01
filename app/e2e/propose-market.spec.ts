import { test, expect, Page } from "@playwright/test";
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";
import * as anchor from "@coral-xyz/anchor";
import idl from "../src/lib/idl/solpredict.json";

/**
 * Verify the "Propose a Market" flow with the category-aware oracle step:
 *  - Crypto (and other oracle categories) auto-fill the Pyth feed from a
 *    friendly asset dropdown instead of a raw 64-char hex input.
 *  - Sports / Politics never show the Oracle step; the proposal is stored
 *    with an all-zeros feed (admin-settled).
 * The two on-chain tests drive the REAL UI with a mock Phantom wallet and
 * assert the persisted proposal account (feed bytes, category) on-chain plus
 * the DB row via the admin proposals API.
 */

const RPC = "http://127.0.0.1:8899";
const PROGRAM_ID = "AWbRCjgFzoe3zMqtXxRzPz7zFo8PP34RLDYmpd8LyGKG";
const SOL_FEED = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
const ETH_FEED = "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace";

let connection: Connection;
let program: anchor.Program;
let keypair: Keypair;

const fmtLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

test.beforeAll(async () => {
  connection = new Connection(RPC, "confirmed");
  keypair = Keypair.generate();
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(keypair),
    { commitment: "confirmed" } as any
  );
  program = new anchor.Program({ ...(idl as anchor.Idl), address: PROGRAM_ID }, provider);
  const sig = await connection.requestAirdrop(keypair.publicKey, 50 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`propose-wallet funded: ${keypair.publicKey.toBase58()}`);
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
          if (tx.version !== undefined) (tx.sign as any)([signer]);
          else (tx.sign as any)(signer);
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

async function fillToOracleStep(page: Page, { question, category }: { question: string; category: "Crypto" | "Sports" }) {
  await page.goto("/create", { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByPlaceholder(/Will SOL close above/).fill(question);
  await page.locator("textarea").fill("Automated E2E proposal — verify oracle handling");
  await page.locator("select").nth(0).selectOption(category === "Sports" ? "1" : "0");

  // Timing step (end +1d, resolve +2d — inside the on-chain 1h..365d window).
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const end = new Date(Date.now() + 2 * 86400000);
  const resolve = new Date(Date.now() + 3 * 86400000);
  await page.locator('input[type="date"]').nth(0).fill(fmtLocal(end));
  await page.locator('input[type="time"]').nth(0).fill("12:00");
  await page.locator('input[type="date"]').nth(1).fill(fmtLocal(resolve));
  await page.locator('input[type="time"]').nth(1).fill("13:00");
  await page.getByRole("button", { name: "Next", exact: true }).click();
}

test.describe.serial("Propose a Market — oracle step UX", () => {
  test("Crypto auto-fills the feed and rewrites it when the asset changes", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/create", { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Default category Crypto → 4 steps including Oracle.
    const tabs = page.locator(".flex.gap-2 button");
    await expect(tabs).toHaveCount(4);
    await expect(tabs.filter({ hasText: /^Oracle$/ })).toBeVisible();

    await fillToOracleStep(page, { question: "Will SOL trade above $250 before December?", category: "Crypto" });

    // Oracle step: asset dropdown is the first select, defaults to SOL/USD.
    const asset = page.locator("select").nth(0);
    await expect(asset).toHaveValue("SOL/USD");
    await expect(page.getByText(/Selected feed: 0xef0d8b6f/)).toBeVisible();
    await expect(page.getByText(/filled in automatically per asset/i)).toBeVisible();

    // Picking Ethereum auto-fills the ETH feed + exponent.
    await asset.selectOption("ETH/USD");
    await expect(asset).toHaveValue("ETH/USD");
    await expect(page.getByText(/Selected feed: 0xff61491a/)).toBeVisible();
    expect(await page.locator('input[type="number"]').nth(1).inputValue()).toBe("-8");

    // Review shows the friendly asset label instead of a raw hex string.
    await page.locator('input[type="number"]').nth(0).fill("30000000000");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByText(/ETH\/USD \(0xff61491a9311/)).toBeVisible();

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
  });

  test("Sports hides the Oracle step and resolves by admin", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/create", { waitUntil: "domcontentloaded", timeout: 30_000 });

    await expect(page.locator(".flex.gap-2 button")).toHaveCount(4);
    await page.locator("select").nth(0).selectOption("1");
    await expect(page.locator(".flex.gap-2 button")).toHaveCount(3);
    await expect(page.locator(".flex.gap-2 button").filter({ hasText: /^Oracle$/ })).toHaveCount(0);
    await expect(page.getByText(/resolved by an admin based on your settlement rules/)).toBeVisible();

    await fillToOracleStep(page, { question: "Will Liverpool win the Premier League this season?", category: "Sports" });

    // Sports lands directly on Review — no oracle step; feed is N/A.
    await expect(page.getByText("N/A — resolved by admin")).toBeVisible();
    await expect(page.getByRole("button", { name: /Submit Proposal/ })).toBeVisible();

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
  });
});

async function fetchNewestProposal() {
  // The on-chain propose uses config.market_count as the proposal id, then
  // increments it — so the last proposal id is market_count - 1.
  const cfgPda = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId)[0];
  const cfg = await (program as any).account.config.fetch(cfgPda);
  const usedId = cfg.marketCount.sub(new anchor.BN(1));
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("proposal"), usedId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );
  const acc = await (program as any).account.marketProposal.fetch(pda).catch(() => null);
  return { acc, pda, usedId };
}

test.describe.serial("Propose a Market — real on-chain proposals", () => {
  test.setTimeout(180_000);

  test("Sports proposal: submitted with an all-zeros feed and recorded in DB", async ({ page, request }) => {
    test.skip(!(await (program as any).account.config.fetch(PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId)[0]).catch(() => null)), "Program/config not deployed");

    await installMockWallet(page, keypair);
    const errors = collectErrors(page);
    const question = `E2E Sports market ${Date.now()}`;
    await page.goto("/create", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await ensureConnected(page);
    await fillToOracleStep(page, { question, category: "Sports" });

    await expect(page.getByText("N/A — resolved by admin")).toBeVisible();
    await page.getByRole("button", { name: /Submit Proposal/ }).click();
    await expect(page.getByText("Market proposed successfully!").first()).toBeVisible({ timeout: 120_000 });
    console.log("SPORTS propose: UI success");

    // On-chain: the proposal account exists with an all-zeros oracle feed.
    const { acc, usedId } = await fetchNewestProposal();
    expect(acc, `proposal account ${usedId} should exist`).not.toBeNull();
    const feed: number[] = (acc as any)?.oracleFeedId ?? (acc as any)?.oracle_feed_id;
    expect(feed).toEqual(new Array(32).fill(0));

    // DB: the admin proposals API lists it as a pending Sports proposal.
    const res = await request.get("/api/admin/proposals");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const row = body.proposals?.find((p: any) => p.question === question);
    expect(row, "proposal row should exist in the DB").toBeTruthy();
    expect(row.category).toBe("Sports");
    expect(row.status).toBe("pending");

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
  });

  test("Crypto proposal: SOL/USD feed auto-filled and recorded in DB", async ({ page, request }) => {
    test.skip(!(await (program as any).account.config.fetch(PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId)[0]).catch(() => null)), "Program/config not deployed");

    await installMockWallet(page, keypair);
    const errors = collectErrors(page);
    const question = `E2E Crypto market ${Date.now()}`;
    await page.goto("/create", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await ensureConnected(page);
    await fillToOracleStep(page, { question, category: "Crypto" });

    // Oracle step: SOL/USD is pre-selected (auto-filled) — submit with it.
    await expect(page.getByText(/Selected feed: 0xef0d8b6f/)).toBeVisible();
    await page.locator('input[type="number"]').nth(0).fill("25000000000");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await page.getByRole("button", { name: /Submit Proposal/ }).click();
    await expect(page.getByText("Market proposed successfully!").first()).toBeVisible({ timeout: 120_000 });
    console.log("CRYPTO propose: UI success");

    // On-chain: the proposal account stores the SOL/USD feed bytes.
    const { acc, usedId } = await fetchNewestProposal();
    expect(acc, `proposal account ${usedId} should exist`).not.toBeNull();
    const feed: number[] = (acc as any)?.oracleFeedId ?? (acc as any)?.oracle_feed_id;
    expect(Buffer.from(feed).toString("hex")).toBe(SOL_FEED);

    // DB: listed as a pending Crypto proposal.
    const res = await request.get("/api/admin/proposals");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const row = body.proposals?.find((p: any) => p.question === question);
    expect(row, "proposal row should exist in the DB").toBeTruthy();
    expect(row.category).toBe("Crypto");
    expect(row.status).toBe("pending");

    const fatal = errors.filter((e) => !isBenign(e));
    expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
  });
});