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
  if (!verifyRes.ok) {
    throw new Error(`Failed to login phone ${phone}: ${verifyRes.status} ${await verifyRes.text()}`);
  }
  const setCookie = verifyRes.headers.get('set-cookie');
  const cookiePair = setCookie?.split(';')[0] ?? '';
  const [cookieName, cookieValue] = cookiePair.split('=');
  return { cookiePair, cookieName, cookieValue };
}

async function run() {
  console.log('=====================================================');
  console.log('STARTING SAAS ADMIN PORTAL FULL E2E VERIFICATION TEST');
  console.log('=====================================================');

  const adminPhone = '+917276718848';
  const waiterPhone = '+919985720478';

  // 1. Authenticate Admin
  console.log('\n[1] Authenticating Superadmin via OTP...');
  const adminAuth = await loginAndGetCookie(adminPhone);
  console.log('Superadmin logged in. Cookie:', adminAuth.cookieName);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await adminContext.addCookies([
    {
      name: adminAuth.cookieName,
      value: adminAuth.cookieValue,
      domain: '.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
    {
      name: adminAuth.cookieName,
      value: adminAuth.cookieValue,
      domain: 'dine.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await adminContext.newPage();

  // 2. Navigate to /admin
  console.log('\n[2] Navigating to /admin as Superadmin...');
  await page.goto(`${WEB_BASE}/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Check Title & Badges
  const heading = await page.textContent('h2');
  console.log('Page Heading:', heading);
  if (!heading?.includes('Platform Superadmin Control Plane')) {
    throw new Error(`Expected admin heading, got: ${heading}`);
  }

  // Check KPI cards
  const cardTexts = await page.$$eval('.mantine-Card-root', (cards) => cards.map((c) => c.textContent));
  console.log(`Found ${cardTexts.length} dashboard cards`);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'admin_portal_overview.png'), fullPage: true });
  console.log('Saved screenshot: admin_portal_overview.png');

  // 3. Test Tabs Navigation
  console.log('\n[3] Testing Tabs navigation...');
  // Users Directory Tab
  await page.click('button[role="tab"]:has-text("Users Directory")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'admin_portal_users.png'), fullPage: true });
  console.log('Saved screenshot: admin_portal_users.png');

  // All Outlets Tab
  await page.click('button[role="tab"]:has-text("All Outlets")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'admin_portal_outlets.png'), fullPage: true });
  console.log('Saved screenshot: admin_portal_outlets.png');

  // Operations & Database Tab
  await page.click('button[role="tab"]:has-text("Operations & Database")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'admin_portal_system.png'), fullPage: true });
  console.log('Saved screenshot: admin_portal_system.png');

  // Switch back to Restaurants tab
  await page.click('button[role="tab"]:has-text("Restaurants")');
  await page.waitForTimeout(1000);

  // 4. Test Restaurant CRUD via UI
  console.log('\n[4] Testing Restaurant Full CRUD via UI...');
  const testRestName = `E2E Royal Bistro ${Date.now().toString().slice(-4)}`;
  const testOwnerPhone = '+919988776655';

  console.log(`Creating test restaurant: "${testRestName}"...`);
  await page.click('button:has-text("Add Restaurant")');
  await page.waitForSelector('.mantine-Modal-content', { state: 'visible' });

  // Fill modal
  await page.fill('input[placeholder="e.g. Urban Diner & Bar"]', testRestName);
  await page.fill('input[placeholder="e.g. 100 Feet Road, Indiranagar, Bengaluru"]', '88 MG Road, Bengaluru');
  await page.fill('input[placeholder="+91..."]', testOwnerPhone);
  await page.fill('input[placeholder="e.g. Ramesh Kumar"]', 'Rohan Verma');

  await page.click('button:has-text("Create & Provision Store")');
  await page.waitForSelector('.mantine-Modal-content', { state: 'hidden', timeout: 10000 });
  await page.waitForTimeout(2000);

  // Search for the newly created store
  console.log('Searching for created store in table...');
  await page.fill('input[placeholder="Search store name, owner phone, address..."]', testRestName);
  await page.waitForTimeout(1000);

  const rowText = await page.textContent(`table tbody tr:has-text("${testRestName}")`);
  console.log('Found table row:', rowText?.trim());
  if (!rowText?.includes(testRestName)) {
    throw new Error(`Failed to find newly created restaurant "${testRestName}" in table!`);
  }

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'admin_restaurant_created.png'), fullPage: true });
  console.log('Saved screenshot: admin_restaurant_created.png');

  // Edit store status to SUSPENDED
  console.log('Toggling store status via menu...');
  const row = page.locator(`table tbody tr:has-text("${testRestName}")`);
  await row.locator('button[aria-haspopup="menu"]').click();
  await page.waitForTimeout(500);

  // Click Suspend Store
  await page.click('.mantine-Menu-item:has-text("Suspend Store")');
  await page.waitForTimeout(1500);

  // Check badge updated to SUSPENDED
  const updatedBadge = await row.locator('.mantine-Badge-root').textContent();
  console.log('Updated Status Badge:', updatedBadge);
  if (!updatedBadge?.includes('SUSPENDED')) {
    throw new Error(`Expected SUSPENDED badge, got: ${updatedBadge}`);
  }

  // Click Activate Store
  await row.locator('button[aria-haspopup="menu"]').click();
  await page.waitForTimeout(500);
  await page.click('.mantine-Menu-item:has-text("Activate Store")');
  await page.waitForTimeout(1500);

  const activeBadge = await row.locator('.mantine-Badge-root').textContent();
  console.log('Restored Status Badge:', activeBadge);

  // Manage Outlets Drawer
  console.log('Opening Manage Outlets drawer...');
  await row.locator('button[aria-haspopup="menu"]').click();
  await page.waitForTimeout(500);
  await page.click('.mantine-Menu-item:has-text("Manage Outlets")');
  await page.waitForSelector('.mantine-Drawer-content', { state: 'visible' });
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'admin_outlets_drawer.png'), fullPage: true });
  console.log('Saved screenshot: admin_outlets_drawer.png');

  // Close drawer
  await page.click('.mantine-Drawer-close');
  await page.waitForSelector('.mantine-Drawer-content', { state: 'hidden' });
  await page.waitForTimeout(1000);

  // 5. Test Impersonation ("Enter Store as Owner")
  console.log('\n[5] Testing Impersonation ("Enter Store as Owner")...');
  await row.locator('button:has-text("Enter Store")').click();
  await page.waitForURL('**/pos', { timeout: 10000 });
  await page.waitForTimeout(2000);

  console.log('Current URL after Enter Store:', page.url());

  // Verify Amber Admin Impersonation Banner is displayed
  const bannerText = await page.textContent('body');
  const hasBanner = bannerText?.includes('Platform Admin Mode') && bannerText?.includes(testRestName);
  console.log('Impersonation Banner Present:', hasBanner);
  if (!hasBanner) {
    throw new Error('Impersonation banner did not appear on POS page!');
  }

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'admin_impersonation_banner.png'), fullPage: true });
  console.log('Saved screenshot: admin_impersonation_banner.png');

  // Click "Return to Admin Portal" in the banner
  console.log('Clicking "Return to Admin Portal" button in banner...');
  await page.click('a:has-text("Return to Admin Portal")');
  await page.waitForURL('**/admin', { timeout: 10000 });
  await page.waitForTimeout(2000);
  console.log('Successfully returned to Admin Portal URL:', page.url());

  // 6. Clean Up: Delete test restaurant
  console.log('\n[6] Cleaning up test restaurant...');
  await page.fill('input[placeholder="Search store name, owner phone, address..."]', testRestName);
  await page.waitForTimeout(1000);

  const deleteRow = page.locator(`table tbody tr:has-text("${testRestName}")`);
  await deleteRow.locator('button[aria-haspopup="menu"]').click();
  await page.waitForTimeout(500);

  await page.click('.mantine-Menu-item:has-text("Delete Store")');
  await page.waitForSelector('.mantine-Modal-content', { state: 'visible' });
  await page.click('button:has-text("Permanently Delete Store")');
  await page.waitForSelector('.mantine-Modal-content', { state: 'hidden', timeout: 10000 });
  await page.waitForTimeout(1500);

  // Verify row is gone
  const remainingRows = await page.$$eval(`table tbody tr:has-text("${testRestName}")`, (r) => r.length);
  console.log('Remaining rows for test restaurant:', remainingRows);
  if (remainingRows !== 0) {
    throw new Error('Test restaurant was not deleted!');
  }
  console.log('Test restaurant successfully deleted and cleaned up.');

  // 7. Security Gate: Verify Non-Admin Access is strictly blocked
  console.log('\n[7] Testing Non-Admin Security Gate (Waiter login)...');
  const waiterAuth = await loginAndGetCookie(waiterPhone);

  const waiterContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await waiterContext.addCookies([
    {
      name: waiterAuth.cookieName,
      value: waiterAuth.cookieValue,
      domain: '.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
    {
      name: waiterAuth.cookieName,
      value: waiterAuth.cookieValue,
      domain: 'dine.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  const waiterPage = waiterContext.newPage ? await waiterContext.newPage() : await browser.newPage();
  await waiterPage.goto(`${WEB_BASE}/admin`, { waitUntil: 'networkidle' });
  await waiterPage.waitForTimeout(2000);

  const finalWaiterUrl = waiterPage.url();
  console.log('Waiter redirected URL after trying to access /admin:', finalWaiterUrl);
  if (finalWaiterUrl.endsWith('/admin')) {
    throw new Error('SECURITY VIOLATION: Waiter was able to access /admin!');
  }
  console.log('Security check passed: Waiter was properly redirected away from /admin.');

  await browser.close();

  console.log('\n======================================================');
  console.log('ALL E2E ADMIN TESTS PASSED PERFECTLY!');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('\nE2E TEST FAILED:', err);
  process.exit(1);
});
