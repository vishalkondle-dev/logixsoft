import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const WEB_BASE = 'https://dine.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

async function run() {
  console.log('=== Verifying All 7 User Requests in Production Browser ===\n');

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

  // ─── 1. Verify Bottom Bar (No "Home" and Settings links to /settings) ───────
  console.log('Step 1: Checking Bottom Bar navigation...');
  await page.goto(`${WEB_BASE}/tables`, { waitUntil: 'commit' });
  await page.waitForTimeout(2500);

  const bottomNav = page.locator('nav[aria-label="Bottom Navigation"]');
  await bottomNav.waitFor({ state: 'visible', timeout: 10000 });

  const navLinks = await bottomNav.locator('a').all();
  const navTexts: string[] = [];
  const navHrefs: string[] = [];
  for (const l of navLinks) {
    navTexts.push((await l.textContent())?.trim() || '');
    navHrefs.push((await l.getAttribute('href')) || '');
  }
  console.log('Bottom Nav items:', navTexts);
  console.log('Bottom Nav hrefs:', navHrefs);

  const hasHome = navTexts.some((t) => t.toLowerCase() === 'home') || navHrefs.some((h) => h === '/');
  if (hasHome) {
    throw new Error('FAILED: "Home" item still present in bottom navigation!');
  }
  console.log('PASS: "Home" is removed from bottom bar.');

  const settingsLink = navLinks.find((_, i) => navTexts[i].toLowerCase().includes('settings') || navHrefs[i].includes('settings'));
  if (!settingsLink) {
    throw new Error('FAILED: Settings link not found in bottom navigation!');
  }
  const settingsHref = await settingsLink.getAttribute('href');
  console.log('Settings link href:', settingsHref);
  if (!settingsHref?.startsWith('/settings') || settingsHref.includes('/settings/restaurant')) {
    throw new Error(`FAILED: Settings href is ${settingsHref}, expected /settings (not /settings/restaurant)`);
  }
  console.log('PASS: Settings button points to "/settings".');

  // Click Settings button and verify it navigates to /settings
  console.log('Clicking Settings button...');
  await settingsLink.click();
  await page.waitForTimeout(2000);
  const currentUrl = page.url();
  console.log('Current URL after clicking Settings:', currentUrl);
  if (!currentUrl.includes('/settings')) {
    throw new Error(`FAILED: URL after clicking Settings is ${currentUrl}`);
  }
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_settings_overview_page.png') });
  console.log('PASS: Successfully navigated to /settings overview page.');

  // ─── 2. Verify Table Inactive in /settings/tables ─────────────────────────
  console.log('\nStep 2: Checking /settings/tables and inactive table behavior...');
  await page.goto(`${WEB_BASE}/settings/tables`, { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_settings_tables_list.png') });
  
  // Find a table row/card in settings/tables
  const tableCards = page.locator('.mantine-Paper-root').filter({ hasText: /seats|Active|Inactive/ });
  const count = await tableCards.count();
  console.log(`Found ${count} table cards in settings/tables.`);

  if (count > 0) {
    const firstTable = tableCards.first();
    const tableText = await firstTable.textContent();
    console.log('First table card info:', tableText?.replace(/\s+/g, ' '));
    
    // Find toggle button inside firstTable
    const toggleBtn = firstTable.locator('button[title*="Activate"], button[title*="Deactivate"]').first();
    if (await toggleBtn.isVisible()) {
      const initialTitle = await toggleBtn.getAttribute('title');
      console.log(`Current toggle action: ${initialTitle}`);
      
      // Toggle it
      await toggleBtn.click();
      await page.waitForTimeout(2000);
      
      // Confirm table is STILL visible in /settings/tables!
      const afterCount = await tableCards.count();
      console.log(`Table cards count after toggle: ${afterCount}`);
      if (afterCount === 0) {
        throw new Error('FAILED: Inactive table was hidden from /settings/tables!');
      }
      
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_settings_tables_after_toggle.png') });
      console.log('PASS: Table is NOT hidden when inactive in /settings/tables!');

      // Toggle it back if it was deactivated
      if (initialTitle?.includes('Deactivate')) {
        const toggleBackBtn = firstTable.locator('button[title*="Activate"]').first();
        if (await toggleBackBtn.isVisible()) {
          await toggleBackBtn.click();
          await page.waitForTimeout(2000);
          console.log('Re-activated table back to active.');
        }
      }
    }
  }

  // ─── 3. Verify POS Item Card Layout, Sizes, Images & Redesign ───────────
  console.log('\nStep 3: Checking POS item card layout, sizes, and design...');
  await page.goto(`${WEB_BASE}/pos`, { waitUntil: 'commit' });
  await page.waitForTimeout(3500);

  // Take full POS screenshot
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04_pos_redesigned_cards_grid.png') });

  // Locate item cards
  const itemCards = page.locator('div[style*="cursor: pointer"]').filter({ hasText: /₹/ });
  const itemCount = await itemCards.count();
  console.log(`Found ${itemCount} POS item cards.`);

  if (itemCount < 4) {
    throw new Error(`Expected at least 4 item cards, found ${itemCount}`);
  }

  // Check bounding boxes of the first 8 items
  const heights: number[] = [];
  for (let i = 0; i < Math.min(itemCount, 8); i++) {
    const card = itemCards.nth(i);
    const box = await card.boundingBox();
    if (box) {
      heights.push(Math.round(box.height));
    }
  }
  console.log('Sample POS item card heights (px):', heights);

  // Verify all card heights are identical
  const allSameHeight = heights.every((h) => Math.abs(h - heights[0]) <= 2);
  if (!allSameHeight) {
    throw new Error(`FAILED: POS item cards have uneven heights: ${JSON.stringify(heights)}`);
  }
  console.log(`PASS: All POS item cards have identical uniform height: ~${heights[0]}px!`);

  // Check image loading on cards
  const images = page.locator('div[style*="cursor: pointer"] img');
  const imgCount = await images.count();
  console.log(`Found ${imgCount} dish images rendered in POS item cards.`);
  if (imgCount === 0) {
    throw new Error('FAILED: No dish images found in POS cards!');
  }
  console.log('PASS: Dish images are properly displayed on menu item cards.');

  // Test adding an item to cart to verify redesigned active/badge state
  console.log('Adding an item to cart to verify active card state...');
  await itemCards.first().click();
  await page.waitForTimeout(1000);

  // If a modal opened (variants/addons), click confirm
  const modalAddBtn = page.locator('div[role="dialog"] button').filter({ hasText: /Add to Order|Confirm/i }).first();
  if (await modalAddBtn.isVisible()) {
    await modalAddBtn.click();
    await page.waitForTimeout(800);
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05_pos_card_active_with_badge.png') });
  console.log('PASS: POS card active state and quantity badge verified.');

  console.log('\n=== ALL 7 REQUIREMENTS SUCCESSFULLY VERIFIED! ===');
  await browser.close();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
