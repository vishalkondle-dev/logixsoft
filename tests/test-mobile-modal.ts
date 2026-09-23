import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const OWNER_PHONE = '+917276718848';
const DEV_OTP = '123456';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/d19bc639-79a0-4e4f-8b9b-d44a9ddf7d3a';

const CACHE_FILE = '/tmp/dine_session.json';

async function fetchAuthCookie(): Promise<{ name: string; value: string; domain: string; path: string }> {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
      if (cached && cached.value) {
        // Quick verify with /auth/session or restaurant
        const testRes = await fetch(`${API_BASE}/restaurants/active`, {
          headers: { Cookie: `${cached.name}=${cached.value}` },
        });
        if (testRes.ok) {
          console.log('Using cached session token from', CACHE_FILE);
          return cached;
        }
      }
    } catch {}
  }

  let sRes = await fetch(`${API_BASE}/auth/phone/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: OWNER_PHONE }),
  });
  if (sRes.status === 429) {
    console.log('Rate limited on send-otp, waiting 45 seconds for window reset...');
    await new Promise((r) => setTimeout(r, 45000));
    sRes = await fetch(`${API_BASE}/auth/phone/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: OWNER_PHONE }),
    });
  }
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

  const cookieObj = {
    name: '__Secure-logix-dine.session_token',
    value: match[1],
    domain: '.logixsoft.in',
    path: '/',
  };
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cookieObj));
  return cookieObj;
}

async function run() {
  console.log('--- Testing Mobile Cart View Items Modal ---');
  const authCookie = await fetchAuthCookie();

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  });

  await mobileContext.addCookies([
    {
      name: authCookie.name,
      value: authCookie.value,
      domain: authCookie.domain,
      path: authCookie.path,
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await mobileContext.newPage();
  await page.goto(`${WEB_BASE}/pos?table=T1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Click Chicken Biryani item card to add it to cart
  const itemCard = page.locator('text=Chicken Biryani').first();
  if (await itemCard.isVisible()) {
    console.log('Clicking Chicken Biryani to add to cart...');
    await itemCard.click();
    await page.waitForTimeout(800);
  }

  // Find floating cart button
  const floatingCartBtn = page.locator('button:has-text("Cart (")').first();
  if (await floatingCartBtn.isVisible()) {
    console.log('Clicking floating Cart button...');
    await floatingCartBtn.click();
    await page.waitForTimeout(1000);
  }

  // Save screenshot of open cart drawer
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '01_mobile_cart_drawer_open.png'),
    fullPage: false,
  });
  console.log('Saved screenshot: 01_mobile_cart_drawer_open.png');

  // Wait for View Items button inside active table section inside the mobile cart drawer
  console.log('Waiting for View Items inside mobile drawer...');
  const viewItemsLocator = page.locator('.mantine-Drawer-root button:has-text("View Items")');
  await viewItemsLocator.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Clicking "View Items" button inside cart drawer...');
  await viewItemsLocator.click();
  await page.waitForTimeout(1200);

  // Save screenshot showing View Items modal properly displayed on top of drawer
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '01b_mobile_view_items_modal_above_drawer.png'),
    fullPage: false,
  });
  console.log('Saved screenshot: 01b_mobile_view_items_modal_above_drawer.png');

  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
