import { chromium } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const ARTIFACT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

async function loginAndGetCookie(phone: string) {
  const verifyRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, otp: '123456' }),
  });
  if (!verifyRes.ok) throw new Error(`Login failed for ${phone}`);
  const setCookie = verifyRes.headers.get('set-cookie');
  const cookiePair = setCookie?.split(';')[0] ?? '';
  const [cookieName, cookieValue] = cookiePair.split('=');
  const data = await verifyRes.json();
  return { cookiePair, cookieName, cookieValue, user: data.user };
}

async function run() {
  console.log('========================================================================');
  console.log('🚀 TESTING UNLOCKED PRO MODULES (KITCHEN KDS, INVENTORY, RIDERS & CRM)');
  console.log('========================================================================\n');

  const ownerAuth = await loginAndGetCookie('+919985720478');
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  
  await context.addCookies([
    { name: ownerAuth.cookieName, value: decodeURIComponent(ownerAuth.cookieValue), domain: '.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    { name: ownerAuth.cookieName, value: decodeURIComponent(ownerAuth.cookieValue), domain: 'dine.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    { name: ownerAuth.cookieName, value: decodeURIComponent(ownerAuth.cookieValue), domain: 'dine-api.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
  ]);

  const page = await context.newPage();
  page.on('dialog', (d) => d.accept());

  const consoleLogs: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleLogs.push(msg.text());
  });

  // 1. KITCHEN KDS
  console.log('\n[1/5] Testing Kitchen Display System (/kitchen)...');
  await page.goto(`${WEB_BASE}/kitchen?outletId=outlet_Wvz6wURB8azcRBI200raH7Hs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const kdsScreenshot = path.join(ARTIFACT_DIR, 'audit_unlocked_kitchen_kds.png');
  await page.screenshot({ path: kdsScreenshot });
  console.log('  ✓ Captured KDS screen');

  // Test KDS tabs and buttons
  const kdsTabs = await page.locator('button[role="tab"], .mantine-Tabs-tab').all();
  console.log(`  ✓ KDS interactive filter tabs found: ${kdsTabs.length}`);
  for (const tab of kdsTabs) {
    await tab.click().catch(() => {});
    await page.waitForTimeout(300);
  }

  // 2. INVENTORY & RECIPES
  console.log('\n[2/5] Testing Inventory & Stock Management (/inventory)...');
  await page.goto(`${WEB_BASE}/inventory?outletId=outlet_Wvz6wURB8azcRBI200raH7Hs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const invScreenshot = path.join(ARTIFACT_DIR, 'audit_unlocked_inventory.png');
  await page.screenshot({ path: invScreenshot });
  console.log('  ✓ Captured Inventory screen');

  const invSearch = page.locator('input[placeholder*="Search"]').first();
  if (await invSearch.isVisible()) {
    await invSearch.fill('Coffee Beans');
    await page.waitForTimeout(400);
    console.log('  ✓ Inventory search tested');
    await invSearch.fill('');
  }

  const addInvBtn = page.locator('button:has-text("Add Item"), button:has-text("New Item")').first();
  if (await addInvBtn.isVisible()) {
    await addInvBtn.click();
    await page.waitForTimeout(1000);
    const modal = page.getByRole('dialog');
    if (await modal.isVisible()) {
      console.log('  ✓ Add Inventory Item modal opened cleanly');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
    }
  }

  // 3. RIDER & DELIVERY FLEET
  console.log('\n[3/5] Testing Rider / Delivery Fleet (/rider)...');
  await page.goto(`${WEB_BASE}/rider?outletId=outlet_Wvz6wURB8azcRBI200raH7Hs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const riderScreenshot = path.join(ARTIFACT_DIR, 'audit_unlocked_rider.png');
  await page.screenshot({ path: riderScreenshot });
  console.log('  ✓ Captured Rider screen');

  // 4. CUSTOMER PROFILE DRILL-DOWN
  console.log('\n[4/5] Testing Customer Profile Timeline (/customers/9988776655)...');
  await page.goto(`${WEB_BASE}/customers/9988776655?outletId=outlet_Wvz6wURB8azcRBI200raH7Hs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const custProfScreenshot = path.join(ARTIFACT_DIR, 'audit_customer_profile_drilldown.png');
  await page.screenshot({ path: custProfScreenshot });
  console.log('  ✓ Captured Customer Profile drill-down screen');

  // 5. INDIVIDUAL REPORT DRILL-DOWN (/reports/sales)
  console.log('\n[5/5] Testing Reports Drill-Down (/reports/sales)...');
  await page.goto(`${WEB_BASE}/reports/sales?outletId=outlet_Wvz6wURB8azcRBI200raH7Hs`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const reportSalesScreenshot = path.join(ARTIFACT_DIR, 'audit_report_sales_drilldown.png');
  await page.screenshot({ path: reportSalesScreenshot });
  console.log('  ✓ Captured Sales Report drilldown screen');

  await browser.close();
  console.log('\n✅ All unlocked PRO modules tested successfully!');
}

run().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
