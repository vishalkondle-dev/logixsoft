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
  console.log('Logging in...');
  const auth = await loginAndGetCookie('+919985720478');
  console.log('Logged in successfully, cookie:', auth.cookieName);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 }
  });

  await context.addCookies([
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

  const page = await context.newPage();
  const targetUrl = `${WEB_BASE}/tables?tab=waitlist&outletId=outlet_saltnNxAhUEH4b3I4kyDmT0V`;
  console.log(`Navigating to ${targetUrl}...`);
  await page.goto(targetUrl, { waitUntil: 'networkidle' });

  // Wait for segmented control to appear
  await page.waitForSelector('.mantine-SegmentedControl-root', { timeout: 15000 });
  await page.waitForTimeout(2000);

  // Inspect the text of the labels inside the SegmentedControl
  const segmentedLabels = await page.$$eval('.mantine-SegmentedControl-label', els => els.map(e => e.textContent?.trim()));
  console.log('SegmentedControl labels on initial load:', segmentedLabels);

  const allEntriesLabel = segmentedLabels.find(l => l && l.includes('All Entries Today'));
  console.log('All Entries Today label:', allEntriesLabel);

  const screenshotPath = `${ARTIFACT_DIR}/waitlist_initial_count_verified.png`;
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot saved to ${screenshotPath}`);

  await browser.close();

  if (allEntriesLabel && allEntriesLabel.includes('(0)')) {
    console.error('FAIL: All Entries Today still shows (0) on initial load!');
    process.exit(1);
  } else {
    console.log('SUCCESS: All Entries Today properly populated on initial load without clicking!');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
