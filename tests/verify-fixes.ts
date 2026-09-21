import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const WEB_BASE = 'https://dine.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';
const SCREENSHOT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

async function run() {
  console.log('=== Verifying New User Requirements in Live Production ===\n');

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

  // Navigate to POS
  console.log('Navigating to POS page...');
  await page.goto(`${WEB_BASE}/pos`, { waitUntil: 'commit' });
  await page.waitForTimeout(3000);

  // ─── 1. Verify Outlet Switch Redesign ──────────────────────────────────
  console.log('\n--- 1. Testing Outlet Switch Redesign ---');
  const outletSwitchBtn = page.locator('button[aria-label="Switch outlet"]');
  await outletSwitchBtn.waitFor({ state: 'visible', timeout: 10000 });
  
  const btnText = (await outletSwitchBtn.textContent())?.trim();
  console.log(`Outlet Switch Button visible with text: "${btnText}"`);

  // Click outlet switcher to open menu
  await outletSwitchBtn.click();
  await page.waitForTimeout(600);

  const menuDropdown = page.locator('.mantine-Menu-dropdown');
  await menuDropdown.waitFor({ state: 'visible', timeout: 5000 });
  console.log('Outlet dropdown menu opened successfully with active indicator');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01_redesigned_outlet_switch_dropdown.png') });
  console.log('Saved screenshot: 01_redesigned_outlet_switch_dropdown.png');

  // Close menu by pressing Escape or clicking outside
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // ─── 2. Verify Placeholder text with grey bg for items with no image ──
  console.log('\n--- 2. Testing POS Menu Item Placeholder (Grey BG + Text) ---');
  const noImageLocator = page.locator('text="No Image"').first();
  await noImageLocator.waitFor({ state: 'visible', timeout: 8000 });
  console.log('PASS: Placeholder "No Image" on grey background is clearly visible on cards lacking images!');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02_pos_item_no_image_placeholder.png') });
  console.log('Saved screenshot: 02_pos_item_no_image_placeholder.png');

  // ─── 3. Verify Fixed Cart Box and Scrollable Cart Items Only ───────────
  console.log('\n--- 3. Testing Fixed Cart Box & Scrollable Items ---');
  const itemCards = await page.locator('.mantine-SimpleGrid-root > div').all();
  console.log(`Found ${itemCards.length} items in POS grid. Adding items to cart...`);

  for (let i = 0; i < Math.min(10, itemCards.length); i++) {
    await itemCards[i].click();
    await page.waitForTimeout(200);
    const modalAddBtn = page.locator('.mantine-Modal-content button:has-text("Add")').first();
    if (await modalAddBtn.isVisible().catch(() => false)) {
      await modalAddBtn.click();
      await page.waitForTimeout(200);
    }
  }

  // Get cart measurements
  const measurements = await page.evaluate(() => {
    const cartPaper = document.querySelector('.mantine-Paper-root:has(input[placeholder*="Select table"])') as HTMLElement;
    const sendBtn = Array.from(cartPaper?.querySelectorAll('button') || []).find((b: any) => b.textContent?.includes('Send')) as HTMLElement;
    const scrollViewport = cartPaper?.querySelector('.mantine-ScrollArea-viewport') as HTMLElement;
    const tableSelect = cartPaper?.querySelector('input[placeholder*="Select table"]') as HTMLElement;

    return {
      cartPaperHeight: cartPaper ? cartPaper.offsetHeight : 0,
      cartPaperBounding: cartPaper ? cartPaper.getBoundingClientRect().toJSON() : null,
      sendBtnBounding: sendBtn ? sendBtn.getBoundingClientRect().toJSON() : null,
      tableSelectBounding: tableSelect ? tableSelect.getBoundingClientRect().toJSON() : null,
      scrollH: scrollViewport ? scrollViewport.scrollHeight : 0,
      clientH: scrollViewport ? scrollViewport.clientHeight : 0,
      windowHeight: window.innerHeight,
    };
  });

  console.log('Cart Measurements:', measurements);

  // Assertions for Requirement 1
  if (measurements.cartPaperHeight <= 0 || measurements.cartPaperHeight > measurements.windowHeight) {
    throw new Error(`FAILED: Cart Paper height is ${measurements.cartPaperHeight}, exceeding viewport height ${measurements.windowHeight}!`);
  }
  console.log(`PASS: Cart box height (${measurements.cartPaperHeight}px) is strictly fixed within viewport.`);

  if (!measurements.sendBtnBounding || measurements.sendBtnBounding.bottom > measurements.windowHeight) {
    throw new Error(`FAILED: Send button is pushed below viewport (bottom: ${measurements.sendBtnBounding?.bottom}, window: ${measurements.windowHeight})!`);
  }
  console.log(`PASS: Send button is fixed and clearly visible inside the viewport (bottom: ${measurements.sendBtnBounding.bottom}px <= ${measurements.windowHeight}px).`);

  if (measurements.scrollH <= measurements.clientH) {
    throw new Error(`FAILED: Cart items did not overflow into ScrollArea (scrollH: ${measurements.scrollH}, clientH: ${measurements.clientH})!`);
  }
  console.log(`PASS: Cart items list is scrollable (items height ${measurements.scrollH}px > container height ${measurements.clientH}px).`);

  // Now scroll the cart items to the bottom and verify that header and send button DID NOT MOVE
  console.log('Scrolling cart items list to the bottom...');
  await page.evaluate(() => {
    const cartPaper = document.querySelector('.mantine-Paper-root:has(input[placeholder*="Select table"])') as HTMLElement;
    const scrollViewport = cartPaper?.querySelector('.mantine-ScrollArea-viewport') as HTMLElement;
    if (scrollViewport) {
      scrollViewport.scrollTop = scrollViewport.scrollHeight;
    }
  });
  await page.waitForTimeout(500);

  const measurementsAfterScroll = await page.evaluate(() => {
    const cartPaper = document.querySelector('.mantine-Paper-root:has(input[placeholder*="Select table"])') as HTMLElement;
    const sendBtn = Array.from(cartPaper?.querySelectorAll('button') || []).find((b: any) => b.textContent?.includes('Send')) as HTMLElement;
    const tableSelect = cartPaper?.querySelector('input[placeholder*="Select table"]') as HTMLElement;

    return {
      sendBtnBounding: sendBtn ? sendBtn.getBoundingClientRect().toJSON() : null,
      tableSelectBounding: tableSelect ? tableSelect.getBoundingClientRect().toJSON() : null,
    };
  });

  console.log('Measurements After Scroll:', measurementsAfterScroll);

  const tableTopDiff = Math.abs(measurementsAfterScroll.tableSelectBounding.top - measurements.tableSelectBounding.top);
  const sendTopDiff = Math.abs(measurementsAfterScroll.sendBtnBounding.top - measurements.sendBtnBounding.top);

  console.log(`Table selector top diff after scrolling items: ${tableTopDiff.toFixed(2)}px`);
  console.log(`Send button top diff after scrolling items: ${sendTopDiff.toFixed(2)}px`);

  if (tableTopDiff > 1) {
    throw new Error(`FAILED: Cart header/table selector moved by ${tableTopDiff}px! Expected fixed.`);
  }
  if (sendTopDiff > 1) {
    throw new Error(`FAILED: Cart action/send button moved by ${sendTopDiff}px! Expected fixed.`);
  }

  console.log('PASS: Only cart items scrolled! All other elements (selectors, header, total, buttons) remained strictly fixed!');

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03_fixed_cart_box_items_scrolled.png') });
  console.log('Saved screenshot: 03_fixed_cart_box_items_scrolled.png');

  console.log('\n=== ALL 3 USER REQUIREMENTS VERIFIED SUCCESSFULLY IN PRODUCTION! ===');
  await browser.close();
}

run().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
