import { _electron as electron } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';
import assert from 'assert';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');

async function runE2ETests() {
  console.log('🚀 [E2E] Starting Logix Dine Desktop E2E Test Suite...');

  // Launch Electron application with local shell enabled
  const electronApp = await electron.launch({
    args: ['--no-sandbox', '--disable-gpu-sandbox', appRoot],
    env: {
      ...process.env,
      USE_LOCAL_SHELL: 'true',
      LOGIX_DINE_NO_SANDBOX: '1',
    },
  });

  try {
    console.log('✅ [E2E] Electron process launched successfully');

    // 1. Wait for the first BrowserWindow
    const window = await electronApp.firstWindow();
    console.log('✅ [E2E] First BrowserWindow detected');

    // Wait for DOM to be ready
    await window.waitForLoadState('domcontentloaded');
    await window.waitForTimeout(1000);

    // 2. Verify Window Title
    const title = await window.title();
    console.log(`📄 [E2E] Window Title: "${title}"`);
    assert(title.includes('Logix Dine'), `Expected title to contain "Logix Dine", got "${title}"`);

    // 3. Verify Preload Bridge (window.logixDinePC)
    const hasBridge = await window.evaluate(() => {
      return typeof window.logixDinePC === 'object' && window.logixDinePC.isElectron === true;
    });
    console.log(`🔌 [E2E] window.logixDinePC bridge injected: ${hasBridge}`);
    assert(hasBridge, 'window.logixDinePC must be exposed by contextBridge');

    // 4. Verify App Info API
    const appInfo = await window.evaluate(async () => {
      return await window.logixDinePC.getAppInfo();
    });
    console.log('📱 [E2E] App Info:', JSON.stringify(appInfo));
    assert(appInfo.name, 'App info must have name');
    assert(appInfo.versions.electron, 'App info must have electron version');
    assert(appInfo.versions.node, 'App info must have node version');

    // 5. Verify Printer API
    const printers = await window.evaluate(async () => {
      return await window.logixDinePC.getPrinters();
    });
    console.log(`🖨️ [E2E] Printers detected: ${printers.length}`);
    assert(Array.isArray(printers), 'getPrinters() must return an array');

    // 6. Verify Config Store (Get & Set)
    const testKey = 'testTimestamp';
    const testVal = Date.now().toString();
    const setSuccess = await window.evaluate(async ({ k, v }) => {
      return await window.logixDinePC.setConfig(k, v);
    }, { k: testKey, v: testVal });
    assert(setSuccess, 'setConfig must return true');

    const retrievedVal = await window.evaluate(async (k) => {
      return await window.logixDinePC.getConfig(k);
    }, testKey);
    console.log(`💾 [E2E] Config Store Verified: ${testKey} = ${retrievedVal}`);
    assert.strictEqual(retrievedVal, testVal, 'Config value must match stored value');

    // 7. Verify UI Elements Rendered
    const brandTitle = await window.textContent('.brand-title');
    console.log(`🏷️ [E2E] Brand Title in DOM: "${brandTitle}"`);
    assert.strictEqual(brandTitle, 'Logix Dine POS Desktop');

    const cardTitles = await window.$$eval('.card-title', (els) => els.map((e) => e.textContent));
    console.log('📋 [E2E] Rendered Sections:', cardTitles);
    assert(cardTitles.includes('Cloud POS Server'), 'Should render Cloud POS Server card');
    assert(cardTitles.includes('POS Thermal Printer Station'), 'Should render Printer Station card');
    assert(cardTitles.includes('POS Keyboard Accelerators'), 'Should render Keyboard Accelerators card');

    // 8. Test Kiosk Toggle
    const initialKiosk = await window.evaluate(async () => {
      return await window.logixDinePC.isKiosk();
    });
    console.log(`🖥️ [E2E] Initial Kiosk Mode: ${initialKiosk}`);

    const toggledKiosk = await window.evaluate(async () => {
      return await window.logixDinePC.toggleKiosk();
    });
    console.log(`🖥️ [E2E] Toggled Kiosk Mode: ${toggledKiosk}`);
    assert.strictEqual(toggledKiosk, !initialKiosk, 'toggleKiosk must toggle mode');

    // Reset kiosk mode back
    await window.evaluate(async () => {
      await window.logixDinePC.toggleKiosk();
    });

    console.log('🎉 [E2E] ALL DESKTOP E2E TESTS PASSED SUCCESSFULLY!');
  } finally {
    // 9. Clean Close
    await electronApp.close();
    console.log('🛑 [E2E] Electron application closed cleanly.');
  }
}

runE2ETests().catch((err) => {
  console.error('❌ [E2E] Test failed:', err);
  process.exit(1);
});
