import { test, expect, Page } from "@playwright/test";
import { Connection, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519";

/**
 * Verifies the header "🪂 Airdrop SOL" button (localnet only):
 *  - shows for a connected wallet,
 *  - airdrops SOL from the local test validator via the /api/rpc proxy,
 *  - the wallet's on-chain balance increases,
 *  - and a success toast is shown.
 */

const RPC = "http://127.0.0.1:8899";

let connection: Connection;
let keypair: Keypair;

test.beforeAll(async () => {
  connection = new Connection(RPC, "confirmed");
  keypair = Keypair.generate();
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

test.describe.serial("Header Airdrop SOL button", () => {
  test.setTimeout(120_000);

  test("0-SOL wallet gets funded by clicking 🪂 Airdrop SOL", async ({ page }) => {
    const bal0 = await connection.getBalance(keypair.publicKey);
    console.log(`initial balance: ${bal0 / LAMPORTS_PER_SOL} SOL`);
    expect(bal0).toBe(0); // fresh keypair, never funded

    await installMockWallet(page, keypair);
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });

    const btn = page.locator("button.wallet-adapter-button").first();
    const prefix = keypair.publicKey.toBase58().slice(0, 4);
    try {
      await expect(btn).toContainText(prefix, { timeout: 20_000 });
    } catch {
      await btn.click();
      const modal = page.locator(".wallet-adapter-modal");
      await modal.waitFor({ state: "visible", timeout: 5_000 });
      await modal.getByText(/Phantom/).first().click();
      await expect(btn).toContainText(prefix, { timeout: 20_000 });
    }

    // Button must be visible once a wallet is connected.
    const airdropBtn = page.getByRole("button", { name: /Airdrop SOL/i });
    await expect(airdropBtn).toBeVisible({ timeout: 10_000 });

    await airdropBtn.click();

    // Success toast + the wallet is funded on-chain.
    await expect(page.getByText(/Airdropped 2 SOL/).first()).toBeVisible({ timeout: 20_000 });
    await expect
      .poll(async () => (await connection.getBalance(keypair.publicKey)) / LAMPORTS_PER_SOL, {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);
    console.log(
      `AIRDROP ok: balance now ${(await connection.getBalance(keypair.publicKey)) / LAMPORTS_PER_SOL} SOL`
    );
  });
});
