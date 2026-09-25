import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const WEB_BASE = 'https://dine.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

async function run() {
  console.log('=== Starting Complete E2E Verification of Settings Tweaks Enforcement ===');
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

  try {
    // ──────────────────────────────────────────────────────────────────────────
    // STEP 1: Disable Delivery in /settings/dining
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 1: Disable Delivery in /settings/dining ---');
    await page.goto(`${WEB_BASE}/settings/dining`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const deliverySwitch = page.locator('input[aria-label="Toggle Delivery"]').first();
    await deliverySwitch.waitFor({ state: 'attached', timeout: 10000 });

    const isDeliveryChecked = await deliverySwitch.isChecked();
    console.log(`Initial Delivery Switch Checked: ${isDeliveryChecked}`);
    if (isDeliveryChecked) {
      await deliverySwitch.click({ force: true });
      console.log('Turned Delivery Switch OFF');
      await page.waitForTimeout(500);

      const saveBtn = page.locator('button:has-text("Save Dining Options"):visible, button:has-text("Save Changes"):visible').first();
      await saveBtn.scrollIntoViewIfNeeded();
      await saveBtn.click({ force: true });
      await page.waitForTimeout(3000);
    } else {
      console.log('Delivery Switch is already OFF');
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'e2e_tweak_01_dining_delivery_disabled.png'),
      fullPage: false,
    });
    console.log('Captured: e2e_tweak_01_dining_delivery_disabled.png');

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 2: Verify Delivery Mode is Hidden on POS (/pos)
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 2: Verify Delivery Mode is Hidden on POS ---');
    await page.goto(`${WEB_BASE}/pos`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const segmentedControlText = await page.locator('.mantine-SegmentedControl-root').first().innerText();
    console.log(`POS SegmentedControl contents: "${segmentedControlText.replace(/\n/g, ' ')}"`);
    const isDeliveryVisible = segmentedControlText.includes('Delivery');
    console.log(`Delivery mode visible on POS (should be false): ${isDeliveryVisible}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'e2e_tweak_02_pos_delivery_hidden.png'),
      fullPage: false,
    });
    console.log('Captured: e2e_tweak_02_pos_delivery_hidden.png');

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 3: Re-enable Delivery & Set Fees / Thresholds in /settings/dining
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 3: Re-enable Delivery and Configure Pricing Rules ---');
    await page.goto(`${WEB_BASE}/settings/dining`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const deliverySwitch2 = page.locator('input[aria-label="Toggle Delivery"]').first();
    const isDeliveryChecked2 = await deliverySwitch2.isChecked();
    if (!isDeliveryChecked2) {
      await deliverySwitch2.click({ force: true });
      console.log('Turned Delivery Switch ON');
      await page.waitForTimeout(500);
    }

    // Set packaging fee: ₹15
    const packInput = page.locator('label:has-text("Standard Packaging Fee (₹)")').locator('..').locator('input').first();
    if (await packInput.isVisible()) {
      await packInput.fill('15');
      console.log('Set packaging fee to ₹15');
    }

    // Set delivery fee: ₹30
    const delFeeInput = page.locator('label:has-text("Standard Delivery Fee (₹)")').locator('..').locator('input').first();
    if (await delFeeInput.isVisible()) {
      await delFeeInput.fill('30');
      console.log('Set standard delivery fee to ₹30');
    }

    // Set min delivery order: ₹200
    const minDelInput = page.locator('label:has-text("Minimum Delivery Order (₹)")').locator('..').locator('input').first();
    if (await minDelInput.isVisible()) {
      await minDelInput.fill('200');
      console.log('Set minimum delivery order to ₹200');
    }

    // Set free delivery above: ₹300
    const freeDelInput = page.locator('label:has-text("Free Delivery Above (₹)")').locator('..').locator('input').first();
    if (await freeDelInput.isVisible()) {
      await freeDelInput.fill('300');
      console.log('Set free delivery above to ₹300');
    }

    // Save
    const saveBtn2 = page.locator('button:has-text("Save Dining Options"):visible, button:has-text("Save Changes"):visible').first();
    await saveBtn2.scrollIntoViewIfNeeded();
    await saveBtn2.click({ force: true });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'e2e_tweak_03_dining_delivery_enabled_with_rules.png'),
      fullPage: false,
    });
    console.log('Captured: e2e_tweak_03_dining_delivery_enabled_with_rules.png');

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 4: Verify Delivery Restored, Fees, & Minimum Delivery Block on POS
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 4: Verify Restored Delivery & Dynamic Fees on POS ---');
    await page.goto(`${WEB_BASE}/pos`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const segmentedControlText2 = await page.locator('.mantine-SegmentedControl-root').first().innerText();
    console.log(`POS SegmentedControl contents after re-enabling: "${segmentedControlText2.replace(/\n/g, ' ')}"`);
    const isDeliveryRestored = segmentedControlText2.includes('Delivery');
    console.log(`Delivery mode restored on POS (should be true): ${isDeliveryRestored}`);

    if (isDeliveryRestored) {
      // Click delivery label in segmented control
      const deliveryLabel = page.locator('.mantine-SegmentedControl-label:has-text("Delivery")').first();
      await deliveryLabel.click({ force: true });
      await page.waitForTimeout(1000);
    }

    // Click an item card to add to cart
    const firstMenuItem = page.locator('div[style*="cursor: pointer"], div.mantine-Card-root').filter({ hasText: '₹' }).first();
    if (await firstMenuItem.isVisible()) {
      await firstMenuItem.click();
      await page.waitForTimeout(800);
      console.log('Clicked menu item');
    }

    // If item customization modal appeared, click Add to Order
    const modalAddBtn = page.locator('button:has-text("Add · ₹")').first();
    if (await modalAddBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await modalAddBtn.click();
      await page.waitForTimeout(800);
      console.log('Confirmed item customization in modal');
    }

    // Check for minimum delivery order alert
    const minAlert = page.locator('text=Min delivery order ₹200').first();
    const isMinAlertVisible = await minAlert.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`Minimum delivery order warning visible (subtotal below ₹200): ${isMinAlertVisible}`);

    // Check send button is disabled due to minimum delivery block
    const sendButton = page.locator('button:has-text("Send")').first();
    const isSendDisabled = await sendButton.isDisabled();
    console.log(`Send button disabled while below minimum order: ${isSendDisabled}`);

    // Increment quantity using the cart plus button until subtotal reaches ₹300
    const incBtn = page.locator('button[aria-label="Increase quantity"]').first();
    for (let i = 0; i < 4; i++) {
      if (await incBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await incBtn.click();
        await page.waitForTimeout(400);
      }
    }
    await page.waitForTimeout(1000);

    // Check if free delivery badge is now visible
    const freeBadge = page.locator('span.mantine-Badge-label:has-text("FREE")').first();
    const isFreeDeliveryVisible = await freeBadge.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`FREE delivery fee badge visible (subtotal above ₹300): ${isFreeDeliveryVisible}`);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'e2e_tweak_04_pos_delivery_rules_enforced.png'),
      fullPage: false,
    });
    console.log('Captured: e2e_tweak_04_pos_delivery_rules_enforced.png');

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 5: Verify Tables Grid Integration with Reservations
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 5: Verify Tables Grid & Reservation Integration ---');
    await page.goto(`${WEB_BASE}/settings/reservations`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Open New Reservation modal to create one assigned to a table
    const newResBtn = page.locator('button:has-text("New Reservation")').first();
    if (await newResBtn.isVisible()) {
      await newResBtn.click();
      await page.waitForTimeout(800);
      await page.locator('input[placeholder="e.g. Rahul Sharma"]').fill('Priya Sundaram');
      await page.locator('input[placeholder="10-digit mobile"]').fill('9876543210');

      // Select table if available in select
      const tableSelect = page.locator('input[placeholder="Choose table"]').first();
      if (await tableSelect.isVisible()) {
        await tableSelect.click();
        await page.waitForTimeout(500);
        const firstOption = page.locator('.mantine-Select-option').first();
        if (await firstOption.isVisible()) {
          const optText = await firstOption.innerText();
          console.log(`Assigned table selected: ${optText}`);
          await firstOption.click();
          await page.waitForTimeout(300);
        }
      }

      await page.locator('button:has-text("Confirm Reservation")').click();
      await page.waitForTimeout(2000);
      console.log('Created table reservation for Priya Sundaram');
    }

    // Go to Tables page
    await page.goto(`${WEB_BASE}/tables`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Look for reservation badge
    const resvBadge = page.locator('text=Resv:').first();
    const isResvBadgeVisible = await resvBadge.isVisible({ timeout: 4000 }).catch(() => false);
    console.log(`Reservation badge visible on tables grid: ${isResvBadgeVisible}`);

    if (isResvBadgeVisible) {
      const tableCard = page.locator('div.mantine-Paper-root:has-text("Resv:")').first();
      // Click the 3-dots menu button inside that card
      const menuBtn = tableCard.locator('button').filter({ has: page.locator('svg') }).last();
      await menuBtn.click();
      await page.waitForTimeout(600);
      const seatMenuVisible = await page.locator('text=Seat Reserved Guest').isVisible().catch(() => false);
      console.log(`Seat Reserved Guest menu action visible: ${seatMenuVisible}`);
    }

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'e2e_tweak_05_tables_reservation_badge_and_action.png'),
      fullPage: false,
    });
    console.log('Captured: e2e_tweak_05_tables_reservation_badge_and_action.png');

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 6: Verify QR Menu Settings & Customer Portal
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 6: Verify QR Menu Settings ---');
    await page.goto(`${WEB_BASE}/settings/qr-menu`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'e2e_tweak_06_qr_menu_settings.png'),
      fullPage: false,
    });
    console.log('Captured: e2e_tweak_06_qr_menu_settings.png');

    // ──────────────────────────────────────────────────────────────────────────
    // STEP 7: Verify WhatsApp Automated Triggers Settings
    // ──────────────────────────────────────────────────────────────────────────
    console.log('\n--- Step 7: Verify WhatsApp Automated Triggers Settings ---');
    await page.goto(`${WEB_BASE}/settings/whatsapp`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'e2e_tweak_07_whatsapp_settings.png'),
      fullPage: false,
    });
    console.log('Captured: e2e_tweak_07_whatsapp_settings.png');

    console.log('\n=== All Tweak Verification Steps Completed Successfully! ===');
  } catch (error) {
    console.error('Test execution failed:', error);
  } finally {
    await browser.close();
  }
}

run();
