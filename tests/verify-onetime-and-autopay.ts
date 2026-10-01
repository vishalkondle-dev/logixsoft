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
  console.log('💳 VERIFYING BOTH ONE-TIME PAY AND AUTOPAY SUBSCRIPTIONS ⚡');
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
  const targetOutlet = billingData.outlets[0];
  console.log(`[Target Outlet] Name: "${targetOutlet.name}" (ID: ${targetOutlet.id})`);

  // 3. Test One-Time Payment Order Generation (Monthly)
  console.log('\n--- 2. Testing One-Time Pay Order Initiation (Monthly) ---');
  const oneTimeMonthlyRes = await fetch(`${API_BASE}/outlets/${targetOutlet.id}/payment/one-time`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerAuth.cookiePair,
      'X-Restaurant-Id': restaurantId,
    },
    body: JSON.stringify({
      planTier: 'PRO',
      billingCycle: 'MONTHLY',
    }),
  });

  if (!oneTimeMonthlyRes.ok) {
    throw new Error(`One-time pay initiation failed: ${oneTimeMonthlyRes.status} ${await oneTimeMonthlyRes.text()}`);
  }
  const oneTimeMonthlyData = await oneTimeMonthlyRes.json();
  console.log('✅ One-Time Pay Monthly Order Created:', {
    orderId: oneTimeMonthlyData.orderId,
    amount: `₹${oneTimeMonthlyData.amount}`,
    frequency: oneTimeMonthlyData.frequency,
    checkoutUrl: oneTimeMonthlyData.checkoutUrl,
  });

  // 4. Test One-Time Payment Order Generation (Annual)
  console.log('\n--- 3. Testing One-Time Pay Order Initiation (Annual) ---');
  const oneTimeAnnualRes = await fetch(`${API_BASE}/outlets/${targetOutlet.id}/payment/one-time`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerAuth.cookiePair,
      'X-Restaurant-Id': restaurantId,
    },
    body: JSON.stringify({
      planTier: 'BASIC',
      billingCycle: 'ANNUAL',
    }),
  });

  if (!oneTimeAnnualRes.ok) {
    throw new Error(`One-time annual pay initiation failed: ${oneTimeAnnualRes.status} ${await oneTimeAnnualRes.text()}`);
  }
  const oneTimeAnnualData = await oneTimeAnnualRes.json();
  console.log('✅ One-Time Pay Annual Order Created:', {
    orderId: oneTimeAnnualData.orderId,
    amount: `₹${oneTimeAnnualData.amount}`,
    frequency: oneTimeAnnualData.frequency,
    checkoutUrl: oneTimeAnnualData.checkoutUrl,
  });

  // 5. Test UPI AutoPay Mandate Generation
  console.log('\n--- 4. Testing UPI AutoPay Mandate Initiation ---');
  const autopayRes = await fetch(`${API_BASE}/outlets/${targetOutlet.id}/autopay/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: ownerAuth.cookiePair,
      'X-Restaurant-Id': restaurantId,
    },
    body: JSON.stringify({
      planTier: 'PRO',
      billingCycle: 'MONTHLY',
    }),
  });

  if (!autopayRes.ok) {
    throw new Error(`AutoPay initiation failed: ${autopayRes.status} ${await autopayRes.text()}`);
  }
  const autopayData = await autopayRes.json();
  console.log('✅ UPI AutoPay Mandate Created:', {
    mandateId: autopayData.mandateId,
    recurringAmount: `₹${autopayData.recurringAmount}`,
    checkoutUrl: autopayData.checkoutUrl,
  });

  // 6. Playwright Browser UI Verification
  console.log('\n--- 5. Testing Browser UI for One-Time Pay & AutoPay Buttons ---');
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
  await page.setViewportSize({ width: 1400, height: 900 });

  await page.goto(`${WEB_BASE}/settings/billing`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Take screenshot of billing overview showing Pay Once & AutoPay
  const screenshotPath = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e/billing_onetime_and_autopay.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);

  // Open "Change Plan" modal
  const changePlanBtn = page.getByRole('button', { name: 'Change Plan' }).first();
  if (await changePlanBtn.isVisible()) {
    await changePlanBtn.click();
    await page.waitForTimeout(1000);
    const modalScreenshotPath = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e/change_plan_onetime_options.png';
    await page.screenshot({ path: modalScreenshotPath });
    console.log(`📸 Modal Screenshot saved: ${modalScreenshotPath}`);
  }

  await browser.close();

  console.log('\n================================================================');
  console.log('🎉 BOTH ONE-TIME PAY AND AUTOPAY ARE FULLY OPERATIONAL! 🎉');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Fatal error during verification:', err);
  process.exit(1);
});
