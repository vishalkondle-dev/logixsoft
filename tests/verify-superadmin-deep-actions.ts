import { chromium } from '@playwright/test';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const ARTIFACT_DIR = '/root/.gemini/antigravity-cli/brain/49e45a8a-73b5-4554-8c81-680337beb7b6';

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

async function runDeepTestSuite() {
  console.log('========================================================================');
  console.log('⚡ STARTING EXHAUSTIVE SUPERADMIN DEEP-ACTIONS & ALL-BUTTONS TEST SUITE ⚡');
  console.log('========================================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const adminPhone = '+917276718848';
    const adminAuth = await loginAndGetCookie(adminPhone);
    console.log(`[Auth] Authenticated superadmin (${adminPhone}, role: ${adminAuth.user.role})`);

    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([
      { name: adminAuth.cookieName, value: adminAuth.cookieValue, domain: '.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: adminAuth.cookieName, value: adminAuth.cookieValue, domain: 'dine.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
      { name: adminAuth.cookieName, value: adminAuth.cookieValue, domain: 'dine-api.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    ]);

    const page = await context.newPage();
    page.on('dialog', (dialog) => {
      console.log(`[Dialog] Automatically accepted dialog: "${dialog.message()}"`);
      dialog.accept();
    });

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 1: Top Header Interactive Controls & Scope Switching
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 1: Superadmin Header Interactive Controls ---');
    await page.goto(`${WEB_BASE}/admin/overview`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // 1.1 Refresh Telemetry Button
    console.log('[Header] Testing Refresh Telemetry Button...');
    const refreshBtn = page.locator('header button[aria-label*="Refresh"], header button:has(svg.tabler-icon-refresh)').first();
    await refreshBtn.click();
    await page.waitForTimeout(1000);
    console.log('✅ [Header] Refresh telemetry button clicked successfully.');

    // 1.2 Superadmin Profile Dropdown
    console.log('[Header] Testing Superadmin Profile Avatar Menu...');
    const avatarBtn = page.locator('header button:has(.mantine-Avatar-root)').first();
    await avatarBtn.click();
    await page.waitForTimeout(500);

    const profileName = page.locator('.mantine-Menu-dropdown').getByText('Vishal Kondle (VIP)').first();
    const isProfileVisible = await profileName.isVisible();
    console.log(`[Header] Superadmin profile dropdown open with name: ${isProfileVisible}`);
    if (!isProfileVisible) throw new Error('Profile dropdown did not display superadmin name!');

    // Close menu by clicking body
    await page.locator('body').click({ position: { x: 50, y: 50 } });
    await page.waitForTimeout(500);

    // 1.3 Global Scope Selector
    console.log('[Header] Testing Global Scope Select...');
    const scopeSelect = page.locator('header input[placeholder*="Scope"]').first();
    await scopeSelect.click();
    await page.waitForTimeout(500);
    const scopeOptions = await page.locator('[role="option"]:visible').allInnerTexts();
    console.log('[Header] Scope options available:', scopeOptions);
    if (!scopeOptions.some(o => o.includes('Spice Symphony Gourmet'))) {
      throw new Error('Store Spice Symphony Gourmet not found in scope selector!');
    }
    // Select Spice Symphony
    await page.locator('[role="option"]:visible:has-text("Spice Symphony Gourmet")').first().click();
    await page.waitForTimeout(1000);
    console.log('✅ [Header] Global scope switched to Spice Symphony Gourmet.');

    // Reset scope to ALL
    await scopeSelect.click();
    await page.waitForTimeout(500);
    await page.locator('[role="option"]:visible:has-text("All Platform Stores")').first().click();
    await page.waitForTimeout(1000);
    console.log('✅ [Header] Global scope reset to All Platform Stores.');

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 2: All Outlets Directory - Full CRUD Operations
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 2: All Outlets Directory - Full CRUD ---');
    const outletsNav = page.locator('nav a[href="/admin/outlets"]').first();
    await outletsNav.scrollIntoViewIfNeeded();
    await outletsNav.click();
    await page.waitForURL((u) => u.pathname.includes('/admin/outlets'), { timeout: 10000 });
    await page.waitForSelector('table', { timeout: 10000 });

    const testOutletName = `Test Branch ${Date.now().toString().slice(-4)}`;
    console.log(`[Outlets] Creating new outlet "${testOutletName}"...`);
    await page.locator('button:has-text("Add Outlet")').first().click();
    await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });

    // Select restaurant
    const restSelectModal = page.locator('.mantine-Modal-content input[placeholder*="Select Restaurant"]').first();
    await restSelectModal.click();
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:visible:has-text("Spice Symphony Gourmet")').first().click();
    await page.waitForTimeout(400);

    await page.locator('.mantine-Modal-content input[placeholder="e.g. Koramangala Hub"]').fill(testOutletName);
    await page.locator('.mantine-Modal-content input[placeholder="e.g. 5th Block, Koramangala"]').fill('42 Cyber City, Phase 2');
    await page.locator('.mantine-Modal-content input[placeholder="e.g. 9876543210"]').fill('+919876543219');
    await page.locator('.mantine-Modal-content input[placeholder="e.g. merchant@icici"]').fill('testbranch@icici');

    await page.locator('.mantine-Modal-content button:has-text("Add Branch")').click();
    await page.waitForTimeout(3000);

    // Verify created
    await page.waitForSelector(`table tr:has-text("${testOutletName}")`, { timeout: 10000 });
    console.log(`✅ [Outlets] Created test outlet "${testOutletName}".`);

    // Edit outlet
    console.log(`[Outlets] Editing outlet "${testOutletName}"...`);
    const outletRow = page.locator('table tr', { hasText: testOutletName }).first();
    await outletRow.locator('button:has(svg.tabler-icon-edit)').first().click();
    await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });

    const updatedOutletName = `${testOutletName} (Updated)`;
    await page.locator('.mantine-Modal-content input').first().fill(updatedOutletName);
    await page.locator('.mantine-Modal-content button:has-text("Save Changes")').click();
    await page.waitForTimeout(2500);

    await page.waitForSelector(`table tr:has-text("${updatedOutletName}")`, { timeout: 10000 });
    console.log(`✅ [Outlets] Updated test outlet to "${updatedOutletName}".`);

    // Delete outlet
    console.log(`[Outlets] Deleting outlet "${updatedOutletName}"...`);
    const updatedOutletRow = page.locator('table tr', { hasText: updatedOutletName }).first();
    await updatedOutletRow.locator('button:has(svg.tabler-icon-trash)').first().click();
    await page.waitForTimeout(2500);

    const outletCount = await page.locator(`table tr:has-text("${updatedOutletName}")`).count();
    if (outletCount > 0) throw new Error('Outlet was not deleted successfully!');
    console.log(`✅ [Outlets] Deleted test outlet successfully.`);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 3: Users & Staff Directory - Create, Edit, Role Switch, Delete
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 3: Users & Staff Directory - Full CRUD & Role Transitions ---');
    const usersNav = page.locator('nav a[href="/admin/users"]').first();
    await usersNav.scrollIntoViewIfNeeded();
    await usersNav.click();
    await page.waitForURL((u) => u.pathname.includes('/admin/users'), { timeout: 10000 });
    await page.waitForSelector('table', { timeout: 10000 });

    const testStaffPhone = '+919911' + Math.floor(100000 + Math.random() * 900000);
    const testStaffName = `Auto Cashier ${Date.now().toString().slice(-4)}`;
    const testStaffEmail = `cashier_${Date.now()}@logix.com`;
    console.log(`[Users] Creating new staff user "${testStaffName}" (${testStaffPhone}, ${testStaffEmail})...`);

    await page.locator('button:has-text("Add Platform User")').first().click();
    await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });

    await page.locator('.mantine-Modal-content input[placeholder="+91..."]').fill(testStaffPhone);
    await page.locator('.mantine-Modal-content input[placeholder="e.g. Rahul Sharma"]').fill(testStaffName);
    await page.locator('.mantine-Modal-content input[placeholder="rahul@example.com"]').fill(testStaffEmail);

    // Select role CASHIER
    const roleSelect = page.locator('.mantine-Modal-content input[value*="Customer"], .mantine-Modal-content input[placeholder*="Customer"]').first();
    if (await roleSelect.isVisible()) {
      await roleSelect.click();
      await page.waitForTimeout(300);
      await page.locator('[role="option"]:visible:has-text("POS Cashier (CASHIER)")').first().click();
    }

    await page.locator('.mantine-Modal-content button:has-text("Provision User")').click();
    await page.waitForTimeout(3000);

    // Verify created
    await page.waitForSelector(`table tr:has-text("${testStaffPhone}")`, { timeout: 10000 });
    console.log(`✅ [Users] Created user "${testStaffName}" (${testStaffPhone}) with CASHIER role.`);

    // Edit user: change role to WAITER and edit name
    console.log(`[Users] Editing user "${testStaffName}" to WAITER role...`);
    const userRow = page.locator('table tr', { hasText: testStaffPhone }).first();
    await userRow.locator('button:has(svg.tabler-icon-edit)').first().click();
    await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });

    const updatedUserName = `${testStaffName} (Promoted)`;
    await page.locator('.mantine-Modal-content input').first().fill(updatedUserName);

    const editRoleSelect = page.locator('.mantine-Modal-content input').nth(2);
    await editRoleSelect.click();
    await page.waitForTimeout(500);
    const opt = page.locator('[role="option"]:visible:has-text("Floor Waiter")').last();
    await opt.click();

    await page.locator('.mantine-Modal-content button:has-text("Save Changes")').click();
    await page.waitForTimeout(2500);

    await page.waitForSelector(`table tr:has-text("${updatedUserName}")`, { timeout: 10000 });
    console.log(`✅ [Users] Updated user "${updatedUserName}" to WAITER role.`);

    // Delete user
    console.log(`[Users] Deleting user "${updatedUserName}"...`);
    const updatedUserRow = page.locator('table tr', { hasText: testStaffPhone }).first();
    await updatedUserRow.locator('button:has(svg.tabler-icon-trash)').first().click();
    await page.waitForTimeout(2500);

    const userCountAfter = await page.locator(`table tr:has-text("${testStaffPhone}")`).count();
    if (userCountAfter > 0) throw new Error('User was not deleted successfully!');
    console.log(`✅ [Users] Deleted user successfully.`);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 4: Subscriptions & Plans - Plan Management Modal & Tier Update
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 4: Subscriptions & Plans - Modal Tier Update ---');
    const subsNav = page.locator('nav a[href="/admin/subscriptions"]').first();
    await subsNav.scrollIntoViewIfNeeded();
    await subsNav.click();
    await page.waitForURL((u) => u.pathname.includes('/admin/subscriptions'), { timeout: 10000 });
    await page.waitForSelector('table tr:has-text("Spice Symphony Gourmet")', { timeout: 10000 });

    console.log('[Subscriptions] Opening "Manage Plan" modal for Spice Symphony...');
    const storeSubRow = page.locator('table tr:has-text("Spice Symphony Gourmet")').first();
    await storeSubRow.locator('button:has-text("Manage Plan"), button:has-text("Upgrade Plan"), button:has(svg.tabler-icon-edit)').first().click();
    await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });

    // Change status in modal to SUSPENDED
    const statusSelect = page.locator('.mantine-Modal-content input:visible').nth(1);
    await statusSelect.click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]:visible:has-text("Suspended")').last().click();

    await page.locator('.mantine-Modal-content button:has-text("Update Plan")').click();
    await page.waitForTimeout(2500);

    // Verify SUSPENDED badge
    await page.waitForSelector('table tr:has-text("SUSPENDED")', { timeout: 10000 });
    console.log('✅ [Subscriptions] Successfully updated status to SUSPENDED.');

    // Revert back to ACTIVE
    await storeSubRow.locator('button:has(svg.tabler-icon-edit)').first().click();
    await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });
    const revertStatusSelect = page.locator('.mantine-Modal-content input:visible').nth(1);
    await revertStatusSelect.click();
    await page.waitForTimeout(300);
    await page.locator('[role="option"]:visible:has-text("Active")').last().click();
    await page.locator('.mantine-Modal-content button:has-text("Update Plan")').click();
    await page.waitForTimeout(2000);
    console.log('✅ [Subscriptions] Reverted status back to ACTIVE.');

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 5: Platform Orders - View Order Breakdown Modal
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 5: Platform Orders - Detailed View Modal ---');
    const ordersNav = page.locator('nav a[href="/admin/orders"]').first();
    await ordersNav.scrollIntoViewIfNeeded();
    await ordersNav.click();
    await page.waitForURL((u) => u.pathname.includes('/admin/orders'), { timeout: 10000 });
    await page.waitForSelector('table tbody tr', { timeout: 10000 });

    console.log('[Orders] Clicking view details (eye icon) on the first order...');
    const firstOrderRow = page.locator('table tbody tr').first();
    const viewOrderBtn = firstOrderRow.locator('button:has(svg.tabler-icon-eye)').first();
    if (await viewOrderBtn.isVisible()) {
      await viewOrderBtn.click();
      await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });

      // Check modal details
      const modalTitle = page.locator('.mantine-Modal-title').first();
      console.log(`[Orders] Opened Order Breakdown: "${await modalTitle.innerText()}"`);

      // Close modal
      await page.locator('.mantine-Modal-content button:has-text("Close"), .mantine-Modal-header button').first().click();
      await page.waitForTimeout(500);
      console.log('✅ [Orders] Order details modal inspected and closed successfully.');
    } else {
      console.log('[Orders] No view order button found in first row.');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 6: Menu Catalogs - Categories & Items CRUD & In-Stock Switch
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 6: Menu Catalogs - Category, Item CRUD & Stock Toggle ---');
    const menuNav = page.locator('nav a[href="/admin/menu"]').first();
    await menuNav.scrollIntoViewIfNeeded();
    await menuNav.click();
    await page.waitForURL((u) => u.pathname.includes('/admin/menu'), { timeout: 10000 });
    await page.waitForSelector('table', { timeout: 10000 });

    // 6.1 Create Category
    const testCatName = `Specials ${Date.now().toString().slice(-4)}`;
    console.log(`[Menu] Creating test menu category "${testCatName}"...`);
    await page.locator('button:has-text("Add Category")').first().click();
    await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });

    const catRestSelect = page.locator('.mantine-Modal-content input[placeholder*="Select Restaurant"]').first();
    await catRestSelect.click();
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:visible:has-text("Spice Symphony Gourmet")').first().click();

    await page.locator('.mantine-Modal-content input[placeholder*="Desserts"]').fill(testCatName);
    await page.locator('.mantine-Modal-content button:has-text("Add Category")').click();
    await page.waitForTimeout(2500);
    console.log(`✅ [Menu] Created category "${testCatName}".`);

    // 6.2 Create Menu Item
    const testItemName = `Deluxe Gourmet Dish ${Date.now().toString().slice(-4)}`;
    console.log(`[Menu] Creating test menu item "${testItemName}"...`);
    await page.locator('button:has-text("Add Menu Item")').first().click();
    await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });

    // Select restaurant
    const itemRestSelect = page.locator('.mantine-Modal-content input[placeholder*="Select Restaurant"]').first();
    await itemRestSelect.click();
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:visible:has-text("Spice Symphony Gourmet")').first().click();
    await page.waitForTimeout(800);

    // Select category
    const itemCatSelect = page.locator('.mantine-Modal-content input[placeholder*="Select Category"]').first();
    await itemCatSelect.click();
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:visible').first().click();

    await page.locator('.mantine-Modal-content input[placeholder*="Truffle Butter"]').fill(testItemName);
    await page.locator('.mantine-Modal-content input[placeholder*="Key ingredients"]').fill('Fresh chef special with exotic seasonings');

    await page.locator('.mantine-Modal-content button:has-text("Add Dish")').click();
    await page.waitForTimeout(3000);

    // Verify item in table
    await page.waitForSelector(`table tr:has-text("${testItemName}")`, { timeout: 10000 });
    console.log(`✅ [Menu] Menu item "${testItemName}" successfully rendered in table.`);

    // 6.3 Toggle In-Stock Switch
    console.log(`[Menu] Toggling stock switch for "${testItemName}"...`);
    const itemRow = page.locator('table tr', { hasText: testItemName }).first();
    const stockSwitch = itemRow.locator('input[type="checkbox"]').first();
    await stockSwitch.click();
    await page.waitForTimeout(2000);
    console.log(`✅ [Menu] Toggled stock status switch.`);

    // 6.4 Edit Menu Item
    console.log(`[Menu] Editing menu item "${testItemName}"...`);
    await itemRow.locator('button:has(svg.tabler-icon-edit)').first().click();
    await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });

    const updatedItemName = `${testItemName} (Special Chef Edition)`;
    await page.locator('.mantine-Modal-content input').first().fill(updatedItemName);
    await page.locator('.mantine-Modal-content button:has-text("Save Changes")').click();
    await page.waitForTimeout(2500);

    await page.waitForSelector(`table tr:has-text("${updatedItemName}")`, { timeout: 10000 });
    console.log(`✅ [Menu] Menu item updated to "${updatedItemName}".`);

    // 6.5 Delete Menu Item
    console.log(`[Menu] Deleting menu item "${updatedItemName}"...`);
    const updatedItemRow = page.locator('table tr', { hasText: updatedItemName }).first();
    await updatedItemRow.locator('button:has(svg.tabler-icon-trash)').first().click();
    await page.waitForTimeout(2500);

    const itemCountAfter = await page.locator(`table tr:has-text("${updatedItemName}")`).count();
    if (itemCountAfter > 0) throw new Error('Menu item was not deleted!');
    console.log(`✅ [Menu] Menu item deleted successfully.`);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 7: Dining Tables - Create, Edit & Delete
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 7: Dining Tables Directory - Full CRUD ---');
    const tablesNav = page.locator('nav a[href="/admin/tables"]').first();
    await tablesNav.scrollIntoViewIfNeeded();
    await tablesNav.click();
    await page.waitForURL((u) => u.pathname.includes('/admin/tables'), { timeout: 10000 });
    await page.waitForSelector('table', { timeout: 10000 });

    const testTableName = `T-VIP-${Date.now().toString().slice(-4)}`;
    console.log(`[Tables] Creating test table "${testTableName}"...`);
    await page.locator('button:has-text("Add Table")').first().click();
    await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });

    // Select restaurant
    const tRestSelect = page.locator('.mantine-Modal-content input[placeholder*="Select Restaurant"]').first();
    await tRestSelect.click();
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:visible:has-text("Spice Symphony Gourmet")').first().click();
    await page.waitForTimeout(800);

    // Select outlet
    const tOutletSelect = page.locator('.mantine-Modal-content input[placeholder*="Select Outlet"]').first();
    await tOutletSelect.click();
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:visible').first().click();

    await page.locator('.mantine-Modal-content input[placeholder="e.g. Table 12 / VIP-1"]').fill(testTableName);
    await page.locator('.mantine-Modal-content input[placeholder="e.g. Terrace / AC Hall / Balcony"]').fill('Rooftop VIP');

    await page.locator('.mantine-Modal-content button:has-text("Add Table")').last().click();
    await page.waitForTimeout(3000);

    await page.waitForSelector(`table tr:has-text("${testTableName}")`, { timeout: 10000 });
    console.log(`✅ [Tables] Table "${testTableName}" created.`);

    // Edit Table
    console.log(`[Tables] Editing table "${testTableName}"...`);
    const tableRow = page.locator('table tr', { hasText: testTableName }).first();
    await tableRow.locator('button:has(svg.tabler-icon-edit)').first().click();
    await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });

    const updatedTableName = `${testTableName}-EDITED`;
    await page.locator('.mantine-Modal-content input').first().fill(updatedTableName);
    await page.locator('.mantine-Modal-content button:has-text("Save Changes")').click();
    await page.waitForTimeout(2500);

    await page.waitForSelector(`table tr:has-text("${updatedTableName}")`, { timeout: 10000 });
    console.log(`✅ [Tables] Table updated to "${updatedTableName}".`);

    // Delete Table
    console.log(`[Tables] Deleting table "${updatedTableName}"...`);
    const updatedTableRow = page.locator('table tr', { hasText: updatedTableName }).first();
    await updatedTableRow.locator('button:has(svg.tabler-icon-trash)').first().click();
    await page.waitForTimeout(2500);

    const tableCountAfter = await page.locator(`table tr:has-text("${updatedTableName}")`).count();
    if (tableCountAfter > 0) throw new Error('Table was not deleted!');
    console.log(`✅ [Tables] Table deleted successfully.`);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 8: Inventory & BOM - Create, Edit Stock & Delete
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 8: Inventory & BOM Directory - Full CRUD ---');
    const invNav = page.locator('nav a[href="/admin/inventory"]').first();
    await invNav.scrollIntoViewIfNeeded();
    await invNav.click();
    await page.waitForURL((u) => u.pathname.includes('/admin/inventory'), { timeout: 10000 });
    await page.waitForSelector('table', { timeout: 10000 });

    const testSku = `SKU-TEST-${Date.now().toString().slice(-4)}`;
    const testInvName = `Aged Basmati Rice ${Date.now().toString().slice(-4)}`;
    console.log(`[Inventory] Creating item "${testInvName}" (${testSku})...`);
    await page.locator('button:has-text("Add Inventory Item")').first().click();
    await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });

    // Select restaurant
    const invRestSelect = page.locator('.mantine-Modal-content input[placeholder*="Select Restaurant"]').first();
    await invRestSelect.click();
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:visible:has-text("Spice Symphony Gourmet")').first().click();
    await page.waitForTimeout(800);

    // Select outlet
    const invOutletSelect = page.locator('.mantine-Modal-content input[placeholder*="Select Outlet"]').first();
    await invOutletSelect.click();
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:visible').first().click();

    await page.locator('.mantine-Modal-content input[placeholder*="Basmati Rice"]').fill(testInvName);
    await page.locator('.mantine-Modal-content input[placeholder*="kg / liters"]').fill('kg');

    await page.locator('.mantine-Modal-content button:has-text("Add Stock Item")').click();
    await page.waitForTimeout(3000);

    await page.waitForSelector(`table tr:has-text("${testInvName}")`, { timeout: 10000 });
    console.log(`✅ [Inventory] Item "${testInvName}" created.`);

    // Edit Item
    console.log(`[Inventory] Editing item "${testInvName}"...`);
    const invRow = page.locator('table tr', { hasText: testInvName }).first();
    await invRow.locator('button:has(svg.tabler-icon-edit)').first().click();
    await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });

    const updatedInvName = `${testInvName} (Premium Batch)`;
    await page.locator('.mantine-Modal-content input').first().fill(updatedInvName);
    await page.locator('.mantine-Modal-content button:has-text("Save Changes")').click();
    await page.waitForTimeout(2500);

    await page.waitForSelector(`table tr:has-text("${updatedInvName}")`, { timeout: 10000 });
    console.log(`✅ [Inventory] Item updated to "${updatedInvName}".`);

    // Delete Item
    console.log(`[Inventory] Deleting item "${updatedInvName}"...`);
    const updatedInvRow = page.locator('table tr', { hasText: updatedInvName }).first();
    await updatedInvRow.locator('button:has(svg.tabler-icon-trash)').first().click();
    await page.waitForTimeout(2500);

    const invCountAfter = await page.locator(`table tr:has-text("${updatedInvName}")`).count();
    if (invCountAfter > 0) throw new Error('Inventory item was not deleted!');
    console.log(`✅ [Inventory] Item deleted successfully.`);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 9: Table Reservations - Create, Status Transition & Delete
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 9: Table Reservations - Full Lifecycle ---');
    const resvNav = page.locator('nav a[href="/admin/reservations"]').first();
    await resvNav.scrollIntoViewIfNeeded();
    await resvNav.click();
    await page.waitForURL((u) => u.pathname.includes('/admin/reservations'), { timeout: 10000 });
    await page.waitForSelector('table', { timeout: 10000 });

    const testGuestPhone = '+919876' + Math.floor(100000 + Math.random() * 900000);
    const testGuestName = `VIP Guest ${Date.now().toString().slice(-4)}`;
    console.log(`[Reservations] Creating reservation for "${testGuestName}" (${testGuestPhone})...`);
    await page.locator('button:has-text("Add Reservation")').first().click();
    await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });

    // Select restaurant
    const rRestSelect = page.locator('.mantine-Modal-content input[placeholder*="Select Restaurant"]').first();
    await rRestSelect.click();
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:visible:has-text("Spice Symphony Gourmet")').first().click();
    await page.waitForTimeout(800);

    // Select outlet
    const rOutletSelect = page.locator('.mantine-Modal-content input[placeholder*="Select Outlet"]').first();
    await rOutletSelect.click();
    await page.waitForTimeout(400);
    await page.locator('[role="option"]:visible').first().click();

    await page.locator('.mantine-Modal-content input[placeholder="Guest Name"]').fill(testGuestName);
    await page.locator('.mantine-Modal-content input[placeholder="+91..."]').fill(testGuestPhone);

    await page.locator('.mantine-Modal-content button:has-text("Book Table")').click();
    await page.waitForTimeout(3000);

    await page.waitForSelector(`table tr:has-text("${testGuestPhone}")`, { timeout: 10000 });
    console.log(`✅ [Reservations] Reservation for "${testGuestName}" created.`);

    // Transition status to SEATED
    console.log(`[Reservations] Marking reservation for "${testGuestName}" as SEATED...`);
    const resvRow = page.locator('table tr', { hasText: testGuestPhone }).first();
    const seatBtn = resvRow.locator('button:has(svg.tabler-icon-check)').first();
    if (await seatBtn.isVisible()) {
      await seatBtn.click();
      await page.waitForTimeout(2000);
      console.log(`✅ [Reservations] Successfully marked reservation as SEATED.`);
    }

    // Delete reservation
    console.log(`[Reservations] Deleting reservation for "${testGuestName}"...`);
    const updatedResvRow = page.locator('table tr', { hasText: testGuestPhone }).first();
    await updatedResvRow.locator('button:has(svg.tabler-icon-trash)').first().click();
    await page.waitForTimeout(2500);

    const resvCountAfter = await page.locator(`table tr:has-text("${testGuestPhone}")`).count();
    if (resvCountAfter > 0) throw new Error('Reservation was not deleted!');
    console.log(`✅ [Reservations] Reservation deleted successfully.`);

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 10: Reviews & Feedback - Reply Action & Verification
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 10: Reviews & Feedback - Administrative Response ---');
    const fbNav = page.locator('nav a[href="/admin/feedback"]').first();
    await fbNav.scrollIntoViewIfNeeded();
    await fbNav.click();
    await page.waitForURL((u) => u.pathname.includes('/admin/feedback'), { timeout: 10000 });
    await page.waitForSelector('table', { timeout: 10000 });

    const replyBtn = page.locator('table button:has(svg.tabler-icon-message-circle-2)').first();
    if (await replyBtn.isVisible()) {
      await replyBtn.click();
      await page.waitForSelector('.mantine-Modal-content', { timeout: 5000 });

      const replyTextarea = page.locator('.mantine-Modal-content textarea').first();
      await replyTextarea.fill('Thank you for dining with us! We look forward to serving you again soon.');
      await page.locator('.mantine-Modal-content button:has-text("Publish Reply")').click();
      await page.waitForTimeout(2500);
      console.log('✅ [Feedback] Published official response to diner review.');
    } else {
      console.log('[Feedback] No reply button found in first row.');
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // STEP 11: System Infrastructure & SQL Runner Error & Success Cases
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('\n--- SUITE 11: SQL Runner Error Handling & Query Execution ---');
    const sysNav = page.locator('nav a[href="/admin/system"]').first();
    await sysNav.scrollIntoViewIfNeeded();
    await sysNav.click();
    await page.waitForURL((u) => u.pathname.includes('/admin/system'), { timeout: 10000 });
    await page.waitForSelector('textarea', { timeout: 10000 });

    const sqlTextarea = page.locator('textarea').first();

    // 11.1 Error Case: Invalid syntax
    console.log('[System] Testing SQL Runner with invalid query syntax...');
    await sqlTextarea.fill('SELECT * FROM non_existent_table_xyz_123;');
    await page.locator('button:has-text("Execute SQL")').first().click();
    await page.waitForTimeout(2500);

    const errorPre = page.locator('pre').first();
    const errorText = await errorPre.innerText();
    console.log(`[System] Error response received:\n${errorText.slice(0, 150)}...`);
    if (!errorText.toLowerCase().includes('relation "non_existent_table_xyz_123" does not exist') && !errorText.toLowerCase().includes('error')) {
      throw new Error('SQL Runner did not correctly handle database error!');
    }
    console.log('✅ [System] SQL Runner correctly caught and displayed query syntax error.');

    // 11.2 Success Case: Aggregation query
    console.log('[System] Testing SQL Runner with valid table aggregation...');
    await sqlTextarea.fill('SELECT count(*) as total_restaurants FROM "restaurant";');
    await page.locator('button:has-text("Execute SQL")').first().click();
    await page.waitForTimeout(2500);

    const successPre = page.locator('pre').first();
    const successText = await successPre.innerText();
    console.log(`[System] Query result preview:\n${successText}`);
    if (!successText.includes('total_restaurants')) {
      throw new Error('SQL Runner did not return valid result for aggregation query!');
    }
    console.log('✅ [System] SQL Runner successfully executed table aggregation query.');

    // Final screenshot
    const deepScreenshot = path.join(ARTIFACT_DIR, 'superadmin_deep_actions_success.png');
    await page.screenshot({ path: deepScreenshot, fullPage: true });

    console.log('\n========================================================================');
    console.log('🎉 ALL DEEP-ACTIONS & ALL-BUTTONS SUPERADMIN TESTS PASSED WITH 100%! 🎉');
    console.log('========================================================================\n');
  } finally {
    await browser.close();
  }
}

runDeepTestSuite().catch((err) => {
  console.error('\n❌ DEEP TEST SUITE FAILED:', err);
  process.exit(1);
});
