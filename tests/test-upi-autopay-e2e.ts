import { chromium } from '@playwright/test';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const PG_API_BASE = 'https://payment-api.logixsoft.in';
const PG_WEB_BASE = 'https://payment.logixsoft.in';

async function loginAndGetCookie(phone: string) {
  const verifyRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, otp: '123456' }),
  });
  if (!verifyRes.ok) {
    const text = await verifyRes.text();
    throw new Error(`Login failed for ${phone}: ${text}`);
  }
  const setCookie = verifyRes.headers.get('set-cookie');
  const cookiePair = setCookie?.split(';')[0] ?? '';
  const [cookieName, cookieValue] = cookiePair.split('=');
  const data = await verifyRes.json();
  return { cookieName, cookieValue, user: data.user };
}

async function runTest() {
  console.log('==================================================');
  console.log('🚀 Starting UPI AutoPay End-to-End Verification');
  console.log('==================================================');

  // 1. Authenticate as Restaurant Owner Sowmya (+919985720478)
  console.log('\n[Step 1] Authenticating as Owner Sowmya...');
  const auth = await loginAndGetCookie('+919985720478');
  console.log(`✅ Authenticated: ${auth.user.name} (${auth.user.role}) - ID: ${auth.user.id}`);

  const cookieHeader = `${auth.cookieName}=${auth.cookieValue}`;

  // 2. Fetch Restaurant and Outlets
  console.log('\n[Step 2] Fetching restaurant outlets and billing details...');
  const meRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Cookie: cookieHeader },
  });
  const meData = await meRes.json();
  const restaurantId = meData.session?.activeRestaurantId || 'rest_mg3Owcn941nb42aC7UZ66ZON';
  console.log(`Active Restaurant ID: ${restaurantId}`);

  const billingRes = await fetch(`${API_BASE}/outlets/billing`, {
    headers: {
      Cookie: cookieHeader,
      'X-Restaurant-Id': restaurantId,
    },
  });
  if (!billingRes.ok) {
    throw new Error(`Failed to fetch billing data: ${await billingRes.text()}`);
  }
  const billingData = await billingRes.json();
  console.log(`Fetched ${billingData.outlets.length} outlet(s) under restaurant: ${billingData.restaurant.name}`);

  const targetOutlet = billingData.outlets[0];
  console.log(`Selected target outlet: "${targetOutlet.name}" (ID: ${targetOutlet.id})`);
  console.log(`Initial Status: plan=${targetOutlet.planTier}, autopayStatus=${targetOutlet.autopayStatus || 'NONE'}`);

  // 3. Initiate UPI AutoPay Mandate for this outlet
  console.log('\n[Step 3] Calling POST /outlets/:id/autopay/initiate...');
  const initiateRes = await fetch(`${API_BASE}/outlets/${targetOutlet.id}/autopay/initiate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
      'X-Restaurant-Id': restaurantId,
    },
    body: JSON.stringify({
      planTier: 'PRO',
      billingCycle: 'MONTHLY',
    }),
  });

  if (!initiateRes.ok) {
    throw new Error(`Initiate AutoPay failed: ${await initiateRes.text()}`);
  }

  const initiateData = await initiateRes.json();
  console.log('✅ AutoPay Initiated Successfully:');
  console.log(`   - Mandate ID: ${initiateData.mandateId}`);
  console.log(`   - Checkout URL: ${initiateData.checkoutUrl}`);
  console.log(`   - Recurring Amount: ₹${initiateData.recurringAmount / 100}`);
  console.log(`   - Frequency: ${initiateData.frequency}`);
  console.log(`   - UPI String: ${initiateData.upiString.substring(0, 60)}...`);

  // Verify mandate exists in PG API
  console.log('\n[Step 4] Checking mandate status in logix-pg API...');
  const pgMandateRes = await fetch(`${PG_API_BASE}/api/v1/mandates/${initiateData.mandateId}`);
  if (!pgMandateRes.ok) {
    throw new Error(`PG Mandate query failed: ${await pgMandateRes.text()}`);
  }
  const pgMandate = await pgMandateRes.json();
  console.log(`✅ PG Mandate Status: ${pgMandate.status} (expected PENDING)`);
  if (pgMandate.status !== 'PENDING') {
    throw new Error(`Expected PENDING status, got ${pgMandate.status}`);
  }

  // 5. Simulate Mandate Authorization (Mock NPCI / Bank Callback)
  console.log('\n[Step 5] Simulating Mandate Authorization on PG API...');
  const authorizeRes = await fetch(`${PG_API_BASE}/api/v1/mandates/${initiateData.mandateId}/simulate-authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerVpa: 'sowmya@okhdfcbank' }),
  });
  if (!authorizeRes.ok) {
    throw new Error(`Simulate authorize failed: ${await authorizeRes.text()}`);
  }
  const authorizeData = await authorizeRes.json();
  console.log('✅ Mandate Authorized on PG:');
  console.log(`   - Status: ${authorizeData.status}`);
  console.log(`   - UMN: ${authorizeData.umn}`);
  console.log(`   - Next Billing: ${authorizeData.nextBillingDate}`);

  // 6. Give webhook dispatcher 2 seconds to deliver to Dine API and update outlet
  console.log('\n[Step 6] Waiting 2.5s for Dine API webhook ingestion...');
  await new Promise((r) => setTimeout(r, 2500));

  // 7. Verify Outlet in Dine API has updated to ACTIVE
  console.log('\n[Step 7] Verifying outlet status in Dine API after webhook...');
  const verifyBillingRes = await fetch(`${API_BASE}/outlets/billing`, {
    headers: {
      Cookie: cookieHeader,
      'X-Restaurant-Id': restaurantId,
    },
  });
  const updatedBilling = await verifyBillingRes.json();
  const updatedOutlet = updatedBilling.outlets.find((o: any) => o.id === targetOutlet.id);

  console.log(`   - Outlet Name: ${updatedOutlet.name}`);
  console.log(`   - Plan Tier: ${updatedOutlet.planTier}`);
  console.log(`   - Status: ${updatedOutlet.status}`);
  console.log(`   - AutoPay Status: ${updatedOutlet.autopayStatus}`);
  console.log(`   - AutoPay Mandate ID: ${updatedOutlet.autopayMandateId}`);
  console.log(`   - AutoPay UMN: ${updatedOutlet.autopayUmn}`);
  console.log(`   - Next Billing Date: ${updatedOutlet.autopayNextBillingAt}`);
  console.log(`   - Subscription Expires At: ${updatedOutlet.subscriptionExpiresAt}`);

  if (updatedOutlet.autopayStatus !== 'ACTIVE') {
    throw new Error(`Expected outlet autopayStatus to be ACTIVE, got ${updatedOutlet.autopayStatus}`);
  }
  console.log('🎉 Outlet AutoPay is ACTIVE with valid UMN!');

  // 8. Test Auto-Debit Simulation
  console.log('\n[Step 8] Testing Recurring Auto-Debit on PG API...');
  const debitRes = await fetch(`${PG_API_BASE}/api/v1/mandates/${initiateData.mandateId}/debit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 149900 }),
  });
  if (!debitRes.ok) {
    throw new Error(`Debit failed: ${await debitRes.text()}`);
  }
  const debitData = await debitRes.json();
  console.log(`✅ Debit Executed: Charge ID ${debitData.chargeId}, Amount ₹${debitData.amount / 100}, Status: ${debitData.status}`);

  // 9. Launch Headless Browser to verify Web UI and capture screenshots
  console.log('\n[Step 9] Launching Playwright browser to verify UI and capture screenshots...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 1,
  });

  await context.addCookies([
    {
      name: auth.cookieName,
      value: decodeURIComponent(auth.cookieValue),
      domain: '.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();

  // Test 9A: Mandate Checkout Page in PG Web
  console.log(`Navigating to PG Mandate checkout UI: ${initiateData.checkoutUrl}...`);
  await page.goto(initiateData.checkoutUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const mandateScreenshotPath = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e/mandate_checkout_screen.png';
  await page.screenshot({ path: mandateScreenshotPath, fullPage: true });
  console.log(`📸 Captured Mandate Checkout screenshot: ${mandateScreenshotPath}`);

  // Test 9B: Billing Management in Dine Web
  console.log(`Navigating to Dine Web Billing page: ${WEB_BASE}/settings/billing...`);
  await page.goto(`${WEB_BASE}/settings/billing`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  const billingScreenshotPath = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e/billing_autopay_active.png';
  await page.screenshot({ path: billingScreenshotPath, fullPage: true });
  console.log(`📸 Captured Dine Billing Management screenshot: ${billingScreenshotPath}`);

  await browser.close();

  console.log('\n==================================================');
  console.log('✅ ALL UPI AUTOPAY TESTS PASSED END-TO-END!');
  console.log('==================================================');
}

runTest().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  process.exit(1);
});
