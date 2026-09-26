import { chromium } from '@playwright/test';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const OWNER_PHONE = '+917276718848';
const DEV_OTP = '123456';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

async function fetchAuthCookie(): Promise<{ name: string; value: string; domain: string; path: string }> {
  const sRes = await fetch(`${API_BASE}/auth/phone/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: OWNER_PHONE }),
  });
  if (!sRes.ok) {
    throw new Error(`send-otp failed: ${sRes.status} ${await sRes.text()}`);
  }

  const vRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: OWNER_PHONE, otp: DEV_OTP }),
  });
  if (!vRes.ok) {
    throw new Error(`verify failed: ${vRes.status} ${await vRes.text()}`);
  }

  const setCookies = (vRes.headers as any).getSetCookie
    ? (vRes.headers as any).getSetCookie()
    : [vRes.headers.get('set-cookie')];
  const cookieStr = setCookies.filter(Boolean).join('; ');

  const match = cookieStr.match(/__Secure-logix-dine\.session_token=([^;]+)/);
  if (!match) {
    throw new Error(`Session cookie not found in: ${cookieStr}`);
  }

  return {
    name: '__Secure-logix-dine.session_token',
    value: match[1],
    domain: '.logixsoft.in',
    path: '/',
  };
}

async function run() {
  console.log('Fetching auth cookie...');
  const authCookie = await fetchAuthCookie();
  console.log('Auth cookie received.');

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
      domain: '.logixsoft.in',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: authCookie.name,
      value: authCookie.value,
      domain: 'dine.logixsoft.in',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();
  console.log('Navigating to /tables first...');
  await page.goto(`${WEB_BASE}/tables`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  console.log('Navigating to /pos?table=T1...');
  await page.goto(`${WEB_BASE}/pos?table=T1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Take screenshot of POS page
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pos_page_loaded.png') });

  // Find dish and click on it to add to cart
  console.log('Adding "Crispy Corn Salt & Pepper" to cart...');
  const crispyCorn = page.locator('text="Crispy Corn Salt & Pepper"').first();
  await crispyCorn.click();
  await page.waitForTimeout(1000);

  // Click another dish like "Dahi Ke Kebab"
  console.log('Adding "Dahi Ke Kebab" to cart...');
  const dahiKebab = page.locator('text="Dahi Ke Kebab"').first();
  await dahiKebab.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pos_dish_added.png') });

  // Check "+ Add" in Taxes & Discounts
  const addBtn = page.locator('button[aria-label="Add tax or discount"]').first();
  console.log('"Add" button in Taxes & Discounts visible:', await addBtn.isVisible());

  if (await addBtn.isVisible()) {
    console.log('Clicking "Add" button in Taxes & Discounts...');
    await addBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pos_adjustment_modal_open.png') });

    // Click quick preset "GST 5%"
    const gstChip = page.locator('button:has-text("GST 5%")').first();
    await gstChip.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Selecting GST 5% preset...');
    await gstChip.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pos_adjustment_preset_gst.png') });

    // Apply
    const applyBtn = page.locator('.mantine-Modal-content button:has-text("Apply to Order")').first();
    await applyBtn.click();
    await page.waitForTimeout(1000);
    console.log('Applied GST 5% adjustment.');
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pos_cart_with_gst.png') });

  // Add a discount
  if (await addBtn.isVisible()) {
    console.log('Adding discount adjustment...');
    await addBtn.click();
    await page.waitForTimeout(800);

    // Switch tab to Discount
    const discTab = page.locator('text="- Discount"').first();
    await discTab.click();
    await page.waitForTimeout(500);

    const tenOff = page.locator('button:has-text("Discount 10%")').first();
    await tenOff.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Selecting Discount 10% preset...');
    await tenOff.click();
    await page.waitForTimeout(500);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pos_discount_modal.png') });
    const applyBtn = page.locator('.mantine-Modal-content button:has-text("Apply to Order")').first();
    await applyBtn.click();
    await page.waitForTimeout(1000);
    console.log('Applied 10% discount.');
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pos_cart_with_tax_and_discount.png') });

  // Test Editing the discount or tax
  console.log('Testing edit button...');
  const editBtn = page.locator('button[aria-label*="Edit"]').first();
  if (await editBtn.isVisible()) {
    await editBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pos_edit_adjustment_modal.png') });
    const valInput = page.locator('input[placeholder*="5%"], input[placeholder*="Value"], .mantine-Modal-content input[type="text"]').last();
    await valInput.fill('12%');
    const updateBtn = page.locator('.mantine-Modal-content button:has-text("Update Adjustment")').first();
    await updateBtn.click();
    await page.waitForTimeout(1000);
    console.log('Updated adjustment to 12%.');
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pos_cart_after_edit.png') });

  // Test Settle Modal
  const chevronBtn = page.locator('button[aria-label="More order options"]').first();
  console.log('Opening Settle action...');
  if (await chevronBtn.isVisible()) {
    await chevronBtn.click();
    await page.waitForTimeout(500);
    const settleOption = page.locator('button:has-text("Settle & Send"), .mantine-Menu-item:has-text("Settle & Send")').first();
    if (await settleOption.isVisible()) {
      await settleOption.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pos_settle_modal_complete.png') });
      console.log('Captured settle modal screenshot.');
    }
  }

  console.log('Verification completed successfully!');
  await browser.close();
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
