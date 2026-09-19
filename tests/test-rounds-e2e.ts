import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const OWNER_PHONE = '+917276718848';
const DEV_OTP = '123456';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/d19bc639-79a0-4e4f-8b9b-d44a9ddf7d3a';

async function fetchAuthCookie(): Promise<{ name: string; value: string; domain: string; path: string }> {
  const sRes = await fetch(`${API_BASE}/auth/phone/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: OWNER_PHONE }),
  });
  if (!sRes.ok) throw new Error(`send-otp failed: ${sRes.status} ${await sRes.text()}`);

  const vRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: OWNER_PHONE, otp: DEV_OTP }),
  });
  if (!vRes.ok) throw new Error(`verify failed: ${vRes.status} ${await vRes.text()}`);

  const setCookies = (vRes.headers as any).getSetCookie
    ? (vRes.headers as any).getSetCookie()
    : [vRes.headers.get('set-cookie')];
  const cookieStr = setCookies.filter(Boolean).join('; ');

  const match = cookieStr.match(/__Secure-logix-dine\.session_token=([^;]+)/);
  if (!match) throw new Error(`Session cookie not found in: ${cookieStr}`);

  return {
    name: '__Secure-logix-dine.session_token',
    value: match[1],
    domain: '.logixsoft.in',
    path: '/',
  };
}

async function run() {
  console.log('--- Starting Multiple Rounds E2E Test ---');
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const authCookie = await fetchAuthCookie();
  console.log('Authenticated successfully, session token retrieved.');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: authCookie.name,
      value: authCookie.value,
      domain: authCookie.domain,
      path: authCookie.path,
      httpOnly: true,
      secure: true,
      sameSite: 'None',
    },
    {
      name: '__Secure-logix-dine.session_token',
      value: authCookie.value,
      domain: 'dine.logixsoft.in',
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'None',
    },
  ]);

  const page = await context.newPage();

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1: POS - Order Round 1 for Table T1
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[STEP 1] Navigating to POS with Table T1...');
  await page.goto(`${WEB_BASE}/pos?table=T1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Verify table T1 is selected via the Table / Order Type Select
  const tableSelect = page.getByLabel('Table / Order Type').first();
  await tableSelect.waitFor({ state: 'visible', timeout: 10000 });
  const currentTableVal = await tableSelect.inputValue();
  console.log(`Current selected table in POS: "${currentTableVal}"`);

  if (currentTableVal !== 'T1') {
    await tableSelect.click();
    await page.waitForTimeout(400);
    const t1Opt = page.getByRole('option', { name: /T1/i }).first();
    await t1Opt.waitFor({ state: 'visible' });
    await t1Opt.click();
    await page.waitForTimeout(600);
  }
  console.log('Table T1 selected in POS.');

  // Click on Chicken Biryani menu item directly
  const biryaniItem = page.getByText('Chicken Biryani').first();
  await biryaniItem.waitFor({ state: 'visible', timeout: 10000 });
  await biryaniItem.click();
  await page.waitForTimeout(500);

  // Wait for item to appear in cart (Increase quantity button is rendered)
  const cartItemIncrease = page.locator('button[aria-label="Increase quantity"]').first();
  await cartItemIncrease.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Item successfully added to cart in POS.');

  // Capture Screenshot 1: POS Round 1 Cart
  const ss1Path = path.join(SCREENSHOT_DIR, '01_pos_round1_cart.png');
  await page.screenshot({ path: ss1Path });
  console.log(`Saved screenshot 1: ${ss1Path}`);

  // Find Send button and verify enabled
  const sendBtn = page.getByRole('button', { name: /^send$/i }).first();
  await sendBtn.waitFor({ state: 'visible' });
  await page.waitForTimeout(500);
  console.log('Sending Round 1 to kitchen...');
  await sendBtn.click();

  // Wait for notification
  const notif = page.locator('.mantine-Notification-root').first();
  await notif.waitFor({ state: 'visible', timeout: 15000 });
  console.log('Round 1 Notification:', await notif.innerText());

  // Capture Screenshot 2: Round 1 Sent
  const ss2Path = path.join(SCREENSHOT_DIR, '02_pos_round1_sent.png');
  await page.screenshot({ path: ss2Path });
  console.log(`Saved screenshot 2: ${ss2Path}`);

  await page.waitForTimeout(2500);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 2: POS - Detect Occupied Table T1 & Prepare Round 2
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[STEP 2] Re-selecting Table T1 in POS to test Round 2 detection...');
  await tableSelect.click();
  await page.waitForTimeout(500);

  const t1OccupiedOpt = page.getByRole('option', { name: /T1/i }).first();
  await t1OccupiedOpt.waitFor({ state: 'visible' });
  console.log('Found table option in dropdown:', await t1OccupiedOpt.innerText());
  await t1OccupiedOpt.click();
  await page.waitForTimeout(2000);

  // Check active order banner
  const activeBanner = page.locator('text=/Round 1 Active/i').or(page.locator('text=/has an active open order/i')).first();
  await activeBanner.waitFor({ state: 'visible', timeout: 10000 });
  console.log('Active order banner detected for Table T1!');

  // Capture Screenshot 3: POS Occupied Banner
  const ss3Path = path.join(SCREENSHOT_DIR, '03_pos_round2_occupied_banner.png');
  await page.screenshot({ path: ss3Path });
  console.log(`Saved screenshot 3: ${ss3Path}`);

  // Click "View Items" to check existing order items modal
  const viewItemsBtn = page.getByRole('button', { name: /View Items/i }).first();
  if (await viewItemsBtn.isVisible()) {
    console.log('Opening Existing Order Items Modal...');
    await viewItemsBtn.click();
    await page.waitForTimeout(600);

    const ss4Path = path.join(SCREENSHOT_DIR, '04_pos_existing_items_modal.png');
    await page.screenshot({ path: ss4Path });
    console.log(`Saved screenshot 4: ${ss4Path}`);

    // Close modal
    const closeBtn = page.locator('.mantine-Modal-content').getByRole('button', { name: /Close/i }).or(page.locator('button.mantine-Modal-close')).first();
    await closeBtn.click();
    await page.waitForTimeout(600);
  }

  // Add items for Round 2 by switching category or clicking an item in the grid
  console.log('Adding items for Round 2...');
  const startersTab = page.getByRole('button', { name: 'Starters' }).first();
  if (await startersTab.isVisible()) {
    await startersTab.click();
    await page.waitForTimeout(500);
  }

  const itemToClick = page.getByText('Paneer Tikka').or(page.getByText('Masala Chai')).or(page.getByText('Chicken Biryani')).first();
  await itemToClick.waitFor({ state: 'visible', timeout: 5000 });
  await itemToClick.click();
  await page.waitForTimeout(600);

  // Wait for item to appear in cart
  await cartItemIncrease.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Round 2 item added to cart.');

  // Verify button text changes to "Send Round 2 to Kitchen"
  const sendR2Btn = page.getByRole('button', { name: /Send Round 2 to Kitchen/i }).first();
  await sendR2Btn.waitFor({ state: 'visible', timeout: 8000 });
  console.log('Dynamic Button text confirmed: "Send Round 2 to Kitchen"!');

  // Capture Screenshot 5: Ready to send Round 2
  const ss5Path = path.join(SCREENSHOT_DIR, '05_pos_round2_ready_to_send.png');
  await page.screenshot({ path: ss5Path });
  console.log(`Saved screenshot 5: ${ss5Path}`);

  // Send Round 2!
  console.log('Submitting Round 2...');
  await sendR2Btn.click();

  await notif.waitFor({ state: 'visible', timeout: 15000 });
  console.log('Round 2 Notification:', await notif.innerText());
  await page.waitForTimeout(1500);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 3: Kitchen Display System (/kitchen)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[STEP 3] Navigating to KDS (/kitchen)...');
  await page.goto(`${WEB_BASE}/kitchen`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Look for Round 2 badge "R2"
  const r2Badge = page.locator('text=/R2/i').first();
  await r2Badge.waitFor({ state: 'visible', timeout: 10000 });
  console.log('Confirmed: [R2] badge visible on newly added item in KDS!');

  // Capture Screenshot 6: Kitchen Display with R2 badge
  const ss6Path = path.join(SCREENSHOT_DIR, '06_kitchen_rounds_badge.png');
  await page.screenshot({ path: ss6Path });
  console.log(`Saved screenshot 6: ${ss6Path}`);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 4: Tables Dashboard (/tables)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[STEP 4] Navigating to Tables page (/tables)...');
  await page.goto(`${WEB_BASE}/tables`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Verify Table T1 shows Occupied and "↻ 2 Rounds"
  const t1Card = page.locator('.mantine-Paper-root').filter({ hasText: 'T1' }).first();
  await t1Card.waitFor({ state: 'visible', timeout: 10000 });

  const roundsBadge = t1Card.locator('text=/2 Rounds/i').first();
  await roundsBadge.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Confirmed: Table T1 displays "↻ 2 Rounds" badge!');

  // Capture Screenshot 7: Tables Dashboard with Occupied 2 Rounds
  const ss7Path = path.join(SCREENSHOT_DIR, '07_tables_dashboard_occupied.png');
  await page.screenshot({ path: ss7Path });
  console.log(`Saved screenshot 7: ${ss7Path}`);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 5: View Bill Modal (Grouped by Round)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[STEP 5] Opening "View Bill" modal on Table T1...');
  const viewBillBtn = t1Card.getByRole('button', { name: /View Bill/i }).first();
  await viewBillBtn.click();
  await page.waitForTimeout(1000);

  // Verify Round 1 and Round 2 badges inside modal
  const modalRound1 = page.locator('.mantine-Modal-content').locator('text=/Round 1/i').first();
  const modalRound2 = page.locator('.mantine-Modal-content').locator('text=/Round 2/i').first();
  await modalRound1.waitFor({ state: 'visible', timeout: 5000 });
  await modalRound2.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Confirmed: Bill modal displays separate "Round 1" and "Round 2" groups with items!');

  // Capture Screenshot 8: View Bill Modal with Grouped Rounds
  const ss8Path = path.join(SCREENSHOT_DIR, '08_tables_view_bill_rounds.png');
  await page.screenshot({ path: ss8Path });
  console.log(`Saved screenshot 8: ${ss8Path}`);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 6: Free Table Flow
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[STEP 6] Triggering "Free Table" modal from View Bill modal...');
  const freeTableModalBtn = page.locator('.mantine-Modal-content').getByRole('button', { name: /Free Table/i }).first();
  await freeTableModalBtn.click();
  await page.waitForTimeout(1000);

  // Free Table modal is now open
  const freeModal = page.locator('.mantine-Modal-content').filter({ hasText: /Free Table/i }).first();
  await freeModal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Free Table modal opened.');

  // Capture Screenshot 9: Free Table Modal
  const ss9Path = path.join(SCREENSHOT_DIR, '09_tables_free_modal.png');
  await page.screenshot({ path: ss9Path });
  console.log(`Saved screenshot 9: ${ss9Path}`);

  // Click "Settle & Free Table"
  const settleBtn = freeModal.getByRole('button', { name: /Settle & Free Table/i }).first();
  console.log('Settling and freeing table...');
  await settleBtn.click();

  // Wait for Table Freed notification
  await notif.waitFor({ state: 'visible', timeout: 15000 });
  console.log('Table freed notification:', await notif.innerText());
  await page.waitForTimeout(2500);

  // Verify Table T1 is now Free
  const freeReadyText = t1Card.locator('text=/Table is Free & Ready/i').first();
  await freeReadyText.waitFor({ state: 'visible', timeout: 8000 });
  console.log('Confirmed: Table T1 is now "Table is Free & Ready"!');

  // Capture Screenshot 10: Table Freed
  const ss10Path = path.join(SCREENSHOT_DIR, '10_tables_freed.png');
  await page.screenshot({ path: ss10Path });
  console.log(`Saved screenshot 10: ${ss10Path}`);

  console.log('\n========================================');
  console.log('ALL 10 TESTS & SCREENSHOTS COMPLETED SUCCESSFULLY!');
  console.log('========================================');

  await browser.close();
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
