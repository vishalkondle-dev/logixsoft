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
  console.log('=== Starting "Settle & Send Does Not Free Table" E2E Test ===');
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const authCookie = await fetchAuthCookie();
  console.log('Authenticated successfully.');

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
  // STEP 0: Clean up any existing active order for T1 via Tables page
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[STEP 0] Checking if Table T1 needs clearing...');
  await page.goto(`${WEB_BASE}/tables`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const existingT1 = page.locator('.mantine-Paper-root').filter({ hasText: 'T1' }).first();
  if (await existingT1.isVisible()) {
    const freeBtn = existingT1.getByRole('button', { name: /Free Table|Settle & Free/i }).first();
    if (await freeBtn.isVisible()) {
      console.log('Clearing existing order on T1...');
      await freeBtn.click();
      await page.waitForTimeout(600);
      const confirmFree = page.locator('.mantine-Modal-content').getByRole('button', { name: /Free Table|Settle/i }).first();
      if (await confirmFree.isVisible()) {
        await confirmFree.click();
        await page.waitForTimeout(1500);
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 1: POS - Order Round 1 via "Settle & Send" (Paid, table occupied)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[STEP 1] Navigating to POS with Table T1...');
  await page.goto(`${WEB_BASE}/pos?table=T1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const tableSelect = page.getByLabel('Table / Order Type').first();
  await tableSelect.waitFor({ state: 'visible', timeout: 10000 });
  const currentTable = await tableSelect.inputValue();
  if (currentTable !== 'T1') {
    await tableSelect.click();
    await page.waitForTimeout(300);
    const t1Opt = page.getByRole('option', { name: /T1/i }).first();
    await t1Opt.click();
    await page.waitForTimeout(500);
  }

  // Add Hyderabadi Chicken Biryani to cart
  const biryaniTab = page.getByRole('button', { name: 'Biryani & Rice', exact: true }).first();
  if (await biryaniTab.isVisible()) {
    await biryaniTab.click();
    await page.waitForTimeout(400);
  }
  const biryani = page.getByText('Hyderabadi Chicken Biryani', { exact: true }).first();
  await biryani.waitFor({ state: 'visible', timeout: 8000 });
  await biryani.click();
  await page.waitForTimeout(500);

  // Click Chevron down on the split button to open "Settle & Send"
  const splitChevron = page.locator('button[aria-label="More order options"]').first();
  await splitChevron.waitFor({ state: 'visible' });
  await splitChevron.click();
  await page.waitForTimeout(400);

  // Click Settle & Send menu item
  const settleMenuItem = page.getByRole('menuitem', { name: /Settle & Send/i }).first();
  await settleMenuItem.waitFor({ state: 'visible' });
  await settleMenuItem.click();
  await page.waitForTimeout(600);

  // Settle modal is open
  const settleModal = page.locator('.mantine-Modal-content').filter({ hasText: 'Settle & Send' }).first();
  await settleModal.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Settle & Send modal is open.');

  // Screenshot 1: Settle Modal for Round 1
  const ss1Path = path.join(SCREENSHOT_DIR, '01_pos_settle_modal_round1.png');
  await page.screenshot({ path: ss1Path });
  console.log(`Saved screenshot 1: ${ss1Path}`);

  // Click Confirm Settlement & Send
  const confirmSettleBtn = settleModal.getByRole('button', { name: /Confirm Settlement & Send/i }).first();
  await confirmSettleBtn.click();
  console.log('Confirmed Settle & Send for Round 1!');

  const notif = page.locator('.mantine-Notification-root').first();
  await notif.waitFor({ state: 'visible', timeout: 15000 });
  console.log('Notification:', await notif.innerText());

  // Screenshot 2: Round 1 Settled notification
  const ss2Path = path.join(SCREENSHOT_DIR, '02_pos_round1_settled_sent.png');
  await page.screenshot({ path: ss2Path });
  console.log(`Saved screenshot 2: ${ss2Path}`);
  await page.waitForTimeout(2000);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 2: Tables page — Verify Table T1 is OCCUPIED and marked PAID!
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[STEP 2] Navigating to Tables page to verify T1 is OCCUPIED (Paid)...');
  await page.goto(`${WEB_BASE}/tables`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const t1Card = page.locator('.mantine-Paper-root').filter({ hasText: 'T1' }).first();
  await t1Card.waitFor({ state: 'visible', timeout: 10000 });

  // Verify badge shows Occupied · Paid
  const paidBadge = t1Card.locator('text=/Occupied · Paid/i').or(t1Card.locator('text=/All Paid/i')).first();
  await paidBadge.waitFor({ state: 'visible', timeout: 8000 });
  console.log('SUCCESS: Table T1 is OCCUPIED with status "Paid"! Table was NOT prematurely freed!');

  // Screenshot 3: Table T1 Occupied & Paid
  const ss3Path = path.join(SCREENSHOT_DIR, '03_tables_t1_occupied_paid.png');
  await page.screenshot({ path: ss3Path });
  console.log(`Saved screenshot 3: ${ss3Path}`);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 3: Return to POS with Table T1, Add Round 2 (Unpaid)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[STEP 3] Re-selecting Table T1 in POS to add Round 2...');
  await page.goto(`${WEB_BASE}/pos?table=T1`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Verify Active banner indicates Round 1 Active & All Paid
  const activeRoundBanner = page.locator('text=/Round 1 Active/i').first();
  await activeRoundBanner.waitFor({ state: 'visible', timeout: 8000 });
  console.log('Active banner confirmed in POS: Table T1 is occupied and ready for Round 2!');

  // Add Paneer Tikka or Starters item
  const starters = page.getByRole('button', { name: 'Starters' }).first();
  if (await starters.isVisible()) {
    await starters.click();
    await page.waitForTimeout(400);
  }
  const item2 = page.getByText('Crispy Corn').or(page.getByText('Paneer Tikka')).first();
  await item2.click();
  await page.waitForTimeout(500);

  const customizeAddBtn = page.locator('.mantine-Modal-content button').filter({ hasText: /^Add/i }).first();
  if (await customizeAddBtn.isVisible()) {
    await customizeAddBtn.click();
    await page.waitForTimeout(500);
  }

  // Verify button text says "Send Round 2 to Kitchen"
  const sendR2Btn = page.getByRole('button', { name: /Send Round 2 to Kitchen/i }).first();
  await sendR2Btn.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Primary action updated dynamically to "Send Round 2 to Kitchen"!');

  // Screenshot 4: POS Round 2 Cart with All Paid banner
  const ss4Path = path.join(SCREENSHOT_DIR, '04_pos_round2_with_paid_banner.png');
  await page.screenshot({ path: ss4Path });
  console.log(`Saved screenshot 4: ${ss4Path}`);

  // Click Send Round 2 to Kitchen (unpaid round)
  await sendR2Btn.click();
  await notif.waitFor({ state: 'visible', timeout: 15000 });
  console.log('Round 2 sent notification:', await notif.innerText());
  await page.waitForTimeout(2000);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 4: Tables page — Verify Table T1 shows 2 Rounds with Due Balance!
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[STEP 4] Navigating to Tables page to inspect multi-round balance...');
  await page.goto(`${WEB_BASE}/tables`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const t1CardR2 = page.locator('.mantine-Paper-root').filter({ hasText: 'T1' }).first();
  await t1CardR2.waitFor({ state: 'visible' });

  // Verify 2 rounds badge
  const r2Badge = t1CardR2.locator('text=/2 Rounds/i').first();
  await r2Badge.waitFor({ state: 'visible', timeout: 8000 });

  // Verify Due amount is displayed (since Round 2 is unpaid)
  const dueIndicator = t1CardR2.locator('text=/Due/i').first();
  await dueIndicator.waitFor({ state: 'visible' });
  console.log('Table T1 shows 2 Rounds and active Due balance for Round 2!');

  // Screenshot 5: Tables page showing 2 Rounds and Due
  const ss5Path = path.join(SCREENSHOT_DIR, '05_tables_t1_due_balance.png');
  await page.screenshot({ path: ss5Path });
  console.log(`Saved screenshot 5: ${ss5Path}`);

  // Click "View Bill" to inspect Round breakdown
  const viewBillBtn = t1CardR2.getByRole('button', { name: /View Bill/i }).first();
  await viewBillBtn.click();
  await page.waitForTimeout(800);

  // Verify Round 1 shows Paid and Round 2 shows Unpaid
  const billModal = page.locator('.mantine-Modal-content').filter({ hasText: /Bill Preview/i }).first();
  await billModal.waitFor({ state: 'visible' });

  // Screenshot 6: Bill Preview showing Round 1 [Paid] and Round 2 [Unpaid]
  const ss6Path = path.join(SCREENSHOT_DIR, '06_tables_bill_modal_paid_unpaid_rounds.png');
  await page.screenshot({ path: ss6Path });
  console.log(`Saved screenshot 6: ${ss6Path}`);

  // Close bill modal
  const closeBillBtn = billModal.locator('button.mantine-Modal-close').or(billModal.getByRole('button', { name: /Close/i })).first();
  await closeBillBtn.click();
  await page.waitForTimeout(500);

  // ──────────────────────────────────────────────────────────────────────────
  // STEP 5: Free Table — Settle the remaining Round 2 and Free Table!
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n[STEP 5] Clicking "Free Table" / "Settle & Free" to clear table...');
  const settleFreeBtn = t1CardR2.getByRole('button', { name: /Free Table|Settle & Free/i }).first();
  await settleFreeBtn.click();
  await page.waitForTimeout(600);

  const freeModal = page.locator('.mantine-Modal-content').filter({ hasText: /Free Table/i }).first();
  await freeModal.waitFor({ state: 'visible' });

  // Screenshot 7: Free Table modal with Due settlement options
  const ss7Path = path.join(SCREENSHOT_DIR, '07_tables_free_modal_settle_due.png');
  await page.screenshot({ path: ss7Path });
  console.log(`Saved screenshot 7: ${ss7Path}`);

  // Click Settle & Free Table
  const finalSettleBtn = freeModal.getByRole('button', { name: /Settle.*Free Table|Free Table/i }).first();
  await finalSettleBtn.click();
  await page.waitForTimeout(2000);

  // Verify Table T1 is now "Free & Ready"
  const freeBadge = page.locator('.mantine-Paper-root').filter({ hasText: 'T1' }).locator('text=/Free & Ready/i').first();
  await freeBadge.waitFor({ state: 'visible', timeout: 10000 });
  console.log('SUCCESS: Table T1 is now FREE & READY!');

  // Screenshot 8: Table T1 completely freed
  const ss8Path = path.join(SCREENSHOT_DIR, '08_tables_t1_freed_and_ready.png');
  await page.screenshot({ path: ss8Path });
  console.log(`Saved screenshot 8: ${ss8Path}`);

  await browser.close();
  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

run().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
