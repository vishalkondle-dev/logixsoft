import { chromium } from '@playwright/test';
import * as fs from 'fs';

const WEB_BASE = 'https://dine.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

async function main() {
  console.log('=== Verifying Customer Profile Page Live on Production ===\n');

  const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: cached.name,
      value: cached.value,
      domain: cached.domain,
      path: cached.path,
      secure: true,
      httpOnly: true,
      sameSite: 'None',
    },
    {
      name: '__Secure-logix-dine.session_token',
      value: cached.value,
      domain: 'dine.logixsoft.in',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'None',
    },
  ]);

  const page = await context.newPage();

  // Test 1: Direct navigation to /customers/7276718848
  console.log('Navigating to https://dine.logixsoft.in/customers/7276718848 ...');
  await page.goto(`${WEB_BASE}/customers/7276718848`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  console.log('Page title:', await page.title());
  console.log('Page URL:', page.url());

  // Capture hero screenshot
  await page.screenshot({ path: `${SCREENSHOT_DIR}/32_customer_profile_hero.png` });
  console.log('Saved 32_customer_profile_hero.png');

  // Test 2: Expand first order in Order History tab
  console.log('\nTesting Order History expansion...');
  const firstOrderExpandBtn = page.locator("button[aria-label='Expand order details']").first();
  if (await firstOrderExpandBtn.count() > 0) {
    await firstOrderExpandBtn.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/33_customer_profile_order_expanded.png` });
    console.log('Saved 33_customer_profile_order_expanded.png');
  }

  // Test 3: Click Favorite Dishes tab
  console.log('\nTesting Favorite Dishes tab...');
  const favTab = page.locator("button[role='tab']:has-text('Favorite Dishes')");
  await favTab.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/34_customer_profile_favorites.png` });
  console.log('Saved 34_customer_profile_favorites.png');

  // Test 4: Click Dining Preferences & Outlets tab
  console.log('\nTesting Dining Preferences & Outlets tab...');
  const analyticsTab = page.locator("button[role='tab']:has-text('Dining Preferences')");
  await analyticsTab.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/35_customer_profile_analytics.png` });
  console.log('Saved 35_customer_profile_analytics.png');

  // Test 5: Click Staff Notes tab
  console.log('\nTesting Staff Notes tab...');
  const notesTab = page.locator("button[role='tab']:has-text('Staff Notes')");
  await notesTab.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/36_customer_profile_notes.png` });
  console.log('Saved 36_customer_profile_notes.png');

  // Test 6: Verify navigation from Orders page
  console.log('\nTesting Navigation from /orders page...');
  await page.goto(`${WEB_BASE}/orders`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const customerBadgeInOrders = page.locator("a[href*='/customers/']").first();
  if (await customerBadgeInOrders.count() > 0) {
    const badgeText = await customerBadgeInOrders.textContent();
    console.log('Found customer link in Orders page:', badgeText);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/37_orders_page_with_customer_links.png` });
    console.log('Saved 37_orders_page_with_customer_links.png');
  }

  await browser.close();
  console.log('\n=== All Customer Profile Verifications Complete! ===');
}

main().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
