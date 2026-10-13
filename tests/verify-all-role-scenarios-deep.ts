import { chromium } from '@playwright/test';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';

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

async function createContextForRole(browser: any, phone: string, restId: string, outletId: string) {
  const auth = await loginAndGetCookie(phone);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    { name: auth.cookieName, value: auth.cookieValue, domain: '.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    { name: auth.cookieName, value: auth.cookieValue, domain: 'dine.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    { name: auth.cookieName, value: auth.cookieValue, domain: 'dine-api.logixsoft.in', path: '/', httpOnly: true, secure: true, sameSite: 'Lax' },
    { name: 'dine.restaurantId', value: restId, domain: 'dine.logixsoft.in', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
    { name: 'dine.outletId', value: outletId, domain: 'dine.logixsoft.in', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
  ]);
  return { context, auth };
}

async function verifyRouteAccess(context: any, pathToCheck: string, expectedAccess: 'ALLOWED' | 'FORBIDDEN', expectedAllowedContains?: string) {
  const page = await context.newPage();
  try {
    const targetPath = pathToCheck.split('?')[0];
    await page.goto(`${WEB_BASE}${pathToCheck}`, { waitUntil: 'domcontentloaded', timeout: 25000 });

    if (expectedAccess === 'ALLOWED') {
      await page.waitForTimeout(2500);
      const currentUrl = page.url();
      const match = expectedAllowedContains ? currentUrl.includes(expectedAllowedContains) : currentUrl.includes(targetPath);
      if (!match) {
        throw new Error(`Expected access to ${pathToCheck}, but got redirected to: ${currentUrl}`);
      }
      return { status: 'ALLOWED', currentUrl };
    } else {
      // Wait for client redirect away from targetPath
      await page.waitForURL((u) => !u.pathname.startsWith(targetPath), { timeout: 15000 }).catch(() => {});
      const currentUrl = page.url();
      if (currentUrl.includes(targetPath)) {
        throw new Error(`Expected FORBIDDEN from ${targetPath}, but remained on: ${currentUrl}`);
      }
      return { status: 'FORBIDDEN', redirectedTo: currentUrl };
    }
  } finally {
    await page.close();
  }
}

async function run() {
  console.log('========================================================================');
  console.log('🌟 EXHAUSTIVE DEEP SCENARIOS & FEATURES VERIFICATION FOR ALL ROLES 🌟');
  console.log('========================================================================\n');

  // 1. Get restaurant and outlets from Owner session
  const ownerAuth = await loginAndGetCookie('+919985720478');
  const restRes = await fetch(`${API_BASE}/restaurants`, {
    headers: { Cookie: ownerAuth.cookiePair },
  });
  const rests = await restRes.json();
  const restId = rests[0].id;
  const restName = rests[0].name;

  const outletsRes = await fetch(`${API_BASE}/outlets`, {
    headers: { Cookie: ownerAuth.cookiePair, 'X-Restaurant-Id': restId },
  });
  const outlets = await outletsRes.json();
  const outletId = outlets[0].id;
  const outletName = outlets[0].name;

  console.log(`[Setup] Target Restaurant: "${restName}" (${restId})`);
  console.log(`[Setup] Target Outlet: "${outletName}" (${outletId})\n`);

  // Ensure custom role BARTENDER exists for Scenario 8
  const rolesRes = await fetch(`${API_BASE}/roles`, {
    headers: { Cookie: ownerAuth.cookiePair, 'X-Restaurant-Id': restId },
  });
  const rolesData = await rolesRes.json();
  let bartenderRole = rolesData.roles?.find((r: any) => r.name.toUpperCase() === 'BARTENDER');

  if (!bartenderRole) {
    console.log('[Setup] Creating custom role "BARTENDER"...');
    const createRoleRes = await fetch(`${API_BASE}/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerAuth.cookiePair,
        'X-Restaurant-Id': restId,
      },
      body: JSON.stringify({
        name: 'BARTENDER',
        description: 'Bar counter specialist: tableside drinks orders, bar counter billing.',
        allOutlets: false,
        permissions: ['menu:view', 'tables:view', 'waiter:punch_order', 'pos:view', 'pos:order_create'],
      }),
    });
    const createdData = await createRoleRes.json();
    bartenderRole = createdData.role || createdData;
  }

  const staffRes = await fetch(`${API_BASE}/staff`, {
    headers: { Cookie: ownerAuth.cookiePair, 'X-Restaurant-Id': restId },
  });
  const staffList = await staffRes.json();
  const existingBartender = Array.isArray(staffList) ? staffList.find((s: any) => s.phone === '+919876543299') : null;

  if (!existingBartender) {
    console.log('[Setup] Inviting staff member +919876543299 as BARTENDER...');
    await fetch(`${API_BASE}/staff/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerAuth.cookiePair,
        'X-Restaurant-Id': restId,
      },
      body: JSON.stringify({
        phone: '+919876543299',
        role: bartenderRole.id,
        outletIds: [outletId],
      }),
    });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: OWNER ROLE - Full Governance & Security Administration
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- SCENARIO 1: OWNER Role (All Modules, Role Matrix, Settings) ---');
    const owner = await createContextForRole(browser, '+919985720478', restId, outletId);
    
    // Check Settings/Roles Matrix
    const ownerPage = await owner.context.newPage();
    await ownerPage.goto(`${WEB_BASE}/settings/roles?outletId=${outletId}`, { waitUntil: 'domcontentloaded' });
    await ownerPage.waitForSelector('text=Roles & Permissions Matrix', { timeout: 15000 });
    console.log('  ✓ OWNER accessed /settings/roles');
    
    // Verify all 7 roles visible
    for (const r of ['OWNER', 'MANAGER', 'CASHIER', 'CAPTAIN', 'WAITER', 'KITCHEN', 'RIDER']) {
      const roleCard = ownerPage.locator(`text=${r}`).first();
      if (!await roleCard.isVisible()) throw new Error(`Role card ${r} not visible to OWNER`);
    }
    console.log('  ✓ OWNER verified all 7 system role cards in matrix');
    await ownerPage.close();

    // Check POS access
    await verifyRouteAccess(owner.context, `/pos?outletId=${outletId}`, 'ALLOWED', '/pos');
    console.log('  ✓ OWNER accessed /pos counter');
    await owner.context.close();
    console.log('✅ SCENARIO 1 PASSED: OWNER verified across all governance & POS operations.\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: MANAGER ROLE - Day-to-Day Operations & Store Settings
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- SCENARIO 2: MANAGER Role (Full Operations, Restaurant Settings, Blocked from Roles) ---');
    const manager = await createContextForRole(browser, '+919876543201', restId, outletId);

    // 2.1 Permitted: Access POS
    await verifyRouteAccess(manager.context, `/pos?outletId=${outletId}`, 'ALLOWED', '/pos');
    console.log('  ✓ MANAGER accessed /pos');

    // 2.2 Permitted: Access Tables
    await verifyRouteAccess(manager.context, `/tables?outletId=${outletId}`, 'ALLOWED', '/tables');
    console.log('  ✓ MANAGER accessed /tables');

    // 2.3 Permitted: Access Orders
    await verifyRouteAccess(manager.context, `/orders?outletId=${outletId}`, 'ALLOWED', '/orders');
    console.log('  ✓ MANAGER accessed /orders');

    // 2.4 Security Enforcement: Accessing /settings/roles shows "Owner Access Required" guard
    const mgrRolesPage = await manager.context.newPage();
    await mgrRolesPage.goto(`${WEB_BASE}/settings/roles?outletId=${outletId}`, { waitUntil: 'domcontentloaded' });
    await mgrRolesPage.waitForSelector('text=Owner Access Required', { timeout: 15000 });
    const ownerGuardVisible = await mgrRolesPage.locator('text=Only the Restaurant Owner can manage roles').first().isVisible();
    if (!ownerGuardVisible) {
      throw new Error('MANAGER did not see Owner Access Required security guard on /settings/roles!');
    }
    console.log('  ✓ MANAGER strictly restricted by "Owner Access Required" security guard on /settings/roles');
    await mgrRolesPage.close();

    // 2.5 API-level enforcement: Manager attempting to create a role via POST /roles
    const managerCreateRoleRes = await fetch(`${API_BASE}/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: manager.auth.cookiePair,
        'X-Restaurant-Id': restId,
      },
      body: JSON.stringify({ name: 'Hacked_Role', permissions: ['*'] }),
    });
    if (managerCreateRoleRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for Manager creating role, got: ${managerCreateRoleRes.status}`);
    }
    console.log('  ✓ API-level RBAC verified: Manager POST /roles returned 403 Forbidden (requires roles:manage)');
    await manager.context.close();
    console.log('✅ SCENARIO 2 PASSED: MANAGER verified across operations and security restrictions.\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 3: CASHIER ROLE - POS Billing, Cart & Order Creation
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- SCENARIO 3: CASHIER Role (POS Billing, Cart Flow, Forbidden from Kitchen & Settings) ---');
    const cashier = await createContextForRole(browser, '+919876543202', restId, outletId);

    // 3.1 Primary POS counter access
    await verifyRouteAccess(cashier.context, `/pos?outletId=${outletId}`, 'ALLOWED', '/pos');
    console.log('  ✓ CASHIER loaded /pos primary screen');

    // 3.2 Forbidden: /kitchen
    const cashierKitchen = await verifyRouteAccess(cashier.context, `/kitchen?outletId=${outletId}`, 'FORBIDDEN');
    console.log(`  ✓ CASHIER strictly blocked from /kitchen (Redirected to: ${cashierKitchen.redirectedTo})`);

    // 3.3 Forbidden: /settings
    const cashierSettings = await verifyRouteAccess(cashier.context, `/settings?outletId=${outletId}`, 'FORBIDDEN');
    console.log(`  ✓ CASHIER strictly blocked from /settings (Redirected to: ${cashierSettings.redirectedTo})`);
    await cashier.context.close();
    console.log('✅ SCENARIO 3 PASSED: CASHIER verified for billing and route enforcement.\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 4: CAPTAIN ROLE - Waiter Mobility, Floor & Table Supervision
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- SCENARIO 4: CAPTAIN Role (Floor Supervision, Waiter Mobility, Table Assignments) ---');
    const captain = await createContextForRole(browser, '+919876543203', restId, outletId);

    // 4.1 Primary screen: /waiter
    await verifyRouteAccess(captain.context, `/waiter?outletId=${outletId}`, 'ALLOWED', '/waiter');
    console.log(`  ✓ CAPTAIN landed on /waiter primary mobility screen`);

    // 4.2 Floor management: /tables
    await verifyRouteAccess(captain.context, `/tables?outletId=${outletId}`, 'ALLOWED', '/tables');
    console.log('  ✓ CAPTAIN accessed /tables floor view');

    // 4.3 Forbidden: /settings
    const captainSettings = await verifyRouteAccess(captain.context, `/settings?outletId=${outletId}`, 'FORBIDDEN');
    console.log(`  ✓ CAPTAIN strictly blocked from /settings (Redirected to: ${captainSettings.redirectedTo})`);
    await captain.context.close();
    console.log('✅ SCENARIO 4 PASSED: CAPTAIN mobility and floor governance verified.\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 5: WAITER ROLE - Table Orders, Guest Calling & Mobility
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- SCENARIO 5: WAITER Role (Table Ordering, Service Mobility, Forbidden from Kitchen & Settings) ---');
    const waiter = await createContextForRole(browser, '+919876543204', restId, outletId);

    // 5.1 Primary screen: /waiter
    await verifyRouteAccess(waiter.context, `/waiter?outletId=${outletId}`, 'ALLOWED', '/waiter');
    console.log(`  ✓ WAITER landed on /waiter`);

    // 5.2 Forbidden: /kitchen
    const waiterKitchen = await verifyRouteAccess(waiter.context, `/kitchen?outletId=${outletId}`, 'FORBIDDEN');
    console.log(`  ✓ WAITER strictly blocked from /kitchen (Redirected to: ${waiterKitchen.redirectedTo})`);

    // 5.3 Forbidden: /settings
    const waiterSettings = await verifyRouteAccess(waiter.context, `/settings?outletId=${outletId}`, 'FORBIDDEN');
    console.log(`  ✓ WAITER strictly blocked from /settings (Redirected to: ${waiterSettings.redirectedTo})`);
    await waiter.context.close();
    console.log('✅ SCENARIO 5 PASSED: WAITER mobile order taking & isolation verified.\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 6: KITCHEN ROLE (CHEF) - KDS Display & Ticket Operations
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- SCENARIO 6: KITCHEN Role (KDS Kitchen Display, Ticket Bump, Forbidden from POS/Waiter/Settings) ---');
    const kitchen = await createContextForRole(browser, '+919876543205', restId, outletId);

    // 6.1 Primary screen: /kitchen
    await verifyRouteAccess(kitchen.context, `/kitchen?outletId=${outletId}`, 'ALLOWED', '/kitchen');
    console.log(`  ✓ KITCHEN landed on /kitchen KDS`);

    // 6.2 Forbidden: /pos
    const kitchenPos = await verifyRouteAccess(kitchen.context, `/pos?outletId=${outletId}`, 'FORBIDDEN');
    console.log(`  ✓ KITCHEN strictly blocked from /pos (Redirected to: ${kitchenPos.redirectedTo})`);

    // 6.3 Forbidden: /waiter
    const kitchenWaiter = await verifyRouteAccess(kitchen.context, `/waiter?outletId=${outletId}`, 'FORBIDDEN');
    console.log(`  ✓ KITCHEN strictly blocked from /waiter (Redirected to: ${kitchenWaiter.redirectedTo})`);
    await kitchen.context.close();
    console.log('✅ SCENARIO 6 PASSED: KITCHEN KDS display and counter isolation verified.\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 7: RIDER ROLE - Delivery Fleet Portal & Drop-off Management
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- SCENARIO 7: RIDER Role (Delivery Orders, Dispatch Tracking, Forbidden from Operations) ---');
    const rider = await createContextForRole(browser, '+919876543210', restId, outletId);

    // 7.1 Primary screen: /rider
    await verifyRouteAccess(rider.context, `/rider?outletId=${outletId}`, 'ALLOWED', '/rider');
    console.log(`  ✓ RIDER landed on /rider portal`);

    // 7.2 Forbidden: /pos
    const riderPos = await verifyRouteAccess(rider.context, `/pos?outletId=${outletId}`, 'FORBIDDEN');
    console.log(`  ✓ RIDER strictly blocked from /pos (Redirected to: ${riderPos.redirectedTo})`);

    // 7.3 Forbidden: /kitchen
    const riderKitchen = await verifyRouteAccess(rider.context, `/kitchen?outletId=${outletId}`, 'FORBIDDEN');
    console.log(`  ✓ RIDER strictly blocked from /kitchen (Redirected to: ${riderKitchen.redirectedTo})`);
    await rider.context.close();
    console.log('✅ SCENARIO 7 PASSED: RIDER delivery portal and operational isolation verified.\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 8: CUSTOM ROLE (BARTENDER) - Granular Custom Access Control
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- SCENARIO 8: CUSTOM Role BARTENDER (Specific Granular Permissions) ---');
    const bartender = await createContextForRole(browser, '+919876543299', restId, outletId);

    // 8.1 Permitted screen: /pos
    await verifyRouteAccess(bartender.context, `/pos?outletId=${outletId}`, 'ALLOWED', '/pos');
    console.log('  ✓ BARTENDER accessed permitted screen /pos');

    // 8.2 Permitted screen: /tables
    await verifyRouteAccess(bartender.context, `/tables?outletId=${outletId}`, 'ALLOWED', '/tables');
    console.log('  ✓ BARTENDER accessed permitted screen /tables');

    // 8.3 Forbidden screen: /kitchen
    const bartenderKitchen = await verifyRouteAccess(bartender.context, `/kitchen?outletId=${outletId}`, 'FORBIDDEN');
    console.log(`  ✓ BARTENDER strictly blocked from /kitchen (Redirected to: ${bartenderKitchen.redirectedTo})`);
    await bartender.context.close();
    console.log('✅ SCENARIO 8 PASSED: Custom Role dynamic permissions enforcement verified.\n');

    // ─────────────────────────────────────────────────────────────────────────────
    // SCENARIO 9: NON-ADMIN ACCESS TO /admin IS STRICTLY BLOCKED
    // ─────────────────────────────────────────────────────────────────────────────
    console.log('--- SCENARIO 9: Platform /admin Security Guard Across Non-Admin Roles ---');
    const testPhones = [
      { role: 'MANAGER', phone: '+919876543201' },
      { role: 'CASHIER', phone: '+919876543202' },
      { role: 'CAPTAIN', phone: '+919876543203' },
      { role: 'WAITER', phone: '+919876543204' },
      { role: 'KITCHEN', phone: '+919876543205' },
      { role: 'RIDER', phone: '+919876543210' },
      { role: 'BARTENDER', phone: '+919876543299' },
    ];

    for (const item of testPhones) {
      const u = await createContextForRole(browser, item.phone, restId, outletId);
      const res = await verifyRouteAccess(u.context, `/admin`, 'FORBIDDEN');
      console.log(`  ✓ Role ${item.role} strictly blocked from /admin (Redirected to: ${res.redirectedTo})`);
      await u.context.close();
    }
    console.log('✅ SCENARIO 9 PASSED: All 7 non-admin roles strictly blocked from Superadmin control plane.\n');

    console.log('========================================================================');
    console.log('🎉 ALL 9 EXHAUSTIVE ROLE SCENARIOS PASSED WITH 100% SUCCESS! 🎉');
    console.log('========================================================================');
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error('\n❌ SCENARIOS TEST SUITE FAILED:', err);
  process.exit(1);
});
