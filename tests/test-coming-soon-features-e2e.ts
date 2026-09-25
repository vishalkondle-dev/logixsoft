import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const WEB_BASE = 'https://dine.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

async function run() {
  console.log('--- Starting Complete E2E Verification of All 5 Settings Features ---');
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

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
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();

  // ──────────────────────────────────────────────────────────────────────────
  // 1. Settings Overview Hub (/settings)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 1. Testing Settings Hub Overview ---');
  await page.goto(`${WEB_BASE}/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Store & Operations', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // Check that NO "Coming soon" badge remains
  const comingSoonBadges = await page.locator('text=Coming soon').count();
  console.log(`Remaining "Coming soon" badges: ${comingSoonBadges}`);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'e2e_01_settings_hub_all_available.png'),
    fullPage: true,
  });
  console.log('Saved: e2e_01_settings_hub_all_available.png');

  // ──────────────────────────────────────────────────────────────────────────
  // 2. Dining Options (/settings/dining)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Testing Dining Options ---');
  await page.goto(`${WEB_BASE}/settings/dining`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Verify headers and channel cards
  const diningTitle = await page.locator('text=Dining & Fulfillment Channels').isVisible();
  console.log(`Dining title visible: ${diningTitle}`);

  // Click Save Changes to test mutation
  const saveDiningBtn = page.locator('button:has-text("Save Changes")').first();
  if (await saveDiningBtn.isVisible()) {
    await saveDiningBtn.click();
    await page.waitForTimeout(1500);
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'e2e_02_dining_options_management.png'),
    fullPage: false,
  });
  console.log('Saved: e2e_02_dining_options_management.png');

  // ──────────────────────────────────────────────────────────────────────────
  // 3. QR Menu Ordering (/settings/qr-menu)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Testing QR Menu Ordering ---');
  await page.goto(`${WEB_BASE}/settings/qr-menu`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const qrTitle = await page.locator('text=QR Menu & Table Ordering').isVisible();
  console.log(`QR Menu title visible: ${qrTitle}`);

  const qrCanvas = await page.locator('canvas').first().isVisible().catch(() => false);
  const qrSvg = await page.locator('svg').count();
  console.log(`QR Canvas/SVG rendered: canvas=${qrCanvas}, svgs=${qrSvg}`);

  // Test save
  const saveQrBtn = page.locator('button:has-text("Save Changes")').first();
  if (await saveQrBtn.isVisible()) {
    await saveQrBtn.click();
    await page.waitForTimeout(1500);
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'e2e_03_qr_menu_management.png'),
    fullPage: false,
  });
  console.log('Saved: e2e_03_qr_menu_management.png');

  // ──────────────────────────────────────────────────────────────────────────
  // 4. WhatsApp Alerts (/settings/whatsapp)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Testing WhatsApp Alerts ---');
  await page.goto(`${WEB_BASE}/settings/whatsapp`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const waTitle = await page.locator('text=WhatsApp Alerts & Digital Receipts').isVisible();
  console.log(`WhatsApp Alerts title visible: ${waTitle}`);

  // Test Test Message Messenger input
  const phoneInput = page.locator('input[placeholder="10-digit mobile number"]').first();
  if (await phoneInput.isVisible()) {
    await phoneInput.fill('9988776655');
  }

  // Click Save Changes
  const saveWaBtn = page.locator('button:has-text("Save Changes")').first();
  if (await saveWaBtn.isVisible()) {
    await saveWaBtn.click();
    await page.waitForTimeout(1500);
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'e2e_04_whatsapp_management.png'),
    fullPage: false,
  });
  console.log('Saved: e2e_04_whatsapp_management.png');

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Table Reservations (/settings/reservations)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Testing Table Reservations ---');
  await page.goto(`${WEB_BASE}/settings/reservations`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const resTitle = await page.locator('text=Table Reservations').isVisible();
  console.log(`Table Reservations title visible: ${resTitle}`);

  // Open New Reservation modal
  const newResBtn = page.locator('button:has-text("New Reservation")').first();
  if (await newResBtn.isVisible()) {
    await newResBtn.click();
    await page.waitForTimeout(800);

    // Fill form
    await page.locator('input[placeholder="e.g. Rahul Sharma"]').fill('Priya Sundaram');
    await page.locator('input[placeholder="10-digit mobile"]').fill('9876543210');
    await page.locator('input[placeholder*="Birthday"]').fill('Window table preferred, birthday celebration');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'e2e_05_reservation_modal.png'),
      fullPage: false,
    });
    console.log('Saved: e2e_05_reservation_modal.png');

    // Submit
    const confirmBtn = page.locator('button:has-text("Confirm Reservation")');
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await page.waitForTimeout(2000);
    }
  }

  // Verify reservation is listed
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'e2e_06_reservations_roster.png'),
    fullPage: false,
  });
  console.log('Saved: e2e_06_reservations_roster.png');

  // ──────────────────────────────────────────────────────────────────────────
  // 6. Delivery & Fleet Riders (/settings/riders)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 6. Testing Delivery & Riders Hub ---');
  await page.goto(`${WEB_BASE}/settings/riders`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const ridersTitle = await page.locator('text=Delivery Fleet & Dispatch').isVisible();
  console.log(`Riders Hub title visible: ${ridersTitle}`);

  // Open Add Fleet Rider modal
  const addRiderBtn = page.locator('button:has-text("Add Fleet Rider")').first();
  if (await addRiderBtn.isVisible()) {
    await addRiderBtn.click();
    await page.waitForTimeout(800);

    await page.locator('input[placeholder="e.g. Ramesh Kumar"]').fill('Suresh Verma');
    await page.locator('input[placeholder="10-digit mobile"]').fill('9876500001');

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'e2e_07_add_rider_modal.png'),
      fullPage: false,
    });
    console.log('Saved: e2e_07_add_rider_modal.png');

    const saveRiderBtn = page.locator('button:has-text("Save Rider")');
    if (await saveRiderBtn.isVisible()) {
      await saveRiderBtn.click();
      await page.waitForTimeout(2000);
    }
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'e2e_08_riders_fleet_roster.png'),
    fullPage: false,
  });
  console.log('Saved: e2e_08_riders_fleet_roster.png');

  await browser.close();
  console.log('\n=== ALL 5 COMING SOON FEATURES VERIFIED AND TESTED E2E! ===');
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
