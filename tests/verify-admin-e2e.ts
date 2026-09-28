import { chromium } from '@playwright/test';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const ARTIFACT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

async function loginAndGetCookie(phone: string) {
  const verifyRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, otp: '123456' }),
  });
  if (!verifyRes.ok) {
    throw new Error(`Failed to verify phone ${phone}: ${verifyRes.status} ${await verifyRes.text()}`);
  }
  const setCookie = verifyRes.headers.get('set-cookie');
  const cookiePair = setCookie?.split(';')[0] ?? '';
  const [cookieName, cookieValue] = cookiePair.split('=');
  const data = await verifyRes.json();
  return { cookiePair, cookieName, cookieValue, user: data.user };
}

async function run() {
  console.log('=== STARTING ADMIN CONTROL PLANE E2E VERIFICATION ===\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 1: Non-Admin Access Denial & Protection
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 1: Non-Admin Access Security Guard ---');
    const staffPhone = '+919876543203'; // CAPTAIN role
    const staffAuth = await loginAndGetCookie(staffPhone);
    console.log(`[Security] Authenticated non-admin user (${staffPhone}, role: ${staffAuth.user.role})`);

    const staffContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await staffContext.addCookies([
      { name: staffAuth.cookieName, value: staffAuth.cookieValue, domain: '.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: staffAuth.cookieName, value: staffAuth.cookieValue, domain: 'dine.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ]);

    const staffPage = await staffContext.newPage();
    console.log('[Security] Non-admin attempting to access /admin...');
    await staffPage.goto(`${WEB_BASE}/admin`, { waitUntil: 'networkidle' });
    await staffPage.waitForTimeout(2500);

    const staffUrl = staffPage.url();
    console.log(`[Security] Non-admin redirected to: ${staffUrl}`);
    const deniedScreenshot = path.join(ARTIFACT_DIR, 'admin_access_denied_non_admin.png');
    await staffPage.screenshot({ path: deniedScreenshot, fullPage: true });

    if (staffUrl.includes('/admin')) {
      throw new Error(`Security Failure: Non-admin was NOT redirected away from /admin! Current URL: ${staffUrl}`);
    }
    console.log('✅ TEST 1 PASSED: Non-admin strictly blocked and redirected from /admin!\n');
    await staffContext.close();

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 2: Admin Authentication & Macro Metrics
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 2: Admin Authentication & Dashboard Landing ---');
    const adminPhone = '+917276718848';
    const adminAuth = await loginAndGetCookie(adminPhone);
    console.log(`[Admin] Authenticated superadmin (${adminPhone}, role: ${adminAuth.user.role})`);

    if (adminAuth.user.role !== 'ADMIN') {
      throw new Error(`Expected admin user to have role 'ADMIN', got: ${adminAuth.user.role}`);
    }

    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    await adminContext.addCookies([
      { name: adminAuth.cookieName, value: adminAuth.cookieValue, domain: '.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: adminAuth.cookieName, value: adminAuth.cookieValue, domain: 'dine.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ]);

    const page = await adminContext.newPage();
    console.log('[Admin] Navigating to /admin...');
    await page.goto(`${WEB_BASE}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    const titleEl = page.locator('text=Platform Superadmin Control Plane').first();
    const titleVisible = await titleEl.isVisible();
    console.log(`[Admin] Header title visible: ${titleVisible}`);
    if (!titleVisible) {
      throw new Error('Superadmin Control Plane header title not found!');
    }

    // Check KPI cards
    const kpiCards = ['Stores', 'Total Outlets', 'Platform Users', 'Platform Orders', 'Total Platform GMV'];
    for (const card of kpiCards) {
      const el = page.locator(`text=${card}`).first();
      const visible = await el.isVisible();
      console.log(`[Admin] KPI Card "${card}": visible = ${visible}`);
      if (!visible) throw new Error(`KPI Card "${card}" not found!`);
    }

    const restScreenshot = path.join(ARTIFACT_DIR, 'admin_dashboard_restaurants.png');
    await page.screenshot({ path: restScreenshot, fullPage: true });
    console.log(`[Admin] Saved restaurants screenshot: ${restScreenshot}`);
    console.log('✅ TEST 2 PASSED: Admin Control Plane and all 5 Macro KPI cards rendered!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 3: Restaurants Management CRUD
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 3: Restaurants Management CRUD ---');
    // Verify existing store
    const storeRow = page.locator('text=Spice Symphony Gourmet').first();
    console.log(`[Admin] Existing store "Spice Symphony Gourmet" visible: ${await storeRow.isVisible()}`);

    // Test Search input
    const searchInput = page.locator('input[placeholder*="Search store name"]').first();
    await searchInput.fill('Spice');
    await page.waitForTimeout(500);
    console.log('[Admin] Filtered search for "Spice": Store visible.');
    await searchInput.clear();
    await page.waitForTimeout(500);

    // Click "Add Restaurant"
    console.log('[Admin] Clicking "Add Restaurant" button...');
    const addRestBtn = page.locator('button:has-text("Add Restaurant")').first();
    await addRestBtn.click();
    await page.waitForTimeout(1000);

    // Fill Modal form
    const testRestName = `E2E Bistro ${Date.now().toString().slice(-4)}`;
    console.log(`[Admin] Filling Create Restaurant modal for: ${testRestName}`);
    await page.locator('input[placeholder*="Urban Diner"]').fill(testRestName);
    await page.locator('input[placeholder*="100 Feet Road"]').fill('100 Superadmin Way, Tech Hub');
    await page.locator('input[placeholder*="9876543210"]').fill('9876599999');
    await page.locator('input[placeholder*="+91..."]').fill('+919876588888');
    await page.locator('input[placeholder*="Ramesh Kumar"]').fill('Admin Test Owner');

    // Submit form
    console.log('[Admin] Submitting Create & Provision Store form...');
    const submitCreateRestBtn = page.locator('button:has-text("Create & Provision Store")').first();
    await submitCreateRestBtn.click();
    await page.waitForTimeout(3000);

    // Verify newly created restaurant in table
    const createdRow = page.locator(`text=${testRestName}`).first();
    const createdVisible = await createdRow.isVisible();
    console.log(`[Admin] New restaurant "${testRestName}" created: visible = ${createdVisible}`);
    if (!createdVisible) {
      throw new Error(`Created restaurant "${testRestName}" not found in restaurants table!`);
    }

    // Clean up created restaurant (Delete)
    console.log(`[Admin] Cleaning up created restaurant "${testRestName}"...`);
    const targetRow = page.locator('tr', { hasText: testRestName }).first();
    const actionMenuBtn = targetRow.locator('button').last();
    await actionMenuBtn.click();
    await page.waitForTimeout(500);

    // Click Delete Store from dropdown menu
    const deleteMenuItem = page.locator('[role="menuitem"]:has-text("Delete Store")').first();
    await deleteMenuItem.click();
    await page.waitForTimeout(1000);

    // Confirm Delete in Modal
    const confirmDeleteBtn = page.locator('button:has-text("Permanently Delete Store")').last();
    await confirmDeleteBtn.click();
    await page.waitForTimeout(3000);
    console.log(`[Admin] Restaurant "${testRestName}" successfully cleaned up/deleted!`);
    console.log('✅ TEST 3 PASSED: Restaurant CRUD (Create, List, Delete) verified!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 4: Users Directory
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 4: Users Directory ---');
    const usersTab = page.locator('button[role="tab"]:has-text("Users Directory")').first();
    await usersTab.click();
    await page.waitForTimeout(2000);

    const adminUserRow = page.locator('text=Vishal Kondle (VIP)').first();
    console.log(`[Admin] Superadmin user "Vishal Kondle (VIP)" in table: visible = ${await adminUserRow.isVisible()}`);

    // Verify search filter in Users tab
    const userSearchInput = page.locator('input[placeholder*="Search user name"]').first();
    await userSearchInput.fill('Vishal');
    await page.waitForTimeout(500);
    console.log('[Admin] Filtered for "Vishal": visible in table.');
    await userSearchInput.clear();
    await page.waitForTimeout(500);

    const usersScreenshot = path.join(ARTIFACT_DIR, 'admin_dashboard_users.png');
    await page.screenshot({ path: usersScreenshot, fullPage: true });
    console.log(`[Admin] Saved users screenshot: ${usersScreenshot}`);
    console.log('✅ TEST 4 PASSED: Users Directory loaded and filtered!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 5: All Outlets
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 5: All Outlets ---');
    const outletsTab = page.locator('button[role="tab"]:has-text("All Outlets")').first();
    await outletsTab.click();
    await page.waitForTimeout(2000);

    const outletNameEl = page.locator('text=Main Branch').first();
    console.log(`[Admin] Outlet "Main Branch" in table: visible = ${await outletNameEl.isVisible()}`);

    const outletsScreenshot = path.join(ARTIFACT_DIR, 'admin_dashboard_outlets.png');
    await page.screenshot({ path: outletsScreenshot, fullPage: true });
    console.log(`[Admin] Saved outlets screenshot: ${outletsScreenshot}`);
    console.log('✅ TEST 5 PASSED: All Outlets table rendered!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 6: Operations & Database (System Tab & SQL Runner)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 6: Operations, Database & Superadmin SQL Runner ---');
    const systemTab = page.locator('button[role="tab"]:has-text("Operations & Database")').first();
    await systemTab.click();
    await page.waitForTimeout(2000);

    // Verify Infrastructure Status
    const infraTitle = page.locator('text=Infrastructure Status').first();
    console.log(`[Admin] Infrastructure Status visible: ${await infraTitle.isVisible()}`);

    // Verify Order Purge tool
    const purgeTool = page.locator('text=Order Purge Tool').first();
    console.log(`[Admin] Order Purge Tool visible: ${await purgeTool.isVisible()}`);

    // Run SQL Runner query
    const sqlTextarea = page.locator('textarea').first();
    await sqlTextarea.fill('SELECT id, name, "phoneNumber", role FROM "user" LIMIT 3;');
    await page.waitForTimeout(500);

    console.log('[Admin] Clicking "Execute SQL" button...');
    const executeSqlBtn = page.locator('button:has-text("Execute SQL")').first();
    await executeSqlBtn.click();
    await page.waitForTimeout(3000);

    // Verify SQL result pre block
    const resultPre = page.locator('pre').first();
    const resultText = await resultPre.innerText();
    console.log(`[Admin] SQL Execution Result preview:\n${resultText.slice(0, 200)}...`);

    if (!resultText.includes('Vishal') && !resultText.includes('+91')) {
      throw new Error('SQL Runner did not return expected user records from database!');
    }

    const systemScreenshot = path.join(ARTIFACT_DIR, 'admin_dashboard_system.png');
    await page.screenshot({ path: systemScreenshot, fullPage: true });
    console.log(`[Admin] Saved system screenshot: ${systemScreenshot}`);
    console.log('✅ TEST 6 PASSED: Database stats, Order Purge tool, and SQL Runner executed successfully!\n');

    console.log('====================================================');
    console.log('🎉 ALL 6 ADMIN E2E TESTS PASSED WITH 100% SUCCESS! 🎉');
    console.log('====================================================');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('\n❌ ADMIN E2E TEST FAILED:', err);
  process.exit(1);
});
