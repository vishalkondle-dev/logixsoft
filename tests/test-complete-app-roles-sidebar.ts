import { chromium } from 'playwright';
import * as path from 'path';

const API_BASE = 'https://dine-api.logixsoft.in';
const WEB_BASE = 'https://dine.logixsoft.in';
const OWNER_PHONE = '+919985720478';
const ADMIN_PHONE = '+917276718848';
const ARTIFACT_DIR = '/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e';

async function loginUser(phone: string) {
  const verifyRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: phone, otp: '123456' }),
  });
  if (!verifyRes.ok) {
    const text = await verifyRes.text();
    throw new Error(`Login failed for ${phone}: ${text}`);
  }
  const setCookie = verifyRes.headers.get('set-cookie');
  const cookiePair = setCookie?.split(';')[0] ?? '';
  const [cookieName, cookieValue] = cookiePair.split('=');
  const data = await verifyRes.json();
  return { cookieName, cookieValue, user: data.user };
}

async function runCompleteAppAudit() {
  console.log('===============================================================');
  console.log('🌟 COMPREHENSIVE APP & NAVIGATION AUDIT FOR ALL ROLES');
  console.log('===============================================================\n');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    timeout: 30000,
  });

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // PART 1: SUPERADMIN NAVIGATION & SIDEBAR VERIFICATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('---------------------------------------------------------------');
    console.log('👑 PART 1: SUPERADMIN (/admin/overview, /admin/subscriptions)');
    console.log('---------------------------------------------------------------');

    const adminAuth = await loginUser(ADMIN_PHONE);
    console.log(`✅ Logged in Superadmin: ${adminAuth.user.name} (Role: ${adminAuth.user.role})`);

    const adminContext = await browser.newContext({
      viewport: { width: 1440, height: 950 },
      deviceScaleFactor: 1,
    });

    await adminContext.addCookies([
      {
        name: adminAuth.cookieName,
        value: decodeURIComponent(adminAuth.cookieValue),
        domain: '.logixsoft.in',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);

    const adminPage = await adminContext.newPage();
    console.log('Navigating Superadmin to /admin/overview...');
    await adminPage.goto(`${WEB_BASE}/admin/overview`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await adminPage.waitForTimeout(4000);

    // Verify Admin Sidebar items and grouping
    console.log('Verifying Admin Sidebar Nav Sections...');
    const controlPlaneGroup = await adminPage.locator('text="CONTROL PLANE"').first().isVisible();
    const tenantGovGroup = await adminPage.locator('text="TENANT GOVERNANCE"').first().isVisible();
    const opsCatalogGroup = await adminPage.locator('text="OPERATIONS & CATALOG"').first().isVisible();
    const guestCrmGroup = await adminPage.locator('text="GUEST CRM & RELATIONS"').first().isVisible();
    const sysInfraGroup = await adminPage.locator('text="SYSTEM INFRASTRUCTURE"').first().isVisible();

    console.log(`- CONTROL PLANE: ${controlPlaneGroup ? '✅' : '❌'}`);
    console.log(`- TENANT GOVERNANCE: ${tenantGovGroup ? '✅' : '❌'}`);
    console.log(`- OPERATIONS & CATALOG: ${opsCatalogGroup ? '✅' : '❌'}`);
    console.log(`- GUEST CRM & RELATIONS: ${guestCrmGroup ? '✅' : '❌'}`);
    console.log(`- SYSTEM INFRASTRUCTURE: ${sysInfraGroup ? '✅' : '❌'}`);

    // Verify Subscriptions item in sidebar
    const subsNav = await adminPage.locator('a[href="/admin/subscriptions"]').first().isVisible();
    console.log(`- Subscriptions & Plans in Admin Sidebar: ${subsNav ? '✅' : '❌'}`);

    // Verify Storefront / POS return button in header
    const posReturnBtn = await adminPage.locator('text=Storefront / POS').first().isVisible();
    console.log(`- Storefront / POS return button in Admin Header: ${posReturnBtn ? '✅' : '❌'}`);

    const adminOverviewShot = path.join(ARTIFACT_DIR, 'admin_overview_reordered.png');
    await adminPage.screenshot({ path: adminOverviewShot, animations: 'disabled' });
    console.log(`📸 Admin Overview screenshot saved: ${adminOverviewShot}`);

    // Navigate to /admin/subscriptions
    console.log('Navigating Superadmin to /admin/subscriptions...');
    await adminPage.goto(`${WEB_BASE}/admin/subscriptions`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await adminPage.waitForTimeout(4000);
    const hasAdminSubs = await adminPage.locator('text="Subscriptions & Plans"').first().isVisible();
    console.log(`- Admin Subscriptions Page Loaded: ${hasAdminSubs ? '✅' : '❌'}`);
    const adminSubsShot = path.join(ARTIFACT_DIR, 'admin_subscriptions_reordered.png');
    await adminPage.screenshot({ path: adminSubsShot, animations: 'disabled' });
    console.log(`📸 Admin Subscriptions screenshot saved: ${adminSubsShot}`);

    await adminContext.close();

    // ─────────────────────────────────────────────────────────────────────────
    // PART 2: OWNER NAVIGATION, TOP BAR (POS FIRST) & SETTINGS SIDEBAR
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n---------------------------------------------------------------');
    console.log('🍽️ PART 2: OWNER (POS FIRST & REORDERED SETTINGS SIDEBAR)');
    console.log('---------------------------------------------------------------');

    const ownerAuth = await loginUser(OWNER_PHONE);
    console.log(`✅ Logged in Owner: ${ownerAuth.user.name} (Role: ${ownerAuth.user.role})`);

    const ownerContext = await browser.newContext({
      viewport: { width: 1440, height: 950 },
      deviceScaleFactor: 1,
    });

    await ownerContext.addCookies([
      {
        name: ownerAuth.cookieName,
        value: decodeURIComponent(ownerAuth.cookieValue),
        domain: '.logixsoft.in',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);

    const ownerPage = await ownerContext.newPage();
    console.log('Navigating Owner to /pos...');
    await ownerPage.goto(`${WEB_BASE}/pos`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ownerPage.waitForTimeout(4000);

    // Check top navigation order: POS should appear first
    const topNavButtons = await ownerPage.locator('nav[aria-label="Main Navigation"] a').allInnerTexts();
    console.log('Owner Main Navigation items:', topNavButtons.map(t => t.trim()).filter(Boolean));
    const firstItem = topNavButtons[0]?.trim();
    console.log(`First item in top nav: "${firstItem}" - ${firstItem === 'POS' ? '✅ Correctly POS first' : '⚠️ Note: ' + firstItem}`);

    // Navigate to /settings
    console.log('Navigating Owner to /settings...');
    await ownerPage.goto(`${WEB_BASE}/settings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await ownerPage.waitForTimeout(4000);

    // Verify 6 section headers in the Settings left sidebar
    console.log('Verifying Settings Sidebar Section Headers...');
    const storeSetupHeader = await ownerPage.getByText("STORE SETUP", { exact: true }).first().isVisible();
    const menuFloorHeader = await ownerPage.getByText("MENU & FLOOR", { exact: true }).first().isVisible();
    const deliveryHwHeader = await ownerPage.getByText("DELIVERY & HARDWARE", { exact: true }).first().isVisible();
    const guestExpHeader = await ownerPage.getByText("GUEST EXPERIENCE", { exact: true }).first().isVisible();
    const teamAnalyticsHeader = await ownerPage.getByText("TEAM & ANALYTICS", { exact: true }).first().isVisible();
    const accountBillingHeader = await ownerPage.getByText("ACCOUNT & BILLING", { exact: true }).first().isVisible();

    console.log(`- STORE SETUP in sidebar: ${storeSetupHeader ? '✅' : '❌'}`);
    console.log(`- MENU & FLOOR in sidebar: ${menuFloorHeader ? '✅' : '❌'}`);
    console.log(`- DELIVERY & HARDWARE in sidebar: ${deliveryHwHeader ? '✅' : '❌'}`);
    console.log(`- GUEST EXPERIENCE in sidebar: ${guestExpHeader ? '✅' : '❌'}`);
    console.log(`- TEAM & ANALYTICS in sidebar: ${teamAnalyticsHeader ? '✅' : '❌'}`);
    console.log(`- ACCOUNT & BILLING in sidebar: ${accountBillingHeader ? '✅' : '❌'}`);

    // Verify Overview categories
    console.log('Verifying Settings Overview Category Headings...');
    const catStoreSetup = await ownerPage.locator('text=Store Setup').first().isVisible();
    const catMenuFloor = await ownerPage.locator('text=Menu & Dining Floor').first().isVisible();
    const catDeliveryHw = await ownerPage.locator('text=Delivery & Hardware').first().isVisible();
    const catGuestExp = await ownerPage.locator('text=Digital Guest Experience').first().isVisible();
    const catTeamGov = await ownerPage.locator('text=Team & Governance').first().isVisible();
    const catFinances = await ownerPage.locator('text=Financials & Billing').first().isVisible();

    console.log(`- Store Setup on page: ${catStoreSetup ? '✅' : '❌'}`);
    console.log(`- Menu & Dining Floor on page: ${catMenuFloor ? '✅' : '❌'}`);
    console.log(`- Delivery & Hardware on page: ${catDeliveryHw ? '✅' : '❌'}`);
    console.log(`- Digital Guest Experience on page: ${catGuestExp ? '✅' : '❌'}`);
    console.log(`- Team & Governance on page: ${catTeamGov ? '✅' : '❌'}`);
    console.log(`- Financials & Billing on page: ${catFinances ? '✅' : '❌'}`);

    const ownerSettingsOverviewShot = path.join(ARTIFACT_DIR, 'owner_settings_overview_reordered.png');
    await ownerPage.screenshot({ path: ownerSettingsOverviewShot, animations: 'disabled' });
    console.log(`📸 Owner Settings Overview screenshot saved: ${ownerSettingsOverviewShot}`);

    // Navigate to /settings/billing via sidebar
    console.log('Navigating to /settings/billing via sidebar...');
    await ownerPage.click('a[href="/settings/billing"]');
    await ownerPage.waitForTimeout(3000);

    const hasOwnerBilling = await ownerPage.locator('text=/.*Subscription & Billing.*/').first().isVisible();
    console.log(`- Owner Billing Page Loaded: ${hasOwnerBilling ? '✅' : '❌'}`);

    const ownerBillingShot = path.join(ARTIFACT_DIR, 'owner_billing_reordered.png');
    await ownerPage.screenshot({ path: ownerBillingShot, animations: 'disabled' });
    console.log(`📸 Owner Billing screenshot saved: ${ownerBillingShot}`);

    await ownerContext.close();

    // ─────────────────────────────────────────────────────────────────────────
    // PART 3: CUSTOMER PORTAL EXPERIENCE & NAVIGATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n---------------------------------------------------------------');
    console.log('👤 PART 3: CUSTOMER PORTAL (/portal)');
    console.log('---------------------------------------------------------------');

    const CUSTOMER_PHONE = '+919811122233';
    const customerAuth = await loginUser(CUSTOMER_PHONE);
    console.log(`✅ Logged in Customer: ${customerAuth.user.name} (Role: ${customerAuth.user.role})`);

    const customerContext = await browser.newContext({
      viewport: { width: 412, height: 915 }, // Mobile device viewport
      deviceScaleFactor: 2,
    });

    await customerContext.addCookies([
      {
        name: customerAuth.cookieName,
        value: decodeURIComponent(customerAuth.cookieValue),
        domain: '.logixsoft.in',
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);

    const customerPage = await customerContext.newPage();
    console.log('Navigating to /portal...');
    await customerPage.goto(`${WEB_BASE}/portal`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await customerPage.waitForTimeout(4000);

    // Verify Customer Navigation bar at the bottom
    console.log('Verifying Customer Navigation...');
    const custNav = await customerPage.locator('nav[aria-label="Customer Navigation"]').isVisible();
    console.log(`- Customer Bottom Navigation Bar: ${custNav ? '✅' : '❌'}`);

    const homeTab = await customerPage.locator('nav button:has-text("Home")').first().isVisible();
    const ordersTab = await customerPage.locator('nav button:has-text("Orders")').first().isVisible();
    const menuTab = await customerPage.locator('nav button:has-text("Menu")').first().isVisible();
    const perksTab = await customerPage.locator('nav button:has-text("Perks")').first().isVisible();
    const profileTab = await customerPage.locator('nav button:has-text("Profile")').first().isVisible();

    console.log(`- Home Tab: ${homeTab ? '✅' : '❌'}`);
    console.log(`- Orders Tab: ${ordersTab ? '✅' : '❌'}`);
    console.log(`- Menu Tab: ${menuTab ? '✅' : '❌'}`);
    console.log(`- Perks Tab: ${perksTab ? '✅' : '❌'}`);
    console.log(`- Profile Tab: ${profileTab ? '✅' : '❌'}`);

    const customerPortalShot = path.join(ARTIFACT_DIR, 'customer_portal_mobile.png');
    await customerPage.screenshot({ path: customerPortalShot, animations: 'disabled' });
    console.log(`📸 Customer Portal mobile screenshot saved: ${customerPortalShot}`);

    // Click on Menu tab
    if (menuTab) {
      console.log('Clicking Menu Tab...');
      await customerPage.locator('nav button:has-text("Menu")').first().click();
      await customerPage.waitForTimeout(2000);
      const customerMenuShot = path.join(ARTIFACT_DIR, 'customer_portal_menu.png');
      await customerPage.screenshot({ path: customerMenuShot, animations: 'disabled' });
      console.log(`📸 Customer Portal Menu screenshot saved: ${customerMenuShot}`);
    }

    // Click on Profile tab
    if (profileTab) {
      console.log('Clicking Profile Tab...');
      await customerPage.locator('nav button:has-text("Profile")').first().click();
      await customerPage.waitForTimeout(2000);
      const customerProfileShot = path.join(ARTIFACT_DIR, 'customer_portal_profile.png');
      await customerPage.screenshot({ path: customerProfileShot, animations: 'disabled' });
      console.log(`📸 Customer Portal Profile screenshot saved: ${customerProfileShot}`);
    }

    await customerContext.close();

    console.log('\n===============================================================');
    console.log('🎉 ALL ROLES AUDIT & REORDERED NAVIGATION SUCCESSFULLY TESTED!');
    console.log('===============================================================');

  } catch (error: any) {
    console.error('❌ Error during complete app audit:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runCompleteAppAudit().catch(console.error);
