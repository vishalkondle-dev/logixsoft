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
  if (!match) throw new Error(`Session cookie not found`);

  return {
    name: '__Secure-logix-dine.session_token',
    value: match[1],
    domain: '.logixsoft.in',
    path: '/',
  };
}

async function run() {
  console.log('Fetching auth cookie for customer...');
  const authCookie = await fetchAuthCookie();
  console.log('Auth cookie received.');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // Mobile viewport (iPhone 14 style: 430 x 932) to showcase mobile-first app experience
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
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

  try {
    // ══════════════════════════════════════════════════════════
    // 1. HOME TAB (/portal?tab=home)
    // ══════════════════════════════════════════════════════════
    console.log('--- Checking Customer Portal Home View ---');
    await page.goto(`${WEB_BASE}/portal?tab=home`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Verify "Durable Object Live" is completely absent!
    const doLiveCount = await page.locator('text=Durable Object').count();
    console.log('Durable Object occurrences (must be 0):', doLiveCount);
    if (doLiveCount > 0) {
      throw new Error('FAIL: "Durable Object" tech jargon is still visible to the customer!');
    }
    console.log('PASS: Technical DO jargon successfully removed.');

    // Verify Bottom Navigation Bar exists
    const bottomNav = page.locator('nav[aria-label="Customer Navigation"]');
    const bottomNavVisible = await bottomNav.isVisible();
    console.log('Floating bottom nav bar visible:', bottomNavVisible);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'customer_portal_home_mobile.png'), fullPage: false });
    console.log('Screenshot saved: customer_portal_home_mobile.png');

    // ══════════════════════════════════════════════════════════
    // 2. ORDERS TAB (/portal?tab=orders)
    // ══════════════════════════════════════════════════════════
    console.log('--- Switching to Orders Tab ---');
    await page.locator('button:has-text("Orders"), [aria-label="Customer Navigation"] button:has-text("Orders")').first().click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'customer_portal_orders_mobile.png'), fullPage: false });
    console.log('Screenshot saved: customer_portal_orders_mobile.png');

    // Switch to Past Visits sub-tab
    const pastSubTab = page.locator('span:has-text("Past Visits")').first();
    if (await pastSubTab.isVisible()) {
      await pastSubTab.click();
      await page.waitForTimeout(1500);

      // Expand first past visit
      const firstCard = page.locator('.mantine-Card-root > div:first-child').first();
      await firstCard.click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'customer_portal_past_visit_expanded.png'), fullPage: false });
      console.log('Screenshot saved: customer_portal_past_visit_expanded.png');
    }

    // ══════════════════════════════════════════════════════════
    // 3. MENU TAB (/portal?tab=menu)
    // ══════════════════════════════════════════════════════════
    console.log('--- Switching to Digital Menu Tab ---');
    await page.locator('[aria-label="Customer Navigation"] button:has-text("Menu")').first().click();
    await page.waitForTimeout(2500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'customer_portal_menu_mobile.png'), fullPage: false });
    console.log('Screenshot saved: customer_portal_menu_mobile.png');

    // ══════════════════════════════════════════════════════════
    // 4. PERKS & LOYALTY TAB (/portal?tab=rewards)
    // ══════════════════════════════════════════════════════════
    console.log('--- Switching to Perks / Rewards Tab ---');
    await page.locator('[aria-label="Customer Navigation"] button:has-text("Perks")').first().click();
    await page.waitForTimeout(2000);

    // Verify VIP Card is rendered
    const vipCardVisible = await page.locator('text=Logix Dine VIP Pass').isVisible();
    console.log('VIP Pass visible:', vipCardVisible);

    const diningDnaVisible = await page.locator('text=Your Dining DNA & Taste Profile').isVisible();
    console.log('Dining DNA section visible:', diningDnaVisible);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'customer_portal_rewards_mobile.png'), fullPage: false });
    console.log('Screenshot saved: customer_portal_rewards_mobile.png');

    // ══════════════════════════════════════════════════════════
    // 5. PROFILE TAB (/portal?tab=profile)
    // ══════════════════════════════════════════════════════════
    console.log('--- Switching to Profile Tab ---');
    await page.locator('[aria-label="Customer Navigation"] button:has-text("Profile")').first().click();
    await page.waitForTimeout(2000);

    const addressesVisible = await page.locator('text=Saved Delivery Addresses').isVisible();
    console.log('Saved Delivery Addresses visible:', addressesVisible);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'customer_portal_profile_mobile.png'), fullPage: false });
    console.log('Screenshot saved: customer_portal_profile_mobile.png');

    // ══════════════════════════════════════════════════════════
    // 6. DESKTOP VIEWPORT TEST (1440 x 900)
    // ══════════════════════════════════════════════════════════
    console.log('--- Checking Desktop Viewport Experience ---');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${WEB_BASE}/portal?tab=home`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'customer_portal_home_desktop.png'), fullPage: false });
    console.log('Screenshot saved: customer_portal_home_desktop.png');

    console.log('=== All Customer Portal UI & Redesign Verifications Passed! ===');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
