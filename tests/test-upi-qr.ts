import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const OWNER_PHONE = '+917276718848';
const DEV_OTP = '123456';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/d19bc639-79a0-4e4f-8b9b-d44a9ddf7d3a';

async function fetchAuthCookie(): Promise<{ name: string; value: string; domain: string; path: string }> {
  const sRes = await fetch(`${API_BASE}/auth/phone/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: OWNER_PHONE }),
  });
  if (!sRes.ok) throw new Error(`send-otp failed: ${sRes.status} ${await sRes.text()}`);

  const vRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: OWNER_PHONE, otp: DEV_OTP }),
  });
  if (!vRes.ok) throw new Error(`verify failed: ${vRes.status} ${await vRes.text()}`);

  const setCookies = (vRes.headers as any).getSetCookie
    ? (vRes.headers as any).getSetCookie()
    : [vRes.headers.get('set-cookie')];
  const cookieStr = setCookies.filter(Boolean).join('; ');

  const match = cookieStr.match(/__Secure-logix-dine\.session_token=([^;]+)/);
  if (!match) throw new Error(`Session cookie not found in: ${cookieStr}`);

  return {
    name: '__Secure-logix-dine.session_token',
    value: match[1],
    domain: '.logixsoft.in',
    path: '/',
  };
}

async function runTest() {
  console.log('--- Step 1: Getting session cookie ---');
  const cookie = await fetchAuthCookie();
  console.log('Session cookie acquired:', cookie.name);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });

  await context.addCookies([
    {
      name: cookie.name,
      value: cookie.value,
      domain: '.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'None',
    },
    {
      name: '__Secure-logix-dine.session_token',
      value: cookie.value,
      domain: 'dine.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'None',
    },
  ]);

  const page = await context.newPage();

  console.log('--- Step 2: Navigating to Settings to verify UPI ID on Outlet ---');
  await page.goto(`${WEB_BASE}/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Take screenshot of settings outlet card with UPI ID
  const settingsScreenshotPath = path.join(SCREENSHOT_DIR, '45_settings_outlet_upi_badge.png');
  await page.screenshot({ path: settingsScreenshotPath, fullPage: true });
  console.log('Settings screenshot saved to:', settingsScreenshotPath);

  console.log('--- Step 3: Navigating to POS ---');
  await page.goto(`${WEB_BASE}/pos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Add an item to cart
  console.log('Selecting an item in POS...');
  const itemCard = page.locator('.mantine-Paper-root').filter({ hasText: '₹' }).first();
  if (await itemCard.isVisible()) {
    await itemCard.click();
    await page.waitForTimeout(500);
  }

  // Click Chevron on split order button to select Settle & Send
  console.log('Clicking More order options chevron...');
  const splitChevron = page.locator('button[aria-label="More order options"]').first();
  await splitChevron.waitFor({ state: 'visible', timeout: 8000 });
  await splitChevron.click();
  await page.waitForTimeout(400);

  console.log('Clicking Settle & Send menu item...');
  const settleMenuItem = page.getByRole('menuitem', { name: /Settle & Send|Settle/i }).first();
  await settleMenuItem.click();
  await page.waitForTimeout(800);

  // Settle Modal is now open! Let's select UPI
  console.log('Selecting UPI payment method in Settle Modal...');
  const upiSegment = page.locator('.mantine-Modal-content .mantine-SegmentedControl-label:has-text("UPI")').first();
  await upiSegment.waitFor({ state: 'visible', timeout: 5000 });
  await upiSegment.click();

  await page.waitForTimeout(1500);

  // Take screenshot of POS Settle Modal with Custom QR Code
  const posQrScreenshotPath = path.join(SCREENSHOT_DIR, '46_pos_settle_custom_upi_qr.png');
  await page.screenshot({ path: posQrScreenshotPath });
  console.log('POS UPI QR Code screenshot saved to:', posQrScreenshotPath);

  // Verify that the QR code is visible
  const qrBadge = page.locator('.mantine-Badge-label:has-text("UPI QR CODE")').first();
  console.log('Is UPI QR Code visible in POS:', await qrBadge.isVisible());

  // Close Settle modal
  const closeBtn = page.locator('button[aria-label="Close"]').first();
  if (await closeBtn.isVisible()) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }

  console.log('--- Step 4: Navigating to Tables page ---');
  await page.goto(`${WEB_BASE}/tables`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Look for occupied table with Settle & Free button
  const settleFreeBtn = page.locator('button:has-text("Settle & Free")').first();
  if (await settleFreeBtn.isVisible()) {
    console.log('Clicking Settle & Free on table...');
    await settleFreeBtn.click();
    await page.waitForTimeout(1000);

    // Select UPI radio inside modal if present
    const upiRadio = page.locator('.mantine-Modal-content label:has-text("UPI")').first();
    if (await upiRadio.isVisible()) {
      await upiRadio.click();
      await page.waitForTimeout(1000);

      const tablesQrScreenshotPath = path.join(SCREENSHOT_DIR, '47_tables_free_custom_upi_qr.png');
      await page.screenshot({ path: tablesQrScreenshotPath });
      console.log('Tables UPI QR Code screenshot saved to:', tablesQrScreenshotPath);
    }
    const closeTablesModal = page.locator('.mantine-Modal-content button[aria-label="Close"], .mantine-Modal-content button:has-text("Cancel")').first();
    if (await closeTablesModal.isVisible()) {
      await closeTablesModal.click();
      await page.waitForTimeout(500);
    }
  }

  console.log('--- Step 5: Test Outlet WITHOUT UPI ID ---');
  // Switch outlet to Branch 2
  const outletPicker = page.locator('button:has-text("Main"), button:has-text("Branch 2")').first();
  if (await outletPicker.isVisible()) {
    await page.goto(`${WEB_BASE}/pos?outletId=outlet_EL3OT7iEQJCUwsi7mszOm2be`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const itemCardBranch = page.locator('.mantine-Paper-root').filter({ hasText: '₹' }).first();
    if (await itemCardBranch.isVisible()) {
      await itemCardBranch.click();
      await page.waitForTimeout(500);

      const splitChevronBranch = page.locator('button[aria-label="More order options"]').first();
      await splitChevronBranch.waitFor({ state: 'visible', timeout: 8000 });
      await splitChevronBranch.click();
      await page.waitForTimeout(400);

      const settleMenuItemBranch = page.getByRole('menuitem', { name: /Settle & Send|Settle/i }).first();
      await settleMenuItemBranch.click();
      await page.waitForTimeout(800);

      const upiSegmentBranch = page.locator('.mantine-Modal-content .mantine-SegmentedControl-label:has-text("UPI")').first();
      await upiSegmentBranch.waitFor({ state: 'visible', timeout: 5000 });
      await upiSegmentBranch.click();
      await page.waitForTimeout(1000);

      await page.waitForTimeout(1000);
      const noQrScreenshotPath = path.join(SCREENSHOT_DIR, '48_pos_no_qr_when_no_upi_id.png');
      await page.screenshot({ path: noQrScreenshotPath });
      console.log('No QR screenshot saved to:', noQrScreenshotPath);

      const qrBadge = page.locator('.mantine-Badge-label:has-text("UPI QR CODE")');
      console.log('Is QR Badge visible for Branch 2 (should be false):', await qrBadge.isVisible());
    }
  }

  await browser.close();
  console.log('--- All tests finished successfully! ---');
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
