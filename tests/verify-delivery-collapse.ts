import { chromium } from '@playwright/test';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const OWNER_PHONE = '+917276718848';
const DEV_OTP = '123456';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

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

async function run() {
  console.log('Fetching auth cookie...');
  const authCookie = await fetchAuthCookie();

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: authCookie.name,
      value: authCookie.value,
      domain: '.logixsoft.in',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: authCookie.name,
      value: authCookie.value,
      domain: 'dine.logixsoft.in',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();
  console.log('Navigating to /pos...');
  await page.goto(`${WEB_BASE}/pos`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Add dishes to cart to show items space
  console.log('Adding "Crispy Corn Salt & Pepper" to cart...');
  const crispyCorn = page.locator('text="Crispy Corn Salt & Pepper"').first();
  await crispyCorn.click();
  await page.waitForTimeout(800);

  console.log('Adding "Dal Makhani" to cart...');
  const dalMakhani = page.locator('text="Dal Makhani"').first();
  if (await dalMakhani.isVisible()) {
    await dalMakhani.click();
    await page.waitForTimeout(800);
  }

  // Switch mode to Delivery
  console.log('Switching to Delivery mode...');
  const deliveryTab = page.locator('label:has-text("Delivery"), button:has-text("Delivery")').first();
  await deliveryTab.click();
  await page.waitForTimeout(1000);

  // 1. Verify collapsed state and take screenshot
  console.log('Capturing collapsed delivery state...');
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pos_delivery_collapsed.png') });

  // 2. Click Expand
  console.log('Expanding delivery address...');
  const expandBtn = page.locator('button[aria-label="Expand delivery address"], button:has-text("Expand")').first();
  if (await expandBtn.isVisible()) {
    await expandBtn.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pos_delivery_expanded.png') });

  // 3. Fill in recipient and address
  console.log('Filling address fields...');
  const nameInput = page.locator('input[placeholder*="Recipient Name"]').first();
  const addrInput = page.locator('input[placeholder*="House/Flat"]').first();
  const landmarkInput = page.locator('input[placeholder*="Landmark"]').first();

  if (await nameInput.isVisible()) {
    await nameInput.fill('Dr. Aakash Sharma');
    await addrInput.fill('Flat 402, Sunshine Heights, 12th Main Road');
    await landmarkInput.fill('Near Metro Station');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pos_delivery_filled.png') });
  }

  // 4. Click Collapse / Done
  console.log('Collapsing address back to give space to items...');
  const doneCollapseBtn = page.locator('button:has-text("Done · Collapse Address"), button[aria-label="Collapse delivery address"]').first();
  if (await doneCollapseBtn.isVisible()) {
    await doneCollapseBtn.click();
    await page.waitForTimeout(800);
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pos_delivery_collapsed_with_address.png') });

  console.log('Verification completed successfully!');
  await browser.close();
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
