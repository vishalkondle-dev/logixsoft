import { _electron as electron } from 'playwright';
import path from 'path';
import fs from 'fs';

const ARTIFACT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';
const OWNER_PHONE = '7276718848';
const DEV_OTP = '123456';

async function main() {
  console.log('🚀 [Desktop App] Launching installed Linux application: /usr/bin/logix-dine-pc');

  // Verify binary exists
  if (!fs.existsSync('/usr/bin/logix-dine-pc')) {
    throw new Error('Installed binary /usr/bin/logix-dine-pc does not exist!');
  }

  // Launch the installed Linux desktop package
  const electronApp = await electron.launch({
    executablePath: '/usr/bin/logix-dine-pc',
    args: ['--no-sandbox', '--disable-gpu-sandbox'],
    env: {
      ...process.env,
      LOGIX_DINE_NO_SANDBOX: '1',
      LOGIX_DINE_SERVER_URL: 'https://dine.logixsoft.in',
    },
  });

  try {
    const window = await electronApp.firstWindow();
    await window.setViewportSize({ width: 1400, height: 900 });
    console.log('📱 [Desktop App] Main window initialized');

    // Wait for the cloud web application to load
    console.log('🌐 [Desktop App] Loading https://dine.logixsoft.in...');
    await window.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
    await window.waitForTimeout(3000);

    // Screenshot 1: Home page on desktop
    const s1Path = path.join(ARTIFACT_DIR, 'desktop_1_home_screen.png');
    await window.screenshot({ path: s1Path });
    console.log(`📸 [Desktop App] Saved Screenshot 1: ${s1Path}`);

    // Check if already authenticated or needs sign in
    const signInBtn = window.locator('button:has-text("Sign In with WhatsApp OTP")').first();
    const isSignInVisible = await signInBtn.isVisible({ timeout: 5000 }).catch(() => false);

    if (isSignInVisible) {
      console.log('🔑 [Desktop App] Clicking "Sign In with WhatsApp OTP"...');
      await signInBtn.click();
      await window.waitForTimeout(1000);

      // Locate phone input
      const phoneInput = window.locator('input[type="tel"], input[placeholder*="9876543210"]').first();
      await phoneInput.waitFor({ state: 'visible', timeout: 10000 });
      await phoneInput.fill(OWNER_PHONE);
      await window.waitForTimeout(500);

      // Screenshot 2: Login modal with phone number
      const s2Path = path.join(ARTIFACT_DIR, 'desktop_2_login_phone_modal.png');
      await window.screenshot({ path: s2Path });
      console.log(`📸 [Desktop App] Saved Screenshot 2: ${s2Path}`);

      // Click Continue
      console.log('📲 [Desktop App] Submitting phone number to send OTP...');
      const continueBtn = window.locator('button:has-text("Continue")').first();
      await continueBtn.click();

      // Wait for OTP inputs (Mantine PinInput)
      console.log('🔢 [Desktop App] Waiting for OTP inputs...');
      const pinInputs = window.locator('.mantine-PinInput-input, input[aria-label*="PinInput"]');
      await pinInputs.first().waitFor({ state: 'visible', timeout: 15000 });

      // Fill OTP digits "123456"
      const count = await pinInputs.count();
      console.log(`🔢 [Desktop App] Found ${count} pin input cells`);
      if (count >= 6) {
        for (let i = 0; i < 6; i++) {
          await pinInputs.nth(i).fill(DEV_OTP[i]);
          await window.waitForTimeout(100);
        }
      } else {
        await pinInputs.first().fill(DEV_OTP);
      }

      await window.waitForTimeout(800);

      // Screenshot 3: OTP entered
      const s3Path = path.join(ARTIFACT_DIR, 'desktop_3_login_otp_modal.png');
      await window.screenshot({ path: s3Path });
      console.log(`📸 [Desktop App] Saved Screenshot 3: ${s3Path}`);

      // Click Verify & Continue
      console.log('🚀 [Desktop App] Submitting OTP...');
      const verifyBtn = window.locator('button:has-text("Verify & Continue")').first();
      if (await verifyBtn.isVisible()) {
        await verifyBtn.click();
      }

      // Wait for navigation / redirect to POS or Orders
      console.log('⏳ [Desktop App] Waiting for authentication and dashboard navigation...');
      await window.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      await window.waitForTimeout(4000);
    } else {
      console.log('ℹ️ [Desktop App] User is already authenticated or on redirect page');
    }

    // Screenshot 4: Logged-in POS / Dashboard
    const s4Path = path.join(ARTIFACT_DIR, 'desktop_4_pos_dashboard.png');
    await window.screenshot({ path: s4Path });
    console.log(`📸 [Desktop App] Saved Screenshot 4: ${s4Path}`);

    // Navigate to Orders page to see live restaurant floor / orders
    console.log('📋 [Desktop App] Navigating to Orders & Floor view...');
    await window.goto('https://dine.logixsoft.in/orders', { waitUntil: 'networkidle' }).catch(() => {});
    await window.waitForTimeout(3000);

    // Screenshot 5: Orders & Floor
    const s5Path = path.join(ARTIFACT_DIR, 'desktop_5_orders_floor.png');
    await window.screenshot({ path: s5Path });
    console.log(`📸 [Desktop App] Saved Screenshot 5: ${s5Path}`);

    // Navigate to local offline shell & printer station
    console.log('🖨️ [Desktop App] Opening built-in POS Hardware & Printer Station shell...');
    const fallbackPath = 'file:///root/developer/logixsoft/apps/logix-dine/pc/dist/renderer/index.html';
    await window.goto(fallbackPath, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await window.waitForTimeout(1500);

    // Screenshot 6: Desktop Printer & Hardware Station
    const s6Path = path.join(ARTIFACT_DIR, 'desktop_6_printer_station.png');
    await window.screenshot({ path: s6Path });
    console.log(`📸 [Desktop App] Saved Screenshot 6: ${s6Path}`);

    console.log('🎉 [Desktop App] All screenshots captured successfully!');
  } finally {
    await electronApp.close();
    console.log('🛑 [Desktop App] Application exited.');
  }
}

main().catch((err) => {
  console.error('❌ [Desktop App] Error:', err);
  process.exit(1);
});
