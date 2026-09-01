const { chromium } = require('playwright');
const { Keypair } = require('@solana/web3.js');
const { ed25519 } = require('@noble/curves/ed25519');

const keyData = JSON.parse(
  require('fs').readFileSync(require('os').homedir() + '/.config/solana/id.json', 'utf8')
);
const ADMIN = Keypair.fromSecretKey(new Uint8Array(keyData));
const GUARDIAN = Keypair.generate();

const adminB58 = ADMIN.publicKey.toBase58();
const guardianB58 = GUARDIAN.publicKey.toBase58();

console.log('Admin:', adminB58);
console.log('Guardian:', guardianB58);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/home/selva/.local/bin/google-chrome',
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !msg.text().includes('favicon') && !msg.text().includes('React DevTools'))
      errors.push(msg.text().slice(0, 140));
  });

  // Expose Ed25519 signing
  await page.exposeFunction('__edSign', async (msgBytes) => {
    return Array.from(ed25519.sign(Uint8Array.from(msgBytes), ADMIN.secretKey.slice(0, 32)));
  });

  // Mock Phantom wallet
  const pub32 = Array.from(ADMIN.publicKey.toBytes());
  const secret64 = Array.from(ADMIN.secretKey);
  await page.addInitScript(({ pubB58, pub32, secret64 }) => {
    const PUB_B58 = pubB58;
    const PUB32 = new Uint8Array(pub32);
    const pubDuck = {
      toBase58: () => PUB_B58,
      toBytes: () => PUB32,
      equals: (o) => o?.toBase58?.() === PUB_B58,
    };
    window.phantom = {
      solana: {
        isPhantom: true,
        publicKey: pubDuck,
        isConnected: true,
        async connect() { return { publicKey: pubDuck }; },
        async disconnect() {},
        async signTransaction(tx) { return tx; },
        async signAllTransactions(txs) { return txs; },
        async signMessage(message) {
          const signature = await window.__edSign(Array.from(message));
          return { signature: new Uint8Array(signature), publicKey: pubDuck };
        },
      },
    };
    localStorage.setItem('solpredict-wallet', PUB_B58);
  }, { pubB58: adminB58, pub32, secret64 });

  const waitForToast = async (ms = 3000) => {
    await page.waitForTimeout(ms);
    // Check for sonner toasts
    const toasts = await page.locator('[data-sonner-toaster] [data-sonner-toast], [class*="sonner"] [role="status"]').allTextContents().catch(() => []);
    return toasts;
  };

  // ─── Step 0: Navigate ───
  console.log('\n=== Step 0: Navigate to /admin/settings ===');
  await page.goto('http://localhost:3000/admin/settings', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(8000);

  let body = await page.locator('body').innerText();
  console.log('Page loaded, content length:', body.length);

  // Check guardian section
  const sectionLines = body.split('\n').filter(l => /guardian|multisig|pause|confirm|shield/i.test(l));
  console.log('Guardian UI sections:');
  sectionLines.forEach(l => console.log('  ', l.trim()));

  // ─── Step 1: Add Guardian ───
  console.log('\n=== Step 1: Add Guardian ===');
  const addInput = page.locator('input[placeholder*="Base58"]').first();
  if (await addInput.isVisible().catch(() => false)) {
    await addInput.fill(guardianB58);
    console.log('  Filled input with guardian pubkey');

    const addBtn = page.locator('button').filter({ hasText: /^Add$/ }).last();
    if (await addBtn.isVisible().catch(() => false)) {
      const disabled = await addBtn.isDisabled();
      console.log('  Add button disabled:', disabled);
      if (!disabled) {
        await addBtn.click();
        console.log('  Clicked Add Guardian');
        await page.waitForTimeout(10000);

        body = await page.locator('body').innerText();
        const found = body.includes(guardianB58.slice(0, 12));
        console.log('  Guardian in list after add:', found);
        if (!found) {
          // Debug: show what's around the guardian section
          const idx = body.indexOf('Guardian');
          if (idx >= 0) console.log('  Context:', body.slice(Math.max(0, idx - 50), idx + 200));
        }
      }
    }
  } else {
    console.log('  ❌ Add guardian input not visible');
  }

  // ─── Step 2: Set Threshold to 2 ───
  console.log('\n=== Step 2: Set Threshold to 2 ===');
  const thresholdInput = page.locator('input[type="number"]').first();
  if (await thresholdInput.isVisible().catch(() => false)) {
    await thresholdInput.fill('2');
    console.log('  Set threshold input to 2');

    const setBtn = page.locator('button').filter({ hasText: /Set Threshold/ }).first();
    if (await setBtn.isVisible().catch(() => false) && !(await setBtn.isDisabled())) {
      await setBtn.click();
      console.log('  Clicked Set Threshold');
      await page.waitForTimeout(10000);

      body = await page.locator('body').innerText();
      const has2 = body.includes('2 distinct guardian');
      console.log('  Threshold text shows 2:', has2);
      console.log('  ', body.split('\n').filter(l => /unpausing requires/i.test(l)).join(''));
    }
  }

  // ─── Step 3: Pause Program ───
  console.log('\n=== Step 3: Pause Program ===');
  const pauseBtn = page.locator('button').filter({ hasText: /Pause Program/ }).first();
  if (await pauseBtn.isVisible().catch(() => false)) {
    if (!(await pauseBtn.isDisabled())) {
      await pauseBtn.click();
      console.log('  Clicked Pause Program');
      await page.waitForTimeout(10000);

      body = await page.locator('body').innerText();
      const hasPaused = body.includes('PAUSED');
      console.log('  PAUSED badge visible:', hasPaused);
    } else {
      console.log('  Pause button is disabled (already paused?)');
    }
  }

  // ─── Step 4: Try Unpause with 1 signer (should fail with threshold=2) ───
  console.log('\n=== Step 4: Unpause with 1 signer (expect MultisigRequired) ===');
  const unpauseBtn = page.locator('button').filter({ hasText: /^Unpause$/ }).first();
  if (await unpauseBtn.isVisible().catch(() => false)) {
    if (!(await unpauseBtn.isDisabled())) {
      await unpauseBtn.click();
      console.log('  Clicked Unpause (1 guardian, threshold=2)');
      await page.waitForTimeout(10000);

      body = await page.locator('body').innerText();
      const stillPaused = body.includes('PAUSED');
      console.log('  Still shows PAUSED after 1-sig attempt:', stillPaused);
    } else {
      console.log('  Unpause button disabled');
    }
  }

  // ─── Step 5: Lower threshold to 1, then unpause ───
  console.log('\n=== Step 5: Lower threshold to 1 and unpause ===');
  const threshInput2 = page.locator('input[type="number"]').first();
  if (await threshInput2.isVisible().catch(() => false)) {
    await threshInput2.fill('1');
    const setBtn2 = page.locator('button').filter({ hasText: /Set Threshold/ }).first();
    if (await setBtn2.isVisible().catch(() => false) && !(await setBtn2.isDisabled())) {
      await setBtn2.click();
      console.log('  Set threshold back to 1');
      await page.waitForTimeout(10000);

      body = await page.locator('body').innerText();
      console.log('  ', body.split('\n').filter(l => /unpausing requires/i.test(l)).join(''));
    }
  }

  const unpauseBtn2 = page.locator('button').filter({ hasText: /^Unpause$/ }).first();
  if (await unpauseBtn2.isVisible().catch(() => false) && !(await unpauseBtn2.isDisabled())) {
    await unpauseBtn2.click();
    console.log('  Clicked Unpause (1 guardian, threshold=1)');
    await page.waitForTimeout(10000);

    body = await page.locator('body').innerText();
    const stillPaused = body.includes('PAUSED');
    console.log('  Program unpaused:', !stillPaused);
  }

  // ─── Final Summary ───
  console.log('\n=== FINAL STATE ===');
  body = await page.locator('body').innerText();
  const summaryLines = body.split('\n').filter(l =>
    /guardian|threshold|pause|confirm|shield|multisig/i.test(l)
  );
  summaryLines.forEach(l => console.log(' ', l.trim()));

  if (errors.length > 0) {
    console.log('\nConsole errors (non-favicon):', errors.length);
    errors.slice(0, 3).forEach(e => console.log(' ', e));
  }

  await page.screenshot({ path: '/tmp/guardian-flow-result.png', fullPage: true });
  console.log('\nScreenshot: /tmp/guardian-flow-result.png');

  await browser.close();
  console.log('\n=== GUARDIAN FLOW TEST COMPLETE ===');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
