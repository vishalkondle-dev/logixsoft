import { chromium } from '@playwright/test';

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
  return { cookieName, cookieValue, user: data.user };
}

async function runTest() {
  console.log('Testing Store Scope Switching from Admin...');
  const auth = await loginAndGetCookie('+917276718848');
  console.log(`✅ Logged in as: ${auth.user.name} (${auth.user.role})`);

  // First, verify API endpoint /admin/impersonate/:restaurantId directly
  const restsRes = await fetch(`${API_BASE}/admin/restaurants`, {
    headers: {
      Cookie: `${auth.cookieName}=${auth.cookieValue}`,
    },
  });
  const rests = await restsRes.json();
  console.log(`Fetched ${rests.length} restaurants from API.`);
  if (!rests.length) throw new Error('No restaurants found');

  const targetRest = rests[0];
  console.log(`Testing impersonate endpoint for: ${targetRest.name} (${targetRest.id})`);

  const impRes = await fetch(`${API_BASE}/admin/impersonate/${targetRest.id}`, {
    method: 'POST',
    headers: {
      Cookie: `${auth.cookieName}=${auth.cookieValue}`,
    },
  });
  console.log(`Impersonate API Status: ${impRes.status}`);
  const impData = await impRes.json();
  console.log('Impersonate Response:', JSON.stringify(impData));

  if (!impRes.ok || !impData.success) {
    throw new Error('Impersonate API failed');
  }

  // Next, launch Playwright browser and test the UI click
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

  await context.addCookies([
    {
      name: auth.cookieName,
      value: decodeURIComponent(auth.cookieValue),
      domain: '.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'None',
    },
    {
      name: auth.cookieName,
      value: decodeURIComponent(auth.cookieValue),
      domain: 'dine.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'None',
    },
  ]);

  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  console.log('\nNavigating to /admin/restaurants in browser...');
  await page.goto(`${WEB_BASE}/admin/restaurants`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('Looking for "Enter POS" button in table...');
  const enterPosBtn = page.locator('button:has-text("Enter POS")').first();
  await enterPosBtn.waitFor({ state: 'visible', timeout: 10000 });
  console.log('Clicking "Enter POS"...');
  await enterPosBtn.click();

  // Wait for navigation to /pos
  console.log('Waiting for URL to transition to /pos...');
  await page.waitForURL(/.*\/pos.*/, { timeout: 15000 });
  console.log(`✅ Successfully navigated to: ${page.url()}`);

  await page.waitForTimeout(3000);

  // Check if any error notification appeared
  const errorNotification = page.locator('.mantine-Notification-root[data-color="red"]');
  const hasError = await errorNotification.count();
  if (hasError > 0) {
    const errorText = await errorNotification.innerText();
    console.error(`❌ Error notification found: ${errorText}`);
  } else {
    console.log('🎉 No error notification! Scope switch completely succeeded!');
  }

  // Test 2: Navigate back to /admin/overview and click header "Enter POS" button
  console.log('\nNavigating to /admin/overview to test header Enter POS button...');
  await page.goto(`${WEB_BASE}/admin/overview`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(2000);

  const headerEnterBtn = page.locator('header button:has-text("Enter POS"), header button:has-text("Enter")').first();
  await headerEnterBtn.waitFor({ state: 'visible', timeout: 10000 });
  console.log('Clicking Admin Header "Enter POS" button...');
  await headerEnterBtn.click();

  await page.waitForURL(/.*\/pos.*/, { timeout: 15000 });
  console.log(`✅ Header button successfully navigated to: ${page.url()}`);
  await page.waitForTimeout(2000);

  const headerHasError = await page.locator('.mantine-Notification-root[data-color="red"]').count();
  if (headerHasError > 0) {
    console.error('❌ Error notification found after header switch!');
  } else {
    console.log('🎉 Header switch completely succeeded with zero errors!');
  }

  await browser.close();
}

runTest().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
