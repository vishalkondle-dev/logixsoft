import { chromium } from '@playwright/test';
import * as fs from 'fs';

const WEB_BASE = 'https://dine.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

async function main() {
  console.log('=== Verifying Veg / Non-Veg Checkbox Functionality on Live Site ===\n');

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

  console.log('Navigating to POS page...');
  await page.goto(`${WEB_BASE}/pos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Locate Veg and Non-Veg checkboxes
  const vegBtn = page.locator("button[role='checkbox']:has-text('Veg')").first();
  const nonVegBtn = page.locator("button[role='checkbox']:has-text('Non-Veg')").first();

  await vegBtn.waitFor({ state: 'visible', timeout: 10000 });
  await nonVegBtn.waitFor({ state: 'visible', timeout: 10000 });

  console.log('Initial Veg checked:', await vegBtn.getAttribute('aria-checked'));
  console.log('Initial Non-Veg checked:', await nonVegBtn.getAttribute('aria-checked'));

  await page.screenshot({ path: `${SCREENSHOT_DIR}/29_pos_icon_in_checkbox_default.png` });
  console.log('Saved 29_pos_icon_in_checkbox_default.png');

  // Test 1: Click Veg
  console.log('\n--- Clicking Veg Checkbox ---');
  await vegBtn.click();
  await page.waitForTimeout(1000);

  const vegCheckedAfter = await vegBtn.getAttribute('aria-checked');
  console.log('Veg aria-checked after click:', vegCheckedAfter);

  const vegCheckIcon = vegBtn.locator('svg');
  const hasVegCheckSvg = await vegCheckIcon.count() > 0;
  console.log('Veg has checkmark icon inside box:', hasVegCheckSvg);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/30_pos_icon_in_checkbox_veg.png` });
  console.log('Saved 30_pos_icon_in_checkbox_veg.png');

  // Test 2: Uncheck Veg, click Non-Veg
  console.log('\n--- Unchecking Veg, Clicking Non-Veg Checkbox ---');
  await vegBtn.click();
  await page.waitForTimeout(500);
  console.log('Veg aria-checked after 2nd click (uncheck):', await vegBtn.getAttribute('aria-checked'));

  await nonVegBtn.click();
  await page.waitForTimeout(1000);

  const nonVegCheckedAfter = await nonVegBtn.getAttribute('aria-checked');
  console.log('Non-Veg aria-checked after click:', nonVegCheckedAfter);

  const nonVegCheckIcon = nonVegBtn.locator('svg');
  const hasNonVegCheckSvg = await nonVegCheckIcon.count() > 0;
  console.log('Non-Veg has checkmark icon inside box:', hasNonVegCheckSvg);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/31_pos_icon_in_checkbox_nonveg.png` });
  console.log('Saved 31_pos_icon_in_checkbox_nonveg.png');

  // Test 3: Check both
  console.log('\n--- Checking both Veg and Non-Veg ---');
  await vegBtn.click();
  await page.waitForTimeout(1000);
  console.log('Both checked - Veg:', await vegBtn.getAttribute('aria-checked'), 'NonVeg:', await nonVegBtn.getAttribute('aria-checked'));

  await page.screenshot({ path: `${SCREENSHOT_DIR}/26_pos_checkbox_both_ticked.png` });
  console.log('Saved 26_pos_checkbox_both_ticked.png');

  await browser.close();
  console.log('\n=== All Checkbox Verifications Complete! ===');
}

main().catch((err) => {
  console.error('Error during verification:', err);
  process.exit(1);
});
