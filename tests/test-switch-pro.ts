import { chromium } from '@playwright/test';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';

async function loginAndGetCookie(phone: string) {
  const verifyRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, otp: '123456' }),
  });
  if (!verifyRes.ok) throw new Error('Login failed');
  const setCookie = verifyRes.headers.get('set-cookie');
  const cookiePair = setCookie?.split(';')[0] ?? '';
  const [cookieName, cookieValue] = cookiePair.split('=');
  const data = await verifyRes.json();
  return { cookiePair, cookieName, cookieValue, user: data.user };
}

async function run() {
  const ownerAuth = await loginAndGetCookie('+919985720478');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: ownerAuth.cookieName,
      value: decodeURIComponent(ownerAuth.cookieValue),
      domain: '.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();
  const consoleMessages: string[] = [];
  page.on('console', (msg) => consoleMessages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => consoleMessages.push(`[PAGE ERROR] ${err.message}`));

  const artifactDir = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';
  const kioskId = 'outlet_722AJJsBLabmhQgNQjyUgJhs';

  console.log('1. Navigating to billing page for Airport Express Kiosk...');
  await page.goto(`${WEB_BASE}/settings/billing?outletId=${kioskId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(artifactDir, 'test_switch_pro_initial.png'), fullPage: true });

  console.log('2. Clicking "Switch Airport Express Kiosk to Pro Plan"...');
  const switchBtn = page.getByRole('button', { name: /Switch.*to Pro Plan/i }).first();
  if (await switchBtn.isVisible()) {
    console.log('Found Switch to Pro button! Clicking...');
    await switchBtn.click();
  } else {
    console.log('Switch button not found, trying Change Plan button...');
    const changeBtn = page.getByRole('button', { name: 'Change Plan' }).first();
    await changeBtn.click();
  }

  console.log('3. Selecting Pro Plan option inside the modal...');
  const proRow = page.locator('text=Pro Plan').first();
  await proRow.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(artifactDir, 'test_switch_pro_selected.png') });

  // Get text inside modal
  const modalText = await page.locator('.mantine-Modal-content').innerText().catch(() => 'Modal not found');
  console.log('--- Modal Content After Selecting Pro Plan ---');
  console.log(modalText);
  console.log('----------------------------------------------');

  await browser.close();

  console.log('--- Browser Console Logs ---');
  console.log(consoleMessages.slice(-15).join('\n'));
}

run().catch(console.error);
