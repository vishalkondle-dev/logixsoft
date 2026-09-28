import { chromium } from '@playwright/test';
import * as fs from 'fs';
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
    throw new Error(`Failed to verify phone ${phone}: ${verifyRes.status} ${await verifyRes.text()}`);
  }
  const setCookie = verifyRes.headers.get('set-cookie');
  const cookiePair = setCookie?.split(';')[0] ?? '';
  const [cookieName, cookieValue] = cookiePair.split('=');
  return { cookiePair, cookieName, cookieValue };
}

async function run() {
  console.log('=== VERIFYING ALL 18 MODULES AND 59 PERMISSIONS IN MATRIX ===');

  const ownerAuth = await loginAndGetCookie('+917276718848');
  const restRes = await fetch(`${API_BASE}/restaurants`, {
    headers: { Cookie: ownerAuth.cookiePair },
  });
  const rests = await restRes.json();
  const restId = rests[0].id;
  console.log(`[Owner] Logged in. Restaurant: ${restId} (${rests[0].name})`);

  // Query GET /roles
  const rolesRes = await fetch(`${API_BASE}/roles`, {
    headers: { Cookie: ownerAuth.cookiePair, 'X-Restaurant-Id': restId },
  });
  const rolesData = await rolesRes.json();

  console.log(`[API] Total Roles returned: ${rolesData.roles?.length}`);
  console.log(`[API] Total Modules returned: ${rolesData.modules?.length}`);

  let totalPermsCount = 0;
  for (const m of rolesData.modules || []) {
    const pCount = m.permissions?.length || 0;
    totalPermsCount += pCount;
    console.log(`  - Module: ${m.id} ("${m.label || m.name}"): ${pCount} permissions`);
  }
  console.log(`[API] Total Permissions across all modules: ${totalPermsCount}`);

  if (rolesData.modules?.length !== 18) {
    throw new Error(`Expected 18 modules, but got ${rolesData.modules?.length}`);
  }
  if (totalPermsCount !== 59) {
    throw new Error(`Expected 59 permissions, but got ${totalPermsCount}`);
  }

  // Check Manager Role permissions count
  const managerRole = rolesData.roles?.find((r: any) => r.name === 'MANAGER');
  console.log(`[API] MANAGER permissions: ${managerRole?.permissions?.length} (expected 58)`);

  // Fetch outlets
  const outletsRes = await fetch(`${API_BASE}/outlets`, {
    headers: { Cookie: ownerAuth.cookiePair, 'X-Restaurant-Id': restId },
  });
  const outlets = await outletsRes.json();
  const outletId = outlets[0]?.id;

  // Step 2: Open Playwright and inspect the UI
  console.log('[Playwright] Launching browser...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1800 },
  });

  await context.addCookies([
    {
      name: ownerAuth.cookieName,
      value: ownerAuth.cookieValue,
      domain: '.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
    {
      name: ownerAuth.cookieName,
      value: ownerAuth.cookieValue,
      domain: 'dine.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
    {
      name: 'dine.restaurantId',
      value: restId,
      domain: 'dine.logixsoft.in',
      path: '/',
      secure: false,
      httpOnly: false,
      sameSite: 'Lax',
    },
    {
      name: 'dine.outletId',
      value: outletId,
      domain: 'dine.logixsoft.in',
      path: '/',
      secure: false,
      httpOnly: false,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();
  console.log('[Playwright] Navigating to /settings/roles...');
  await page.goto(`${WEB_BASE}/settings/roles`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Click on MANAGER card to inspect its matrix
  const managerCard = page.locator('text=MANAGER').first();
  if (await managerCard.isVisible()) {
    console.log('[Playwright] Clicking MANAGER role card...');
    await managerCard.click();
    await page.waitForTimeout(2000);
  }

  // Take screenshot
  const screenshotPath = path.join(ARTIFACT_DIR, 'roles_all_modules_matrix.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`[Playwright] Saved full-page screenshot to: ${screenshotPath}`);

  // Also check if the 5 new module titles are present in the DOM
  const requiredModuleTitles = [
    'Table Reservations & Bookings',
    'Customer Directory & CRM',
    'Invoice, Tax & Service Charges',
    'QR Menu Table Ordering',
    'WhatsApp Alerts & Automation',
  ];

  for (const title of requiredModuleTitles) {
    const el = page.locator(`text=${title}`).first();
    const isVisible = await el.isVisible();
    console.log(`[Playwright] Checking module "${title}": visible = ${isVisible}`);
    if (!isVisible) {
      throw new Error(`Module "${title}" is not visible in the Roles Matrix UI!`);
    }
  }

  console.log('=== ALL 18 MODULES AND 59 PERMISSIONS VERIFIED SUCCESSFULLY! ===');
  await browser.close();
}

run().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
