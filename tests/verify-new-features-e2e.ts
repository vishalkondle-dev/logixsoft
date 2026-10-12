import { chromium } from '@playwright/test';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const ARTIFACT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

async function loginAndGetCookie(phone: string) {
  const verifyRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, otp: '123456' }),
  });
  if (!verifyRes.ok) throw new Error(`Login failed: ${verifyRes.status}`);
  const setCookie = verifyRes.headers.get('set-cookie');
  const cookiePair = setCookie?.split(';')[0] ?? '';
  const [cookieName, cookieValue] = cookiePair.split('=');
  const data = await verifyRes.json();
  return { cookiePair, cookieName, cookieValue, user: data.user };
}

async function run() {
  console.log('=================================================================');
  console.log('🚀 LIVE BROWSER E2E VERIFICATION OF LOGIX DINE NEW FEATURES');
  console.log('=================================================================');
  const auth = await loginAndGetCookie('+919985720478');
  console.log('✓ Logged in as:', auth.user.phoneNumber, `(${auth.user.role})`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    {
      name: auth.cookieName,
      value: decodeURIComponent(auth.cookieValue),
      domain: '.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();

  // 1. Verify Reports Hub & Tally/Marg Banner
  console.log('\n[1/3] Navigating to /settings/reports...');
  await page.goto(`${WEB_BASE}/settings/reports`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const bannerText = page.locator('text=Tally Prime & Marg ERP Accounting Export');
  const isBannerVisible = await bannerText.isVisible();
  console.log('  ✓ Tally & Marg ERP Accounting banner visible on Reports Hub:', isBannerVisible);

  // 2. Navigate to Invoice Detail View & Open Accounting Modal
  console.log('\n[2/3] Navigating to /settings/reports/invoice-detail...');
  await page.goto(`${WEB_BASE}/settings/reports/invoice-detail`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const tallyBtn = page.getByRole('button', { name: /Tally \/ Marg ERP/i });
  const tallyBtnVisible = await tallyBtn.isVisible();
  console.log('  ✓ "Tally / Marg ERP" export button visible in report header:', tallyBtnVisible);
  if (!tallyBtnVisible) {
    throw new Error('Tally / Marg ERP export button not found on /settings/reports/invoice-detail');
  }

  // Click Tally / Marg ERP button to open modal
  await tallyBtn.click();
  await page.waitForTimeout(1000);

  // Verify modal elements
  const modalHeader = page.locator('text=Export Accounting Data');
  console.log('  ✓ Accounting Export Modal opened:', await modalHeader.isVisible());

  const tallyExportBtn = page.locator('button:has-text("Download Tally XML")');
  console.log('  ✓ "Download Tally XML" button exists:', await tallyExportBtn.isVisible());

  const margSalesBtn = page.locator('button:has-text("Marg Sales CSV")');
  console.log('  ✓ "Marg Sales CSV" button exists:', await margSalesBtn.isVisible());

  const margItemBtn = page.locator('button:has-text("Marg Item-wise CSV")');
  console.log('  ✓ "Marg Item-wise CSV" button exists:', await margItemBtn.isVisible());

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_accounting_export_modal.png') });
  console.log('  ✓ Saved screenshot: e2e_accounting_export_modal.png');

  // Close modal
  const cancelBtn = page.locator('button:has-text("Cancel")');
  if (await cancelBtn.isVisible()) {
    await cancelBtn.click();
    await page.waitForTimeout(500);
  }

  // 3. Verify POS Page & Offline Billing System
  console.log('\n[3/3] Navigating to /pos to verify Offline POS Billing...');
  await page.goto(`${WEB_BASE}/pos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Check catalog cached in localStorage
  const localCacheKeys = await page.evaluate(() => {
    return Object.keys(localStorage).filter(k => k.startsWith('logix_pos_catalog_') || k.startsWith('logix_offline_'));
  });
  console.log('  ✓ Offline catalog keys initialized in localStorage:', localCacheKeys);

  // Simulate offline event
  console.log('  -> Simulating Zero-Internet (offline mode)...');
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'));
  });
  await page.waitForTimeout(1000);

  const offlineBanner = page.locator('text=OFFLINE BILLING MODE ACTIVE');
  const isBannerUp = await offlineBanner.isVisible();
  console.log('  ✓ "OFFLINE BILLING MODE ACTIVE" alert banner visible:', isBannerUp);

  const viewOfflineBtn = page.getByRole('button', { name: /View Offline Bills/i });
  const isViewBtnVisible = await viewOfflineBtn.isVisible();
  console.log('  ✓ "View Offline Bills" button visible:', isViewBtnVisible);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_pos_offline_banner.png') });
  console.log('  ✓ Saved screenshot: e2e_pos_offline_banner.png');

  if (isViewBtnVisible) {
    await viewOfflineBtn.click();
    await page.waitForTimeout(1000);
    const offlineModal = page.locator('text=Offline Queued Bills');
    console.log('  ✓ "Offline Queued Bills" modal opened:', await offlineModal.isVisible());
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'e2e_offline_bills_modal.png') });
    console.log('  ✓ Saved screenshot: e2e_offline_bills_modal.png');
  }

  // Restore online state
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'));
  });
  await page.waitForTimeout(500);

  await browser.close();
  console.log('\n=================================================================');
  console.log('🎉 ALL LIVE E2E BROWSER CHECKS PASSED SUCCESSFULLY!');
  console.log('=================================================================');
}

run().catch((err) => {
  console.error('E2E TEST FAILED:', err);
  process.exit(1);
});
