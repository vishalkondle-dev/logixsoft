import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const WEB_BASE = 'https://dine.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/d19bc639-79a0-4e4f-8b9b-d44a9ddf7d3a';

async function run() {
  console.log('=== Verifying Bug Fixes Across Dine App ===\n');

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

  // 1. Tables Dashboard & View Bill Modal
  console.log('1. Checking Tables Page & Card Buttons...');
  await page.goto(`${WEB_BASE}/tables`, { waitUntil: 'commit' });
  await page.waitForTimeout(2500);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '40_fix_tables_cards_no_truncation.png'),
    fullPage: false,
  });
  console.log('Saved: 40_fix_tables_cards_no_truncation.png');

  // Open View Bill on an occupied table (e.g. T1 or F1)
  const viewBillBtn = page.locator('button').filter({ hasText: 'View Bill' }).first();
  if (await viewBillBtn.isVisible()) {
    await viewBillBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '41_fix_view_bill_modal_no_truncation.png'),
      fullPage: false,
    });
    console.log('Saved: 41_fix_view_bill_modal_no_truncation.png');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 2. Kitchen Display System (KDS)
  console.log('2. Checking Kitchen Display (KDS)...');
  await page.goto(`${WEB_BASE}/kitchen`, { waitUntil: 'commit' });
  await page.waitForTimeout(2500);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '42_fix_kds_dish_names_full.png'),
    fullPage: false,
  });
  console.log('Saved: 42_fix_kds_dish_names_full.png');

  // 3. POS Search across categories
  console.log('3. Checking POS search across categories...');
  await page.goto(`${WEB_BASE}/pos`, { waitUntil: 'commit' });
  await page.waitForTimeout(2000);

  // Select "Starters" category
  const startersBtn = page.getByRole('button', { name: 'Starters', exact: true }).first();
  if (await startersBtn.isVisible()) {
    await startersBtn.click();
    await page.waitForTimeout(400);
  }

  // Now search for "Biryani" while Starters is active
  const searchInput = page.getByPlaceholder(/Search items/i).first();
  await searchInput.fill('Biryani');
  await page.waitForTimeout(600);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '44_fix_pos_search_all_categories.png'),
    fullPage: false,
  });
  console.log('Saved: 44_fix_pos_search_all_categories.png');

  // Clear search
  await searchInput.fill('');
  await page.waitForTimeout(400);

  // 4. Mobile Viewport: Category tabs in POS
  console.log('4. Checking Mobile POS category tabs...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '43_fix_mobile_pos_categories_full.png'),
    fullPage: false,
  });
  console.log('Saved: 43_fix_mobile_pos_categories_full.png');

  await browser.close();
  console.log('\n=== All Bug Fix Verifications Completed Successfully! ===\n');
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
