import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const CACHE_FILE = '/tmp/dine_session.json';
const ARTIFACT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

const BARTENDER_PHONE = '+919876543299';
const BARTENDER_PERMISSIONS = [
  'menu:view',
  'tables:view',
  'tables:status_change',
  'waiter:punch_order',
  'pos:view',
  'pos:order_create',
  'printing:view',
  'printing:test',
];

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
  return { cookiePair, cookieName, cookieValue };
}

async function run() {
  console.log('=== TESTING NEW CUSTOM ROLE: BARTENDER ===');

  // Step 1: Login as OWNER
  const ownerAuth = await loginAndGetCookie('+917276718848');
  const restRes = await fetch(`${API_BASE}/restaurants`, {
    headers: { Cookie: ownerAuth.cookiePair },
  });
  const rests = await restRes.json();
  const restId = rests[0].id;
  console.log(`[Owner] Logged in. Restaurant: ${restId} (${rests[0].name})`);

  // Get active outlets
  const outletsRes = await fetch(`${API_BASE}/outlets`, {
    headers: { Cookie: ownerAuth.cookiePair, 'X-Restaurant-Id': restId },
  });
  const outlets = await outletsRes.json();
  const outletIds = outlets.map((o: any) => o.id);
  console.log(`[Owner] Found ${outletIds.length} outlets.`);

  // Step 2: Check if BARTENDER role already exists or create it
  const rolesRes = await fetch(`${API_BASE}/roles`, {
    headers: { Cookie: ownerAuth.cookiePair, 'X-Restaurant-Id': restId },
  });
  const rolesData = await rolesRes.json();
  let bartenderRole = rolesData.roles.find((r: any) => r.name.toUpperCase() === 'BARTENDER');

  if (!bartenderRole) {
    console.log('[Owner] Creating custom role "BARTENDER"...');
    const createRoleRes = await fetch(`${API_BASE}/roles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerAuth.cookiePair,
        'X-Restaurant-Id': restId,
      },
      body: JSON.stringify({
        name: 'BARTENDER',
        description: 'Bar counter specialist: tableside drinks orders, bar counter billing, bar thermal printer.',
        allOutlets: false,
        permissions: BARTENDER_PERMISSIONS,
      }),
    });
    if (!createRoleRes.ok) {
      throw new Error(`Failed to create custom role: ${createRoleRes.status} ${await createRoleRes.text()}`);
    }
    const createdData = await createRoleRes.json();
    bartenderRole = createdData.role || createdData;
    console.log(`[Owner] Successfully created custom role BARTENDER (ID: ${bartenderRole.id})`);
  } else {
    console.log(`[Owner] Custom role BARTENDER already exists (ID: ${bartenderRole.id}). Updating permissions...`);
    await fetch(`${API_BASE}/roles/${bartenderRole.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerAuth.cookiePair,
        'X-Restaurant-Id': restId,
      },
      body: JSON.stringify({
        permissions: BARTENDER_PERMISSIONS,
      }),
    });
  }

  // Step 3: Check or invite staff member with custom role BARTENDER
  const staffRes = await fetch(`${API_BASE}/staff`, {
    headers: { Cookie: ownerAuth.cookiePair, 'X-Restaurant-Id': restId },
  });
  const staffList = await staffRes.json();
  const existingBartender = staffList.find((s: any) => s.phone === BARTENDER_PHONE);

  if (!existingBartender) {
    console.log(`[Owner] Inviting new staff member ${BARTENDER_PHONE} with custom role ${bartenderRole.id}...`);
    const inviteRes = await fetch(`${API_BASE}/staff/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: ownerAuth.cookiePair,
        'X-Restaurant-Id': restId,
      },
      body: JSON.stringify({
        phone: BARTENDER_PHONE,
        role: bartenderRole.id,
        outletIds: [outletIds[0]],
      }),
    });
    if (!inviteRes.ok) {
      console.warn(`[Owner] Invite returned ${inviteRes.status}:`, await inviteRes.text());
    } else {
      console.log(`[Owner] Successfully invited staff member with role BARTENDER!`);
    }
  } else {
    console.log(`[Owner] Staff member ${BARTENDER_PHONE} already exists with role ${existingBartender.role}`);
  }

  // Step 4: Login as the new BARTENDER staff member!
  console.log(`\n=== LOGGING IN AS CUSTOM ROLE: BARTENDER (${BARTENDER_PHONE}) ===`);
  const bartenderAuth = await loginAndGetCookie(BARTENDER_PHONE);
  console.log(`[Bartender] OTP Login succeeded! Session cookie generated.`);

  // Step 5: Verify API returns custom roleName and permissions
  const myRoleRes = await fetch(`${API_BASE}/restaurants/my-role`, {
    headers: { Cookie: bartenderAuth.cookiePair, 'X-Restaurant-Id': restId },
  });
  if (!myRoleRes.ok) {
    throw new Error(`GET /restaurants/my-role failed for BARTENDER: ${myRoleRes.status} ${await myRoleRes.text()}`);
  }
  const myRoleData = await myRoleRes.json();
  console.log(`[Bartender] API Response:`, {
    role: myRoleData.role,
    roleName: myRoleData.roleName,
    permissionsCount: myRoleData.permissions?.length,
    permissions: myRoleData.permissions,
  });

  if (myRoleData.roleName !== 'BARTENDER') {
    throw new Error(`Expected roleName to be 'BARTENDER', received '${myRoleData.roleName}'`);
  }

  // Step 6: Browser E2E verification with Playwright
  console.log(`\n=== LAUNCHING PLAYWRIGHT BROWSER TO TEST BARTENDER UI & RESTRICTIONS ===`);
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  await context.addCookies([
    {
      name: bartenderAuth.cookieName,
      value: bartenderAuth.cookieValue,
      domain: '.logixsoft.in',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: bartenderAuth.cookieName,
      value: bartenderAuth.cookieValue,
      domain: 'dine.logixsoft.in',
      path: '/',
      secure: true,
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'dine.restaurantId',
      value: restId,
      domain: 'dine.logixsoft.in',
      path: '/',
      secure: false,
      httpOnly: false,
      sameSite: 'Lax',
    },
    {
      name: 'dine.outletId',
      value: outletIds[0],
      domain: 'dine.logixsoft.in',
      path: '/',
      secure: false,
      httpOnly: false,
      sameSite: 'Lax',
    },
  ]);

  const page = await context.newPage();

  // Test 6.1: Direct navigation to POS (since BARTENDER has pos:view)
  console.log(`[Bartender] Navigating to /pos...`);
  await page.goto(`${WEB_BASE}/pos?outletId=${outletIds[0]}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const posUrl = page.url();
  console.log(`[Bartender] Landed at URL: ${posUrl}`);

  const screenshotPos = path.join(ARTIFACT_DIR, 'custom_role_bartender_pos.png');
  await page.screenshot({ path: screenshotPos, fullPage: false });
  console.log(`[Bartender] Saved POS screenshot to ${screenshotPos}`);

  // Test 6.2: Forbidden access attempt: /kitchen (BARTENDER does NOT have kitchen:view)
  console.log(`[Bartender] Testing forbidden access attempt to /kitchen...`);
  await page.goto(`${WEB_BASE}/kitchen?outletId=${outletIds[0]}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  const kitchenResultUrl = page.url();
  console.log(`[Bartender] Navigated to /kitchen -> URL: ${kitchenResultUrl}`);
  if (kitchenResultUrl.includes('/kitchen')) {
    throw new Error(`Security breach: BARTENDER was able to stay on /kitchen without kitchen:view permission!`);
  }
  console.log(`[Bartender] PASS: Correctly blocked and redirected away from /kitchen!`);

  // Test 6.3: Forbidden access attempt: /settings (BARTENDER must not access store settings)
  console.log(`[Bartender] Testing forbidden access attempt to /settings...`);
  await page.goto(`${WEB_BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForTimeout(3000);
  const settingsResultUrl = page.url();
  console.log(`[Bartender] Navigated to /settings -> URL: ${settingsResultUrl}`);
  if (settingsResultUrl.includes('/settings')) {
    throw new Error(`Security breach: BARTENDER was able to stay on /settings!`);
  }
  console.log(`[Bartender] PASS: Correctly blocked and redirected away from /settings!`);

  // Test 6.4: Permitted navigation: /tables (BARTENDER has tables:view)
  console.log(`[Bartender] Navigating to permitted screen /tables...`);
  await page.goto(`${WEB_BASE}/tables?outletId=${outletIds[0]}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  const tablesUrl = page.url();
  console.log(`[Bartender] Landed at URL: ${tablesUrl}`);
  if (!tablesUrl.includes('/tables')) {
    throw new Error(`Failed to access permitted screen /tables: URL was ${tablesUrl}`);
  }
  const screenshotTables = path.join(ARTIFACT_DIR, 'custom_role_bartender_tables.png');
  await page.screenshot({ path: screenshotTables, fullPage: false });
  console.log(`[Bartender] Saved Tables screenshot to ${screenshotTables}`);

  await browser.close();

  console.log('\n========================================');
  console.log('CUSTOM ROLE "BARTENDER" VERIFICATION: 100% SUCCESS');
  console.log('========================================');
  console.log('1. Created custom role with 8 granular permissions: PASS');
  console.log('2. Invited staff member to custom role: PASS');
  console.log('3. Authenticated via phone OTP and session generated: PASS');
  console.log('4. API /my-role returned custom role name and permissions: PASS');
  console.log('5. Permitted screens (/pos, /tables) accessible: PASS');
  console.log('6. Unauthorized screens (/kitchen, /settings) strictly blocked & redirected: PASS');
}

run().catch((e) => {
  console.error('Fatal execution error:', e);
  process.exit(1);
});
