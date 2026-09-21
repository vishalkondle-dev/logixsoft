import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const WEB_BASE = 'https://dine.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/d19bc639-79a0-4e4f-8b9b-d44a9ddf7d3a';

function getTableCard(page: any, tableName: string) {
  return page.locator('.mantine-Paper-root').filter({
    has: page.getByText(tableName, { exact: true }),
  }).first();
}

async function navigateTo(page: any, route: 'tables' | 'pos' | 'orders' | 'kitchen') {
  if (route === 'kitchen') {
    await page.goto(`${WEB_BASE}/kitchen`, { waitUntil: 'commit', timeout: 15000 });
    await page.waitForTimeout(2000);
    return;
  }
  const labelMap = {
    tables: 'Tables',
    pos: 'POS',
    orders: 'Orders',
  };
  const label = labelMap[route];
  const navLink = page.locator(`a[aria-label="${label}"]`).first();
  if (await navLink.isVisible()) {
    await navLink.click();
  } else {
    await page.goto(`${WEB_BASE}/${route}`, { waitUntil: 'commit', timeout: 15000 });
  }
  await page.waitForTimeout(2000);
}

async function run() {
  console.log('====================================================');
  console.log('Starting Full End-to-End (E2E) POS & Operations Test');
  console.log('====================================================\n');

  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  if (!fs.existsSync(CACHE_FILE)) {
    throw new Error(`Cache file not found at ${CACHE_FILE}`);
  }
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

  // ──────────────────────────────────────────────────────────────────────────
  // PRE-STEP: Ensure Table T4 is completely free and ready
  // ──────────────────────────────────────────────────────────────────────────
  console.log('[SETUP] Checking initial status of Table T4 on /tables...');
  await page.goto(`${WEB_BASE}/tables`, { waitUntil: 'commit', timeout: 15000 });
  await page.waitForTimeout(2500);

  let t4Card = getTableCard(page, 'T4');
  await t4Card.waitFor({ state: 'visible', timeout: 10000 });

  // If T4 has an active order, clear it first
  const existingFreeBtn = t4Card.getByRole('button', { name: /Free Table|Settle & Free/i }).first();
  if (await existingFreeBtn.isVisible()) {
    console.log('[SETUP] Table T4 currently has an active order. Freeing table first...');
    await existingFreeBtn.click();
    await page.waitForTimeout(600);
    const confirmBtn = page.locator('.mantine-Modal-content').getByRole('button', { name: /Free Table|Settle/i }).first();
    if (await confirmBtn.isVisible()) {
      await confirmBtn.click();
      await page.waitForTimeout(1800);
    }
    t4Card = getTableCard(page, 'T4');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // FLOW 1, STEP 1: Tables Dashboard - Inspect Table T4 (Free & Ready)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[FLOW 1 - STEP 1] Tables Dashboard: Verify Table T4 is Free & Ready');
  await navigateTo(page, 'tables');

  t4Card = getTableCard(page, 'T4');
  const freeBadge = t4Card.locator('text=/Free & Ready|FREE/i').first();
  await freeBadge.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✓ Table T4 is verified FREE & READY');

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '20_e2e_tables_t4_free.png'),
    fullPage: false,
  });
  console.log('Saved: 20_e2e_tables_t4_free.png');

  // ──────────────────────────────────────────────────────────────────────────
  // FLOW 1, STEP 2: POS - Create Round 1 Dine-In Order on T4
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[FLOW 1 - STEP 2] Taking Dine-in Order for Table T4...');
  const takeOrderBtn = t4Card.getByRole('button', { name: /Take Order \(Dine In\)/i }).first();
  await takeOrderBtn.click();
  await page.waitForTimeout(2000);

  // Verify POS loaded
  const tableSelectInput = page.getByLabel('Table / Order Type').first();
  await tableSelectInput.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✓ POS opened with table selector active');

  // Select "Starters" category
  const startersTab = page.getByRole('button', { name: 'Starters', exact: true }).first();
  if (await startersTab.isVisible()) {
    await startersTab.click();
    await page.waitForTimeout(500);
  }

  // Add "Crispy Corn"
  const crispyCorn = page.getByText('Crispy Corn', { exact: true }).first();
  await crispyCorn.waitFor({ state: 'visible', timeout: 5000 });
  await crispyCorn.click();
  await page.waitForTimeout(500);

  // Select "Breads" category
  const breadsTab = page.getByRole('button', { name: 'Breads', exact: true }).first();
  if (await breadsTab.isVisible()) {
    await breadsTab.click();
    await page.waitForTimeout(500);
  }

  // Add "Garlic Naan"
  const garlicNaan = page.getByText('Garlic Naan', { exact: true }).first();
  await garlicNaan.waitFor({ state: 'visible', timeout: 5000 });
  await garlicNaan.click();
  await page.waitForTimeout(500);

  // Increase Garlic Naan to qty 2 in Cart
  const cartGarlicNaan = page.locator('.mantine-Paper-root').filter({ hasText: 'Garlic Naan' }).first();
  const plusBtn = cartGarlicNaan.locator('button[aria-label="Increase quantity"]').first();
  if (await plusBtn.isVisible()) {
    await plusBtn.click();
    await page.waitForTimeout(400);
  }

  // Add cooking note to Garlic Naan
  const noteBtn = cartGarlicNaan.getByRole('button', { name: /\+ Note/i }).first();
  if (await noteBtn.isVisible()) {
    await noteBtn.click();
    await page.waitForTimeout(500);
    const noteModal = page.locator('.mantine-Modal-content').filter({ hasText: /Note for/i }).first();
    await noteModal.waitFor({ state: 'visible', timeout: 5000 });

    const noteInput = page.getByPlaceholder(/Less spicy|extra chutney/i).first();
    if (await noteInput.isVisible()) {
      await noteInput.fill('Crispy with butter');
    }
    const saveNoteBtn = noteModal.getByRole('button', { name: /Save Note/i }).first();
    await saveNoteBtn.click();
    await page.waitForTimeout(400);
  }

  // Enter Customer Phone
  const phoneInput = page.getByPlaceholder(/WhatsApp number/i).first();
  if (await phoneInput.isVisible()) {
    await phoneInput.fill('9876543210');
    await page.waitForTimeout(300);
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '21_e2e_pos_round1_items.png'),
    fullPage: false,
  });
  console.log('Saved: 21_e2e_pos_round1_items.png');

  // Submit Round 1 with primary "Send" button
  console.log('Placing Round 1 Dine-In Order...');
  const sendBtn = page.getByRole('button', { name: /^Send$/i }).first();
  await sendBtn.waitFor({ state: 'visible' });
  await sendBtn.click();

  const notifToast = page.locator('.mantine-Notification-root').first();
  await notifToast.waitFor({ state: 'visible', timeout: 15000 });
  console.log('✓ Round 1 Sent Notification:', await notifToast.innerText());

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '22_e2e_pos_round1_placed.png'),
    fullPage: false,
  });
  console.log('Saved: 22_e2e_pos_round1_placed.png');
  await page.waitForTimeout(2000);

  // ──────────────────────────────────────────────────────────────────────────
  // FLOW 1, STEP 3: Tables Dashboard - Verify Table T4 is OCCUPIED
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[FLOW 1 - STEP 3] Navigating to Tables page to verify T4 is OCCUPIED...');
  await navigateTo(page, 'tables');

  t4Card = getTableCard(page, 'T4');
  await t4Card.waitFor({ state: 'visible', timeout: 8000 });

  const occupiedBadge = t4Card.locator('text=/OCCUPIED/i').first();
  await occupiedBadge.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Table T4 is confirmed OCCUPIED on Tables dashboard!');

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '23_e2e_tables_t4_occupied.png'),
    fullPage: false,
  });
  console.log('Saved: 23_e2e_tables_t4_occupied.png');

  // ──────────────────────────────────────────────────────────────────────────
  // FLOW 1, STEP 4: Kitchen Display (KDS) - Verify KOT and Advance Status
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[FLOW 1 - STEP 4] Checking Kitchen Display (KDS) for Table T4 ticket...');
  await navigateTo(page, 'kitchen');

  const kdsTicketT4 = page.locator('.mantine-Paper-root').filter({ hasText: /TABLE T4/i }).first();
  await kdsTicketT4.waitFor({ state: 'visible', timeout: 10000 });
  console.log('✓ Table T4 KOT ticket found on KDS board');

  // Advance ticket
  const markReadyBtn = kdsTicketT4.getByRole('button', { name: /Mark All Ready/i }).first();
  if (await markReadyBtn.isVisible()) {
    console.log('Advancing Table T4 ticket to Ready on KDS...');
    await markReadyBtn.click();
    await page.waitForTimeout(1500);
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '24_e2e_kds_t4_ticket_prepared.png'),
    fullPage: false,
  });
  console.log('Saved: 24_e2e_kds_t4_ticket_prepared.png');

  // ──────────────────────────────────────────────────────────────────────────
  // FLOW 1, STEP 5: Add Round 2 with "Settle & Send"
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[FLOW 1 - STEP 5] Navigating to Tables page to add Round 2 on Table T4...');
  await navigateTo(page, 'tables');

  t4Card = getTableCard(page, 'T4');
  const addRoundBtn = t4Card.getByRole('button', { name: /Add Round/i }).first();
  await addRoundBtn.click();
  await page.waitForTimeout(2000);

  // In POS: Verify active round banner
  const activeRoundBanner = page.locator('text=/Round 1 Active/i').first();
  await activeRoundBanner.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✓ POS displays Round 1 Active for Table T4');

  // Add Main Course: "Butter Chicken"
  const mainsTab = page.getByRole('button', { name: 'Main Course', exact: true }).first();
  if (await mainsTab.isVisible()) {
    await mainsTab.click();
    await page.waitForTimeout(500);
  }
  const butterChicken = page.getByText('Butter Chicken', { exact: true }).first();
  await butterChicken.waitFor({ state: 'visible', timeout: 5000 });
  await butterChicken.click();
  await page.waitForTimeout(500);

  // Add Beverages: "Mango Lassi"
  const bevTab = page.getByRole('button', { name: 'Beverages', exact: true }).first();
  if (await bevTab.isVisible()) {
    await bevTab.click();
    await page.waitForTimeout(500);
  }
  const lassi = page.getByText('Mango Lassi', { exact: true }).first();
  await lassi.waitFor({ state: 'visible', timeout: 5000 });
  await lassi.click();
  await page.waitForTimeout(500);

  // Open "Settle & Send" split button dropdown
  const splitChevron = page.locator('button[aria-label="More order options"]').first();
  await splitChevron.waitFor({ state: 'visible' });
  await splitChevron.click();
  await page.waitForTimeout(400);

  const settleMenuItem = page.getByRole('menuitem', { name: /Settle & Send/i }).first();
  await settleMenuItem.waitFor({ state: 'visible' });
  await settleMenuItem.click();
  await page.waitForTimeout(600);

  // Settle modal opens
  const settleModal = page.locator('.mantine-Modal-content').filter({ hasText: /Settle & Send/i }).first();
  await settleModal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Settle & Send modal opened');

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '25_e2e_pos_round2_settle_send_modal.png'),
    fullPage: false,
  });
  console.log('Saved: 25_e2e_pos_round2_settle_send_modal.png');

  // Confirm settlement & send Round 2
  const confirmSettleBtn = settleModal.getByRole('button', { name: /Confirm Settlement & Send/i }).first();
  await confirmSettleBtn.click();
  console.log('Confirmed Settle & Send for Round 2!');

  const settleNotif = page.locator('.mantine-Notification-root').first();
  await settleNotif.waitFor({ state: 'visible', timeout: 15000 });
  console.log('✓ Settle & Send Notification:', await settleNotif.innerText());

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '26_e2e_pos_round2_settle_send_success.png'),
    fullPage: false,
  });
  console.log('Saved: 26_e2e_pos_round2_settle_send_success.png');
  await page.waitForTimeout(2000);

  // ──────────────────────────────────────────────────────────────────────────
  // FLOW 1, STEP 6: Tables Dashboard - Verify Multi-Round State & View Bill
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[FLOW 1 - STEP 6] Navigating to Tables page to verify multi-round state...');
  await navigateTo(page, 'tables');

  t4Card = getTableCard(page, 'T4');
  await t4Card.waitFor({ state: 'visible' });

  // Critical assertion: Table T4 must STILL BE OCCUPIED!
  const t4StillOccupied = t4Card.locator('text=/OCCUPIED/i').first();
  await t4StillOccupied.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✓ CRITICAL PASS: Table T4 remains OCCUPIED after Settle & Send!');

  // Check 2 Rounds badge
  const roundsBadge = t4Card.locator('text=/2 ROUNDS/i').first();
  await roundsBadge.waitFor({ state: 'visible', timeout: 5000 });
  console.log('✓ Table T4 shows 2 ROUNDS badge');

  // Open View Bill modal
  const viewBillBtn = t4Card.getByRole('button', { name: /View Bill/i }).first();
  await viewBillBtn.click();
  await page.waitForTimeout(1000);

  const billModal = page.locator('.mantine-Modal-content').filter({ hasText: /Bill Preview/i }).first();
  await billModal.waitFor({ state: 'visible', timeout: 6000 });
  console.log('✓ View Bill modal opened for Table T4');

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '27_e2e_tables_t4_view_bill_rounds.png'),
    fullPage: false,
  });
  console.log('Saved: 27_e2e_tables_t4_view_bill_rounds.png');

  // Close bill modal
  const closeBillBtn = billModal.locator('button.mantine-Modal-close').first();
  if (await closeBillBtn.isVisible()) {
    await closeBillBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(600);

  // ──────────────────────────────────────────────────────────────────────────
  // FLOW 1, STEP 7: Settle Remaining Balance & Free Table
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[FLOW 1 - STEP 7] Settle outstanding balance and Free Table T4...');
  const freeTableBtn = t4Card.getByRole('button', { name: /Free Table|Settle & Free/i }).first();
  await freeTableBtn.click();
  await page.waitForTimeout(600);

  const freeModal = page.locator('.mantine-Modal-content').filter({ hasText: /Free Table/i }).first();
  await freeModal.waitFor({ state: 'visible', timeout: 5000 });

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '28_e2e_tables_t4_freed_modal.png'),
    fullPage: false,
  });
  console.log('Saved: 28_e2e_tables_t4_freed_modal.png');

  // Settle and Free Table
  const confirmFreeBtn = freeModal.getByRole('button', { name: /Settle.*Free Table|Free Table/i }).first();
  await confirmFreeBtn.click();
  await page.waitForTimeout(2000);

  // Verify Table T4 is now Free & Ready
  t4Card = getTableCard(page, 'T4');
  const freedBadge = t4Card.locator('text=/Free & Ready|FREE/i').first();
  await freedBadge.waitFor({ state: 'visible', timeout: 8000 });
  console.log('✓ Table T4 is successfully FREED & READY for new dining guests!');

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '29_e2e_tables_t4_freed_confirmed.png'),
    fullPage: false,
  });
  console.log('Saved: 29_e2e_tables_t4_freed_confirmed.png');

  // ──────────────────────────────────────────────────────────────────────────
  // FLOW 2: Orders Screen & Detail Modal Inspection
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[FLOW 2] Navigating to Orders Screen (/orders)...');
  await navigateTo(page, 'orders');

  // Verify Table T4 order is present and shows Table Freed
  const t4OrderRow = page.locator('.mantine-Paper-root').filter({ hasText: 'T: T4' }).first();
  await t4OrderRow.waitFor({ state: 'visible', timeout: 8000 });

  const freedOrderBadge = t4OrderRow.locator('text=/Table Freed/i').first();
  await freedOrderBadge.waitFor({ state: 'visible' });
  console.log('✓ Orders screen displays Table T4 order marked as Table Freed!');

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '30_e2e_orders_list_with_t4.png'),
    fullPage: false,
  });
  console.log('Saved: 30_e2e_orders_list_with_t4.png');

  // Open Order Detail Modal
  console.log('Opening Order Detail Modal for Table T4...');
  await t4OrderRow.click();
  await page.waitForTimeout(800);

  const orderDetailModal = page.locator('.mantine-Modal-content').filter({ hasText: /Order Items/i }).first();
  await orderDetailModal.waitFor({ state: 'visible', timeout: 6000 });

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '31_e2e_orders_detail_modal_responsive.png'),
    fullPage: false,
  });
  console.log('Saved: 31_e2e_orders_detail_modal_responsive.png');

  // Close modal
  const closeDetailBtn = orderDetailModal.locator('button.mantine-Modal-close').first();
  if (await closeDetailBtn.isVisible()) {
    await closeDetailBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(500);

  // ──────────────────────────────────────────────────────────────────────────
  // FLOW 3: Takeaway Order Flow
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[FLOW 3] Placing Takeaway Order with Customer Phone & WhatsApp...');
  await navigateTo(page, 'pos');

  // Change Table / Order Type to Takeaway
  const posTableSelect = page.getByLabel('Table / Order Type').first();
  await posTableSelect.waitFor({ state: 'visible', timeout: 8000 });
  await posTableSelect.click();
  await page.waitForTimeout(400);

  const takeawayOption = page.locator('.mantine-Select-option, [role="option"]').filter({ hasText: /^Takeaway/i }).first();
  await takeawayOption.click();
  await page.waitForTimeout(400);

  // Enter Takeaway customer phone
  const takeawayPhone = page.getByPlaceholder(/WhatsApp number/i).first();
  await takeawayPhone.fill('9988112233');

  // Add Biryani & Beverage
  const biryaniTab = page.getByRole('button', { name: 'Biryani & Rice', exact: true }).first();
  if (await biryaniTab.isVisible()) {
    await biryaniTab.click();
    await page.waitForTimeout(400);
  }
  const hydBiryani = page.getByText('Hyderabadi Chicken Biryani', { exact: true }).first();
  await hydBiryani.waitFor({ state: 'visible' });
  await hydBiryani.click();
  await page.waitForTimeout(400);

  // Settle and Send Takeaway
  const takeawayChevron = page.locator('button[aria-label="More order options"]').first();
  await takeawayChevron.click();
  await page.waitForTimeout(300);

  const takeawaySettle = page.getByRole('menuitem', { name: /Settle & Send/i }).first();
  await takeawaySettle.click();
  await page.waitForTimeout(500);

  const takeawayModal = page.locator('.mantine-Modal-content').filter({ hasText: /Settle & Send/i }).first();
  await takeawayModal.waitFor({ state: 'visible' });

  const confirmTakeaway = takeawayModal.getByRole('button', { name: /Confirm Settlement & Send/i }).first();
  await confirmTakeaway.click();
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '32_e2e_pos_takeaway_placed.png'),
    fullPage: false,
  });
  console.log('Saved: 32_e2e_pos_takeaway_placed.png');

  // Verify on Orders page
  await navigateTo(page, 'orders');

  const takeawayRow = page.locator('.mantine-Paper-root').filter({ hasText: 'Takeaway' }).first();
  await takeawayRow.waitFor({ state: 'visible' });
  console.log('✓ Takeaway order confirmed on Orders screen');

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '33_e2e_orders_takeaway_listed.png'),
    fullPage: false,
  });
  console.log('Saved: 33_e2e_orders_takeaway_listed.png');

  // ──────────────────────────────────────────────────────────────────────────
  // FLOW 4: Mobile Viewport Responsiveness (390 x 844)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[FLOW 4] Testing Mobile Viewport Responsiveness (390 x 844)...');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);

  // Mobile Tables Screen
  await navigateTo(page, 'tables');

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '34_e2e_mobile_tables_screen.png'),
    fullPage: false,
  });
  console.log('Saved: 34_e2e_mobile_tables_screen.png');

  // Mobile POS & Cart Drawer
  await navigateTo(page, 'pos');

  // Add an item to trigger mobile bottom bar
  const mobileBiryani = page.getByText('Hyderabadi Chicken Biryani').or(page.getByText('Chicken Biryani')).first();
  if (await mobileBiryani.isVisible()) {
    await mobileBiryani.click();
    await page.waitForTimeout(500);
  }

  // Open mobile cart drawer by clicking floating cart button
  const mobileCartBar = page.locator('button').filter({ hasText: /Cart/i }).first();
  if (await mobileCartBar.isVisible()) {
    await mobileCartBar.click();
    await page.waitForTimeout(800);
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '35_e2e_mobile_pos_cart_drawer.png'),
    fullPage: false,
  });
  console.log('Saved: 35_e2e_mobile_pos_cart_drawer.png');

  // Open mobile Settle & Send modal above drawer
  const mobileSplitChevron = page.locator('button[aria-label="More order options"]').first();
  if (await mobileSplitChevron.isVisible()) {
    await mobileSplitChevron.click();
    await page.waitForTimeout(300);
    const mobileSettleItem = page.getByRole('menuitem', { name: /Settle & Send/i }).first();
    if (await mobileSettleItem.isVisible()) {
      await mobileSettleItem.click();
      await page.waitForTimeout(800);
    }
  }

  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '36_e2e_mobile_settle_modal_above_drawer.png'),
    fullPage: false,
  });
  console.log('Saved: 36_e2e_mobile_settle_modal_above_drawer.png');

  await browser.close();
  console.log('\n====================================================');
  console.log('ALL END-TO-END TESTS COMPLETED SUCCESSFULLY!');
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('E2E Test Failed:', err);
  process.exit(1);
});
