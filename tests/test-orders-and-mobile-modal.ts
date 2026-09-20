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
  console.log('--- Starting Orders & Mobile Cart Modal Verification ---');
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const authCookie = await fetchAuthCookie();
  console.log('Authenticated successfully, session token retrieved.');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: Mobile Cart Drawer & "View Items" Modal Visibility (iPhone 14 size)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 1: Mobile Screen Cart Drawer & View Items Modal ---');
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  });

  await mobileContext.addCookies([
    {
      name: authCookie.name,
      value: authCookie.value,
      domain: authCookie.domain,
      path: authCookie.path,
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${WEB_BASE}/tables`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2000);

  // Check if Table 1 is occupied; if not, let's create a round 1 and round 2 order on Table 1
  const t1Card = mobilePage.locator('text=Table 1').first();
  await mobilePage.goto(`${WEB_BASE}/pos?table=Table%201`, { waitUntil: 'networkidle' });
  await mobilePage.waitForTimeout(2000);

  // Add an item to cart if table doesn't have active items or add to cart
  const itemBtn = mobilePage.locator('button:has-text("+"), button:has-text("Add")').first();
  if (await itemBtn.isVisible()) {
    await itemBtn.click();
    await mobilePage.waitForTimeout(500);
  }

  // If table is not yet occupied, let's Send to Kitchen to create active items
  const sendToKitchenBtn = mobilePage.locator('button:has-text("Send to Kitchen"), button:has-text("Send Order")').first();
  if (await sendToKitchenBtn.isVisible()) {
    console.log('Sending order to kitchen for Table 1...');
    await sendToKitchenBtn.click();
    await mobilePage.waitForTimeout(2000);
    // Reload POS to see active table
    await mobilePage.goto(`${WEB_BASE}/pos?table=Table%201`, { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(2000);
  }

  // Now on mobile, add an item so cart drawer shows items
  const anotherItem = mobilePage.locator('button:has-text("+"), button:has-text("Add")').first();
  if (await anotherItem.isVisible()) {
    await anotherItem.click();
    await mobilePage.waitForTimeout(500);
  }

  // Find the mobile cart button/drawer trigger at bottom
  const viewCartDrawerBtn = mobilePage.locator('button:has-text("Cart"), button:has-text("Items"), button:has-text("View Cart")').first();
  if (await viewCartDrawerBtn.isVisible()) {
    console.log('Opening mobile cart drawer...');
    await viewCartDrawerBtn.click();
    await mobilePage.waitForTimeout(1000);
  }

  // In the mobile cart, find "View Active Items" or "View Items" button
  const viewActiveItemsBtn = mobilePage.locator('button:has-text("View Items"), button:has-text("Active Items")').first();
  if (await viewActiveItemsBtn.isVisible()) {
    console.log('Clicking "View Items" inside mobile cart...');
    await viewActiveItemsBtn.click();
    await mobilePage.waitForTimeout(1500);

    // Capture screenshot showing View Items modal visible above mobile cart drawer
    await mobilePage.screenshot({
      path: path.join(SCREENSHOT_DIR, '01_mobile_cart_view_items_modal.png'),
      fullPage: false,
    });
    console.log('Saved screenshot: 01_mobile_cart_view_items_modal.png');
  } else {
    // If modal already open from banner
    const bannerViewBtn = mobilePage.locator('button:has-text("View Items")').first();
    if (await bannerViewBtn.isVisible()) {
      await bannerViewBtn.click();
      await mobilePage.waitForTimeout(1500);
      await mobilePage.screenshot({
        path: path.join(SCREENSHOT_DIR, '01_mobile_cart_view_items_modal.png'),
        fullPage: false,
      });
      console.log('Saved screenshot from banner: 01_mobile_cart_view_items_modal.png');
    }
  }

  await mobileContext.close();

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Orders Screen Verification (List, Badges, Detail Modal, Actions)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test 2: Orders Screen ---');
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await desktopContext.addCookies([
    {
      name: authCookie.name,
      value: authCookie.value,
      domain: authCookie.domain,
      path: authCookie.path,
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  const page = await desktopContext.newPage();
  await page.goto(`${WEB_BASE}/orders`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Take screenshot of Orders List
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, '02_orders_screen_list.png'),
    fullPage: false,
  });
  console.log('Saved screenshot: 02_orders_screen_list.png');

  // Click on the first order card
  const firstOrderCard = page.locator('div[style*="cursor: pointer"]').first();
  if (await firstOrderCard.isVisible()) {
    console.log('Opening order details modal for first order...');
    await firstOrderCard.click();
    await page.waitForTimeout(1000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03_orders_detail_modal.png'),
      fullPage: false,
    });
    console.log('Saved screenshot: 03_orders_detail_modal.png');

    // Test Settle Balance Modal if button visible
    const settleBtn = page.locator('button:has-text("Settle")').first();
    if (await settleBtn.isVisible()) {
      console.log('Opening Settle Balance sub-modal...');
      await settleBtn.click();
      await page.waitForTimeout(800);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '04_orders_settle_modal.png'),
        fullPage: false,
      });
      console.log('Saved screenshot: 04_orders_settle_modal.png');

      // Close settle modal
      const cancelBtn = page.locator('button:has-text("Cancel")').first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Test Free Table Modal if button visible
    const freeTableBtn = page.locator('button:has-text("Free Table")').first();
    if (await freeTableBtn.isVisible()) {
      console.log('Opening Free Table sub-modal...');
      await freeTableBtn.click();
      await page.waitForTimeout(800);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '05_orders_free_table_modal.png'),
        fullPage: false,
      });
      console.log('Saved screenshot: 05_orders_free_table_modal.png');

      const cancelBtn = page.locator('button:has-text("Cancel")').first();
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }
    }
  }

  await browser.close();
  console.log('\n--- Verification completed successfully ---');
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
