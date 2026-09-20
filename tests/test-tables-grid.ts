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

async function verifyScreens() {
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
  await page.goto(`${WEB_BASE}/tables`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const tablesScreenshot = path.join(SCREENSHOT_DIR, '53_tables_page_no_refresh.png');
  await page.screenshot({ path: tablesScreenshot, fullPage: true });
  console.log('Saved tables screenshot:', tablesScreenshot);

  // 2. Orders page
  await page.goto(`${WEB_BASE}/orders`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const ordersScreenshot = path.join(SCREENSHOT_DIR, '54_orders_page_no_refresh.png');
  await page.screenshot({ path: ordersScreenshot, fullPage: true });
  console.log('Saved orders screenshot:', ordersScreenshot);

  // 3. Kitchen page
  await page.goto(`${WEB_BASE}/kitchen`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const kitchenScreenshot = path.join(SCREENSHOT_DIR, '55_kitchen_page_no_refresh.png');
  await page.screenshot({ path: kitchenScreenshot, fullPage: true });
  console.log('Saved kitchen screenshot:', kitchenScreenshot);

  await browser.close();
}

verifyScreens().catch(console.error);
