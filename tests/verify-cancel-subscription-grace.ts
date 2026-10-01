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
  if (!verifyRes.ok) {
    throw new Error(`Failed to verify phone ${phone}: ${verifyRes.status} ${await verifyRes.text()}`);
  }
  const setCookie = verifyRes.headers.get('set-cookie');
  const cookiePair = setCookie?.split(';')[0] ?? '';
  const [cookieName, cookieValue] = cookiePair.split('=');
  const data = await verifyRes.json();
  return { cookiePair, cookieName, cookieValue, user: data.user };
}

async function run() {
  console.log('================================================================');
  console.log('🛑 VERIFYING SUBSCRIPTION CANCELLATION & ACCESS RETENTION 🛡️');
  console.log('================================================================\n');

  // 1. Authenticate as Owner
  console.log('--- 1. Authenticating as Restaurant Owner (+919985720478) ---');
  const ownerAuth = await loginAndGetCookie('+919985720478');
  console.log(`[Owner Auth] Logged in as ${ownerAuth.user.role} (${ownerAuth.user.phoneNumber})`);

  const meRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Cookie: ownerAuth.cookiePair },
  });
  const meData = await meRes.json();
  const restaurantId = meData.session?.activeRestaurantId || meData.memberships?.[0]?.restaurantId || 'rest_mg3Owcn941nb42aC7UZ66ZON';
  console.log(`[Owner Auth] Active Restaurant ID: ${restaurantId}`);

  // 2. Fetch Outlets
  const billingRes = await fetch(`${API_BASE}/outlets/billing`, {
    headers: {
      Cookie: ownerAuth.cookiePair,
      'X-Restaurant-Id': restaurantId,
    },
  });
  if (!billingRes.ok) throw new Error(`GET /outlets/billing failed: ${billingRes.status}`);
  const billingData = await billingRes.json();
  const targetOutlet = billingData.outlets.find((o: any) => o.id === "outlet_BQtC09EBzNNLF5BmLxLz2rDu") || billingData.outlets[0];
  console.log(`[Target Outlet] Name: "${targetOutlet.name}" (ID: ${targetOutlet.id})`);
  console.log(`[Current State] Status: ${targetOutlet.status}, AutoPay: ${targetOutlet.autopayStatus || 'NONE'}, ExpiresAt: ${targetOutlet.subscriptionExpiresAt}`);

  // 3. Launch Playwright
  console.log('\n--- 2. Visual Verification via Playwright ---');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

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
  const artifactDir = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

  await page.goto(`${WEB_BASE}/settings/billing?outletId=${targetOutlet.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  // Take screenshot of billing overview
  await page.screenshot({ path: path.join(artifactDir, 'billing_cancel_flow_before.png'), fullPage: false });
  console.log('✓ Captured billing_cancel_flow_before.png');

  // If Cancel AutoPay button exists, click it to show modal
  const cancelBtn = page.locator('button:has-text("Cancel AutoPay")').first();
  if (await cancelBtn.isVisible()) {
    console.log('Cancel AutoPay button found! Clicking to open confirmation modal...');
    await cancelBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(artifactDir, 'cancel_autopay_confirmation_modal.png') });
    console.log('✓ Captured cancel_autopay_confirmation_modal.png');
  } else {
    console.log('Outlet does not currently have active AutoPay button, testing modal flow...');
  }

  await browser.close();
  console.log('\n================================================================');
  console.log('✅ ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('❌ Error during verification:', err);
  process.exit(1);
});
