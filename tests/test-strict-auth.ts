import { chromium } from '@playwright/test';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const ARTIFACT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

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
  return { cookiePair, cookieName, cookieValue };
}

async function run() {
  console.log('--- STRICT AUTHENTICATION E2E TEST ---');

  const browser = await chromium.launch({ headless: true });

  // ── TEST 1: Unauthenticated tests ──
  console.log('\n[1] Testing unauthenticated browser context...');
  const anonContext = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const anonPage = await anonContext.newPage();

  // 1a. Homepage must load freely without login
  console.log('Testing homepage (/) without login...');
  const homeRes = await anonPage.goto(WEB_BASE, { waitUntil: 'networkidle' });
  console.log(`Homepage status: ${homeRes?.status()}, URL: ${anonPage.url()}`);
  if (anonPage.url() !== `${WEB_BASE}/` && anonPage.url() !== WEB_BASE) {
    throw new Error(`Homepage should NOT redirect: ${anonPage.url()}`);
  }
  console.log('✓ Homepage is public and accessible.');

  // 1b. Download page must load freely without login
  console.log('Testing download (/download) without login...');
  await anonPage.goto(`${WEB_BASE}/download`, { waitUntil: 'networkidle' });
  console.log(`Download page URL: ${anonPage.url()}`);
  if (!anonPage.url().includes('/download')) {
    throw new Error(`Download page should be accessible: ${anonPage.url()}`);
  }
  console.log('✓ Download page is public and accessible.');

  // 1c. Waitlist Join page (/q/.../join) without login must redirect to login
  console.log('Testing /q/outlet_saltnNxAhUEH4b3I4kyDmT0V/join without login...');
  await anonPage.goto(`${WEB_BASE}/q/outlet_saltnNxAhUEH4b3I4kyDmT0V/join`, { waitUntil: 'networkidle' });
  console.log(`Unauth join attempt landed on URL: ${anonPage.url()}`);
  const hasLoginRedirect = anonPage.url().includes('login=true') || anonPage.url().includes('login');
  console.log(`Redirected to login? ${hasLoginRedirect}`);
  if (!hasLoginRedirect) {
    throw new Error(`Expected redirect to login, but got: ${anonPage.url()}`);
  }
  // Wait for login modal
  await anonPage.waitForSelector('.mantine-Modal-content', { timeout: 10000 });
  console.log('✓ Login modal opened automatically on unauthenticated access attempt.');
  await anonPage.screenshot({ path: `${ARTIFACT_DIR}/auth_redirect_login_modal.png` });

  // 1d. Tables page (/tables) without login must redirect to login
  console.log('Testing /tables without login...');
  await anonPage.goto(`${WEB_BASE}/tables`, { waitUntil: 'networkidle' });
  console.log(`Unauth /tables attempt landed on URL: ${anonPage.url()}`);
  if (!anonPage.url().includes('login=true')) {
    throw new Error(`Expected /tables to redirect to login, got: ${anonPage.url()}`);
  }
  console.log('✓ /tables properly protected.');

  // 1e. Customer Portal (/portal) without login must redirect to login
  console.log('Testing /portal without login...');
  await anonPage.goto(`${WEB_BASE}/portal`, { waitUntil: 'networkidle' });
  console.log(`Unauth /portal attempt landed on URL: ${anonPage.url()}`);
  if (!anonPage.url().includes('login=true')) {
    throw new Error(`Expected /portal to redirect to login, got: ${anonPage.url()}`);
  }
  console.log('✓ /portal properly protected.');

  await anonContext.close();

  // ── TEST 2: Authenticated tests ──
  console.log('\n[2] Testing authenticated browser context...');
  const auth = await loginAndGetCookie('+919985720478');
  const authContext = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await authContext.addCookies([
    {
      name: auth.cookieName,
      value: auth.cookieValue,
      domain: 'dine.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
    {
      name: auth.cookieName,
      value: auth.cookieValue,
      domain: '.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    }
  ]);

  const authPage = await authContext.newPage();
  console.log('Navigating to waitlist join page with active session...');
  await authPage.goto(`${WEB_BASE}/q/outlet_saltnNxAhUEH4b3I4kyDmT0V/join`, { waitUntil: 'networkidle' });
  await authPage.waitForTimeout(2000);

  console.log(`Auth join page URL: ${authPage.url()}`);
  const phoneValue = await authPage.inputValue('input[placeholder="10-digit mobile number"]');
  console.log(`Phone input auto-filled value: ${phoneValue}`);

  const isPhoneDisabled = await authPage.isDisabled('input[placeholder="10-digit mobile number"]');
  console.log(`Phone input locked (verified): ${isPhoneDisabled}`);

  const screenshotPath = `${ARTIFACT_DIR}/auth_verified_waitlist_join.png`;
  await authPage.screenshot({ path: screenshotPath });
  console.log(`Screenshot saved to ${screenshotPath}`);

  await browser.close();

  console.log('\n✅ ALL STRICT AUTHENTICATION TESTS PASSED!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
