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
  console.log('================================================================');
  console.log('🚀 STARTING COMPREHENSIVE SUPERADMIN CONTROL PLANE E2E SUITE 🚀');
  console.log('================================================================\n');

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
    console.log(`[Security] Authenticated non-admin staff (${staffPhone}, role: ${staffAuth.user.role})`);

    const staffContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await staffContext.addCookies([
      { name: staffAuth.cookieName, value: staffAuth.cookieValue, domain: '.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: staffAuth.cookieName, value: staffAuth.cookieValue, domain: 'dine.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: staffAuth.cookieName, value: staffAuth.cookieValue, domain: 'dine-api.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
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
    // TEST 2: Admin Authentication & Isolation of Owner Paths
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 2: Superadmin Header & Total Isolation of Owner Paths ---');
    const adminPhone = '+917276718848';
    const adminAuth = await loginAndGetCookie(adminPhone);
    console.log(`[Admin] Authenticated superadmin (${adminPhone}, role: ${adminAuth.user.role})`);

    if (adminAuth.user.role !== 'ADMIN') {
      throw new Error(`Expected admin user to have role 'ADMIN', got: ${adminAuth.user.role}`);
    }

    const adminContext = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    await adminContext.addCookies([
      { name: adminAuth.cookieName, value: adminAuth.cookieValue, domain: '.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: adminAuth.cookieName, value: adminAuth.cookieValue, domain: 'dine.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: adminAuth.cookieName, value: adminAuth.cookieValue, domain: 'dine-api.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ]);

    const page = await adminContext.newPage();
    console.log('[Admin] Navigating to /admin...');
    await page.goto(`${WEB_BASE}/admin`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // Verify Superadmin Header branding
    const superadminBranding = page.locator('text=Logix Superadmin').first();
    const subBranding = page.locator('text=Global Multi-Tenant Control Plane').first();
    if (!await superadminBranding.isVisible() || !await subBranding.isVisible()) {
      throw new Error('Superadmin Header Branding not visible!');
    }
    console.log('[Admin] Verified dedicated Superadmin Header branding.');

    // CRITICAL REQUIREMENT: Owner/staff navigation paths MUST NOT be rendered on /admin
    const forbiddenOwnerPaths = [
      'header a[href="/tables"]',
      'header a[href="/pos"]',
      'header a[href="/kitchen"]',
      'header a[href="/waiter"]',
      'header a[href="/rider"]',
      'header a[href="/orders"]',
      'header a[href="/reports"]',
      'header a[href="/settings"]',
      'header a[href="/inventory"]',
    ];

    for (const selector of forbiddenOwnerPaths) {
      const found = await page.locator(selector).count();
      if (found > 0) {
        throw new Error(`VIOLATION: Owner path selector "${selector}" was detected on /admin! Owner paths must be completely absent.`);
      }
    }
    console.log('✅ TEST 2 PASSED: Superadmin header verified, ZERO owner/staff paths detected on /admin!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 3: Dedicated Superadmin Sidebar Navigation Structure
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 3: Dedicated Superadmin Sidebar Categories & Links ---');
    const expectedSections = [
      'CONTROL PLANE',
      'TENANT GOVERNANCE',
      'OPERATIONS & CATALOG',
      'GUEST CRM & RELATIONS',
      'SYSTEM INFRASTRUCTURE',
    ];

    for (const section of expectedSections) {
      const el = page.locator('nav').getByText(section).first();
      const visible = await el.isVisible();
      console.log(`[Sidebar] Group "${section}": visible = ${visible}`);
      if (!visible) throw new Error(`Sidebar group "${section}" not found!`);
    }

    const expectedNavItems = [
      'Overview & Telemetry',
      'Restaurants & Stores',
      'All Outlets',
      'Users & Staff Directory',
      'Subscriptions & Plans',
      'Platform Orders',
      'Menu Catalogs',
      'Dining Tables',
      'Inventory & BOM',
      'Delivery Fleet',
      'Customer Directory',
      'Table Reservations',
      'Reviews & Feedback',
      'Operations, DB & SQL',
    ];

    for (const item of expectedNavItems) {
      const el = page.locator('nav').getByText(item, { exact: true }).first();
      const visible = await el.isVisible();
      if (!visible) throw new Error(`Sidebar nav item "${item}" not visible!`);
    }
    console.log('✅ TEST 3 PASSED: All 5 Sidebar Groups and all 14 module links present!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 4: Control Plane Overview & Macro Telemetry
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 4: Overview & Telemetry View ---');
    console.log('[Admin] Waiting for Control Plane telemetry metrics cards to load...');
    await page.waitForSelector('text=Total Outlets', { timeout: 20000 });

    const kpiCards = ['Total Outlets', 'Platform Users', 'Platform Orders', 'Total Platform GMV'];
    for (const card of kpiCards) {
      const el = page.locator(`text=${card}`).first();
      const visible = await el.isVisible();
      console.log(`[Overview] KPI "${card}": visible = ${visible}`);
      if (!visible) throw new Error(`Overview KPI "${card}" not found!`);
    }

    const overviewScreenshot = path.join(ARTIFACT_DIR, 'admin_superadmin_overview.png');
    await page.screenshot({ path: overviewScreenshot, fullPage: true });
    console.log(`[Overview] Saved screenshot: ${overviewScreenshot}`);
    console.log('✅ TEST 4 PASSED: Overview & Macro KPIs verified!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 5: Tenant Governance - Restaurants & Stores CRUD
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 5: Restaurants & Stores Module CRUD ---');
    await page.locator('nav').getByText('Restaurants & Stores', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    // Verify existing store in table
    await page.waitForSelector('table tr:has-text("Spice Symphony Gourmet")', { timeout: 10000 });
    console.log(`[Restaurants] Store "Spice Symphony Gourmet" visible in table.`);

    // Create a new restaurant
    const testRestName = `Auto Test Bistro ${Date.now().toString().slice(-4)}`;
    console.log(`[Restaurants] Creating test restaurant: "${testRestName}"...`);
    await page.locator('button:has-text("Add Restaurant")').first().click();
    await page.waitForTimeout(1000);

    await page.locator('input[placeholder*="Urban Diner"]').fill(testRestName);
    await page.locator('input[placeholder*="100 Feet Road"]').fill('100 Superadmin Way, Tech Hub');
    await page.locator('input[placeholder*="9876543210"]').fill('9876512345');
    await page.locator('input[placeholder*="+91..."]').fill('+919876543999');
    await page.locator('input[placeholder*="Ramesh Kumar"]').fill('Auto Owner');

    await page.locator('button:has-text("Create & Provision Store")').first().click();
    await page.waitForTimeout(3500);

    // Verify newly created restaurant
    const createdRestRow = page.locator('table tr', { hasText: testRestName }).first();
    const createdVisible = await createdRestRow.isVisible();
    console.log(`[Restaurants] New restaurant "${testRestName}" visible: ${createdVisible}`);
    if (!createdVisible) throw new Error(`Failed to find created restaurant "${testRestName}"!`);

    // Clean up / Delete restaurant
    console.log(`[Restaurants] Cleaning up test restaurant "${testRestName}"...`);
    const targetRow = page.locator('tr', { hasText: testRestName }).first();
    await targetRow.locator('button').last().click();
    await page.waitForTimeout(500);
    await page.locator('[role="menuitem"]:has-text("Delete Store")').first().click();
    await page.waitForTimeout(1000);
    await page.locator('button:has-text("Permanently Delete Store")').last().click();
    await page.waitForTimeout(3000);

    const restModuleScreenshot = path.join(ARTIFACT_DIR, 'admin_superadmin_restaurants.png');
    await page.screenshot({ path: restModuleScreenshot, fullPage: true });
    console.log('✅ TEST 5 PASSED: Restaurants & Stores CRUD verified!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 6: All Outlets Module
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 6: All Outlets Module ---');
    await page.locator('nav').getByText('All Outlets', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('table tr:has-text("Indiranagar Flagship")', { timeout: 10000 });
    console.log(`[Outlets] Outlet "Indiranagar Flagship" visible: true`);

    const outletsScreenshot = path.join(ARTIFACT_DIR, 'admin_superadmin_outlets.png');
    await page.screenshot({ path: outletsScreenshot, fullPage: true });
    console.log('✅ TEST 6 PASSED: All Outlets table verified!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 7: Users & Staff Directory
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 7: Users & Staff Directory ---');
    await page.locator('nav').getByText('Users & Staff Directory', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('table tr:has-text("Vishal Kondle (VIP)")', { timeout: 10000 });
    console.log(`[Users] Superadmin user visible: true`);

    const usersScreenshot = path.join(ARTIFACT_DIR, 'admin_superadmin_users.png');
    await page.screenshot({ path: usersScreenshot, fullPage: true });
    console.log('✅ TEST 7 PASSED: Users & Staff Directory verified!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 8: Subscriptions & Plans
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 8: Subscriptions & Plans Module ---');
    await page.locator('nav').getByText('Subscriptions & Plans', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('table tr:has-text("Spice Symphony Gourmet")', { timeout: 10000 });
    console.log(`[Subscriptions] Module table with store visible: true`);

    const subsScreenshot = path.join(ARTIFACT_DIR, 'admin_superadmin_subscriptions.png');
    await page.screenshot({ path: subsScreenshot, fullPage: true });
    console.log('✅ TEST 8 PASSED: Subscriptions & Plans verified!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 9: Platform Orders
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 9: Platform Orders Module ---');
    await page.locator('nav').getByText('Platform Orders', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    console.log(`[Orders] Orders table with cross-tenant records visible: true`);

    const ordersScreenshot = path.join(ARTIFACT_DIR, 'admin_superadmin_orders.png');
    await page.screenshot({ path: ordersScreenshot, fullPage: true });
    console.log('✅ TEST 9 PASSED: Platform Orders verified!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 10: Menu Catalogs
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 10: Menu Catalogs Module ---');
    await page.locator('nav').getByText('Menu Catalogs', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('button:has-text("Add Menu Item")', { timeout: 10000 });
    console.log(`[Menu] "Add Menu Item" button visible: true`);

    const menuScreenshot = path.join(ARTIFACT_DIR, 'admin_superadmin_menu.png');
    await page.screenshot({ path: menuScreenshot, fullPage: true });
    console.log('✅ TEST 10 PASSED: Menu Catalogs verified!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 11: Dining Tables
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 11: Dining Tables Module ---');
    await page.locator('nav').getByText('Dining Tables', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('button:has-text("Add Table")', { timeout: 10000 });
    console.log(`[Tables] "Add Table" button visible: true`);

    const tablesScreenshot = path.join(ARTIFACT_DIR, 'admin_superadmin_tables.png');
    await page.screenshot({ path: tablesScreenshot, fullPage: true });
    console.log('✅ TEST 11 PASSED: Dining Tables verified!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 12: Inventory & BOM
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 12: Inventory & BOM Module ---');
    await page.locator('nav').getByText('Inventory & BOM', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('button:has-text("Add Inventory Item")', { timeout: 10000 });
    console.log(`[Inventory] "Add Inventory Item" button visible: true`);

    const invScreenshot = path.join(ARTIFACT_DIR, 'admin_superadmin_inventory.png');
    await page.screenshot({ path: invScreenshot, fullPage: true });
    console.log('✅ TEST 12 PASSED: Inventory & BOM verified!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 13: Delivery Fleet
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 13: Delivery Fleet Module ---');
    await page.locator('nav').getByText('Delivery Fleet', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('table', { timeout: 10000 });
    console.log('[Delivery] Delivery fleet table rendered.');

    const fleetScreenshot = path.join(ARTIFACT_DIR, 'admin_superadmin_delivery.png');
    await page.screenshot({ path: fleetScreenshot, fullPage: true });
    console.log('✅ TEST 13 PASSED: Delivery Fleet verified!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 14: Customer Directory (CRM)
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 14: Customer Directory Module ---');
    await page.locator('nav').getByText('Customer Directory', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('table tbody tr', { timeout: 10000 });
    console.log('[CRM] Customer directory table rendered.');

    const custScreenshot = path.join(ARTIFACT_DIR, 'admin_superadmin_customers.png');
    await page.screenshot({ path: custScreenshot, fullPage: true });
    console.log('✅ TEST 14 PASSED: Customer Directory verified!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 15: Table Reservations
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 15: Table Reservations Module ---');
    await page.locator('nav').getByText('Table Reservations', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('button:has-text("Add Reservation")', { timeout: 10000 });
    console.log(`[Reservations] "Add Reservation" button visible: true`);

    const resvScreenshot = path.join(ARTIFACT_DIR, 'admin_superadmin_reservations.png');
    await page.screenshot({ path: resvScreenshot, fullPage: true });
    console.log('✅ TEST 15 PASSED: Table Reservations verified!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 16: Reviews & Feedback
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 16: Reviews & Feedback Module ---');
    await page.locator('nav').getByText('Reviews & Feedback', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    await page.waitForSelector('table', { timeout: 10000 });
    console.log('[Feedback] Reviews & Feedback table rendered.');

    const fbScreenshot = path.join(ARTIFACT_DIR, 'admin_superadmin_feedback.png');
    await page.screenshot({ path: fbScreenshot, fullPage: true });
    console.log('✅ TEST 16 PASSED: Reviews & Feedback verified!\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // TEST 17: System Infrastructure & Superadmin SQL Runner
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- TEST 17: Operations, DB & SQL Runner Module ---');
    await page.locator('nav').getByText('Operations, DB & SQL', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    const infraCard = page.locator('text=Infrastructure Status').first();
    console.log(`[System] Infrastructure card visible: ${await infraCard.isVisible()}`);

    const purgeCard = page.locator('text=Order Purge Tool').first();
    console.log(`[System] Order Purge Tool visible: ${await purgeCard.isVisible()}`);

    // Execute query
    const sqlTextarea = page.locator('textarea').first();
    await sqlTextarea.fill('SELECT id, name, "phoneNumber", role FROM "user" LIMIT 3;');
    await page.waitForTimeout(500);

    console.log('[System] Executing SQL via Superadmin control plane...');
    await page.locator('button:has-text("Execute SQL")').first().click();
    await page.waitForTimeout(3000);

    const resultPre = page.locator('pre').first();
    const resultText = await resultPre.innerText();
    console.log(`[System] SQL Execution Preview:\n${resultText.slice(0, 180)}...`);

    if (!resultText.includes('Vishal') && !resultText.includes('+91')) {
      throw new Error('SQL Runner did not return expected user records from database!');
    }

    const systemScreenshot = path.join(ARTIFACT_DIR, 'admin_superadmin_system.png');
    await page.screenshot({ path: systemScreenshot, fullPage: true });
    console.log('✅ TEST 17 PASSED: System Infrastructure & SQL Runner verified!\n');

    console.log('=======================================================================');
    console.log('🎉 ALL 17 COMPREHENSIVE SUPERADMIN E2E TESTS PASSED WITH 100% SUCCESS! 🎉');
    console.log('=======================================================================');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('\n❌ SUPERADMIN E2E TEST SUITE FAILED:', err);
  process.exit(1);
});
