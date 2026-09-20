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

async function verifyTablesGrid() {
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
  await page.goto(`${WEB_BASE}/tables`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const screenshotPath = path.join(SCREENSHOT_DIR, '49_tables_max_4_per_row.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved screenshot:', screenshotPath);

  await browser.close();
}

verifyTablesGrid().catch(console.error);
