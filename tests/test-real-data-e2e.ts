import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const WEB_BASE = 'https://dine.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/d19bc639-79a0-4e4f-8b9b-d44a9ddf7d3a';

async function run() {
  console.log('--- Starting Comprehensive Real Data E2E Test ---');
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
  // 1. Tables Dashboard (/tables)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 1. Testing Tables Dashboard ---');
  await page.goto(`${WEB_BASE}/tables`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Capture all tables across all sections
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '10_real_tables_dashboard_all.png'),
    fullPage: false,
  });
  console.log('Saved screenshot: 10_real_tables_dashboard_all.png');

  // Filter by "Ground Floor (AC)" section
  const gfSection = page.locator('text=Ground Floor (AC)').first();
  if (await gfSection.isVisible()) {
    await gfSection.click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '11_real_tables_ground_floor.png'),
      fullPage: false,
    });
    console.log('Saved screenshot: 11_real_tables_ground_floor.png');
  }

  // Filter by "Occupied" status
  const occupiedFilter = page.locator('label:has-text("Occupied")').first();
  if (await occupiedFilter.isVisible()) {
    await occupiedFilter.click();
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '12_real_tables_occupied_only.png'),
      fullPage: false,
    });
    console.log('Saved screenshot: 12_real_tables_occupied_only.png');
  }

  // Reset to All Sections and All Tables
  const allSection = page.locator('text=All Sections').first();
  if (await allSection.isVisible()) await allSection.click();
  const allStatus = page.locator('label:has-text("All")').first();
  if (await allStatus.isVisible()) await allStatus.click();
  await page.waitForTimeout(1000);

  // Click "View Bill" on an occupied table (e.g. F1 or T1)
  const viewBillBtn = page.locator('button:has-text("View Bill")').first();
  if (await viewBillBtn.isVisible()) {
    console.log('Opening View Bill modal for occupied table...');
    await viewBillBtn.click();
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '13_real_tables_view_bill_modal.png'),
      fullPage: false,
    });
    console.log('Saved screenshot: 13_real_tables_view_bill_modal.png');

    // Close view bill modal
    const closeBtn = page.locator('button[aria-label="Close"], button:has-text("Close")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2. POS Ordering Screen (/pos)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. Testing POS Menu & Ordering Screen ---');
  await page.goto(`${WEB_BASE}/pos?table=T4`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Capture POS full menu with categories
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '14_real_pos_menu_categories.png'),
    fullPage: false,
  });
  console.log('Saved screenshot: 14_real_pos_menu_categories.png');

  // Click on "Main Course" category tab
  const mainCourseTab = page.locator('button:has-text("Main Course")').first();
  if (await mainCourseTab.isVisible()) {
    await mainCourseTab.click();
    await page.waitForTimeout(800);
  }

  // Add items from Main Course and Breads
  const butterChicken = page.locator('text=Butter Chicken').first();
  if (await butterChicken.isVisible()) {
    await butterChicken.click();
    await page.waitForTimeout(400);
  }

  const breadsTab = page.locator('button:has-text("Breads")').first();
  if (await breadsTab.isVisible()) {
    await breadsTab.click();
    await page.waitForTimeout(800);
  }
  const garlicNaan = page.locator('text=Garlic Naan').first();
  if (await garlicNaan.isVisible()) {
    await garlicNaan.click();
    await page.waitForTimeout(400);
    await garlicNaan.click(); // 2 qty
    await page.waitForTimeout(400);
  }

  // Capture POS with items added to cart
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '15_real_pos_cart_with_items.png'),
    fullPage: false,
  });
  console.log('Saved screenshot: 15_real_pos_cart_with_items.png');

  // Send order to kitchen for Table T4
  const sendOrderBtn = page.locator('button:has-text("Send to Kitchen"), button:has-text("Send Order")').first();
  if (await sendOrderBtn.isVisible()) {
    console.log('Sending order to kitchen for Table T4...');
    await sendOrderBtn.click();
    await page.waitForTimeout(2500);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3. Orders Screen (/orders)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. Testing Orders Screen ---');
  await page.goto(`${WEB_BASE}/orders`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Capture orders list showing real orders
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '16_real_orders_list.png'),
    fullPage: false,
  });
  console.log('Saved screenshot: 16_real_orders_list.png');

  // Click on the multi-round order (F1 or T1)
  const multiRoundOrderCard = page.locator('div[style*="cursor: pointer"]:has-text("Rounds")').first();
  if (await multiRoundOrderCard.isVisible()) {
    console.log('Opening order details modal for multi-round order...');
    await multiRoundOrderCard.click();
    await page.waitForTimeout(1200);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '17_real_orders_detail_modal.png'),
      fullPage: false,
    });
    console.log('Saved screenshot: 17_real_orders_detail_modal.png');

    // Close modal
    const closeBtn = page.locator('button[aria-label="Close"], button:has-text("Close")').first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await page.waitForTimeout(500);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. Kitchen Display (KDS) Screen (/kitchen)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. Testing Kitchen Display Screen ---');
  await page.goto(`${WEB_BASE}/kitchen`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '18_real_kds_screen.png'),
    fullPage: false,
  });
  console.log('Saved screenshot: 18_real_kds_screen.png');

  // ──────────────────────────────────────────────────────────────────────────
  // 5. Mobile Screen POS & "View Items" Modal Verification (iPhone 14)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. Testing Mobile Viewport (POS & View Items Modal) ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  });

  await mobileContext.addCookies([
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

  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${WEB_BASE}/pos?table=T1`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2500);

  // Add an item so floating cart button appears
  const starterCard = mobilePage.locator('text=Crispy Corn').first();
  if (await starterCard.isVisible()) {
    await starterCard.click();
    await mobilePage.waitForTimeout(800);
  }

  // Open mobile cart drawer
  const cartBtn = mobilePage.locator('button:has-text("Cart (")').first();
  if (await cartBtn.isVisible()) {
    await cartBtn.click();
    await mobilePage.waitForTimeout(1000);
  }

  // Click View Items
  const viewItems = mobilePage.locator('.mantine-Drawer-root button:has-text("View Items")').first();
  if (await viewItems.isVisible()) {
    await viewItems.click();
    await mobilePage.waitForTimeout(1200);

    await mobilePage.screenshot({
      path: path.join(SCREENSHOT_DIR, '19_real_mobile_view_items_modal.png'),
      fullPage: false,
    });
    console.log('Saved screenshot: 19_real_mobile_view_items_modal.png');
  }

  await browser.close();
  console.log('\n--- All Real Data E2E Tests Finished Successfully! ---');
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
