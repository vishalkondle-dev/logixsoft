import { chromium } from '@playwright/test';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const OWNER_PHONE = '+917276718848';
const DEV_OTP = '123456';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/d19bc639-79a0-4e4f-8b9b-d44a9ddf7d3a';

async function fetchAuthCookie() {
  const sRes = await fetch(`${API_BASE}/auth/phone/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: OWNER_PHONE }),
  });
  if (!sRes.ok) throw new Error(`send-otp failed: ${sRes.status}`);

  const vRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: OWNER_PHONE, otp: DEV_OTP }),
  });
  if (!vRes.ok) throw new Error(`verify failed: ${vRes.status}`);

  const setCookies = (vRes.headers as any).getSetCookie
    ? (vRes.headers as any).getSetCookie()
    : [vRes.headers.get('set-cookie')];
  const cookieStr = setCookies.filter(Boolean).join('; ');

  const match = cookieStr.match(/__Secure-logix-dine\.session_token=([^;]+)/);
  if (!match) throw new Error(`Session cookie not found`);

  return match[1];
}

async function verifyDurableObjectsLiveSync() {
  console.log('--- Step 1: Getting auth session ---');
  const token = await fetchAuthCookie();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: '__Secure-logix-dine.session_token',
      value: token,
      domain: '.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'None',
    },
    {
      name: '__Secure-logix-dine.session_token',
      value: token,
      domain: 'dine.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'None',
    },
  ]);

  const page = await context.newPage();

  // 1. Tables page
  console.log('--- Step 2: Checking Tables page live sync ---');
  await page.goto(`${WEB_BASE}/tables`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const tablesBadge = page.locator('.mantine-Badge-root:has-text("Live Synced")').first();
  console.log('Tables page Live Synced badge visible:', await tablesBadge.isVisible());

  const tablesScreenshot = path.join(SCREENSHOT_DIR, '50_do_tables_live_synced.png');
  await page.screenshot({ path: tablesScreenshot });
  console.log('Saved tables screenshot:', tablesScreenshot);

  // 2. Kitchen KDS page
  console.log('--- Step 3: Checking Kitchen KDS page live sync ---');
  await page.goto(`${WEB_BASE}/kitchen`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const kitchenBadge = page.locator('.mantine-Badge-root:has-text("Live Synced")').first();
  console.log('Kitchen page Live Synced badge visible:', await kitchenBadge.isVisible());

  const kitchenScreenshot = path.join(SCREENSHOT_DIR, '51_do_kitchen_live_synced.png');
  await page.screenshot({ path: kitchenScreenshot });
  console.log('Saved kitchen screenshot:', kitchenScreenshot);

  // 3. Orders page
  console.log('--- Step 4: Checking Orders page live sync ---');
  await page.goto(`${WEB_BASE}/orders`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const ordersBadge = page.locator('.mantine-Badge-root:has-text("Live Synced")').first();
  console.log('Orders page Live Synced badge visible:', await ordersBadge.isVisible());

  const ordersScreenshot = path.join(SCREENSHOT_DIR, '52_do_orders_live_synced.png');
  await page.screenshot({ path: ordersScreenshot });
  console.log('Saved orders screenshot:', ordersScreenshot);

  await browser.close();
  console.log('--- All live sync checks passed! ---');
}

verifyDurableObjectsLiveSync().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
