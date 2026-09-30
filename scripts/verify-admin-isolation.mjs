import { chromium } from "../node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";
import postgres from "../apps/logix-dine/api/node_modules/postgres/src/index.js";

const FRONTEND_BASE = "https://dine.logixsoft.in";
const API_BASE = "https://dine-api.logixsoft.in";
const ADMIN_PHONE = "7276718848";
const ADMIN_PHONE_E164 = "+917276718848";
const OTP = "123456";
const ARTIFACTS_DIR = "/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e";
const DATABASE_URL = "postgresql://payment_user:payment_pass_logixsoft_2026@127.0.0.1:5432/payment";

const sql = postgres(DATABASE_URL);

async function run() {
  console.log("=== Admin Role Isolation & Restaurant Decoupling Verification ===");

  // ─── STEP 1: Verify PostgreSQL Database State ───
  console.log("\n--- STEP 1: Verifying PostgreSQL DB State ---");
  const [adminUser] = await sql`SELECT id, name, "phoneNumber", role FROM "user" WHERE "phoneNumber" = ${ADMIN_PHONE_E164}`;
  console.log("Admin user record in DB:", adminUser);

  if (!adminUser || adminUser.role !== "ADMIN") {
    throw new Error(`Expected admin user role to be ADMIN, got ${adminUser?.role}`);
  }
  console.log(`✅ Admin user exists with role: '${adminUser.role}'`);

  // Verify outletStaff has ZERO entries for admin phone or userId
  const staffRows = await sql`
    SELECT * FROM "outletStaff" 
    WHERE phone = ${ADMIN_PHONE_E164} OR "userId" = ${adminUser.id}
  `;
  console.log("Admin rows in outletStaff:", staffRows);
  if (staffRows.length > 0) {
    throw new Error(`Admin was found linked in outletStaff (${staffRows.length} rows)!`);
  }
  console.log("✅ Admin has ZERO rows in outletStaff. Completely decoupled from restaurant staff!");

  // Verify restaurant ownerUserId is NOT admin
  const linkedRests = await sql`SELECT id, name, "ownerUserId" FROM "restaurant" WHERE "ownerUserId" = ${adminUser.id}`;
  console.log("Restaurants where admin is ownerUserId:", linkedRests);
  if (linkedRests.length > 0) {
    throw new Error(`Admin is still set as ownerUserId for restaurants!`);
  }
  console.log("✅ Admin userId is NOT linked to any restaurant!");

  // ─── STEP 2: Verify Backend API Guardrails ───
  console.log("\n--- STEP 2: Verifying Backend Guardrails ---");

  // Get admin session cookie for API calls
  await fetch(`${API_BASE}/auth/phone/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: ADMIN_PHONE_E164 }),
  });
  const verifyRes = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: ADMIN_PHONE_E164, otp: OTP }),
  });
  const setCookie = verifyRes.headers.get("set-cookie");
  const [cookiePair] = setCookie.split(";");

  // Test 2A: Check GET /restaurants returns empty list for Admin
  const myRestsRes = await fetch(`${API_BASE}/restaurants`, {
    headers: { "Cookie": cookiePair },
  });
  const myRests = await myRestsRes.json();
  console.log("GET /restaurants for Admin returned:", myRests);
  if (myRests.length !== 0) {
    throw new Error(`Expected GET /restaurants to return [] for Admin, got ${JSON.stringify(myRests)}`);
  }
  console.log("✅ GET /restaurants returns [] for Admin (zero restaurant memberships)");

  // Test 2B: Attempt to add Admin phone as staff via POST /staff
  const [sampleRest] = await sql`SELECT id FROM "restaurant" LIMIT 1`;
  const [sampleOutlet] = await sql`SELECT id FROM "restaurantOutlet" WHERE "restaurantId" = ${sampleRest.id} LIMIT 1`;

  const addStaffRes = await fetch(`${API_BASE}/staff`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookiePair,
      "X-Restaurant-Id": sampleRest.id,
    },
    body: JSON.stringify({
      name: "Admin As Staff Attempt",
      phone: ADMIN_PHONE,
      role: "WAITER",
      outletIds: [sampleOutlet.id],
    }),
  });
  console.log("Attempt add Admin as staff response status:", addStaffRes.status);
  const addStaffData = await addStaffRes.json();
  console.log("Attempt add Admin as staff response body:", addStaffData);
  if (addStaffRes.status !== 400 && addStaffRes.status !== 403) {
    throw new Error(`Expected POST /staff with admin phone to fail with 400/403, got ${addStaffRes.status}`);
  }
  console.log("✅ Guardrail passed: System rejected adding Admin phone to restaurant staff!");

  // Test 2C: Attempt to create restaurant with Admin phone as owner
  const createStoreRes = await fetch(`${API_BASE}/admin/restaurants`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookiePair,
    },
    body: JSON.stringify({
      name: "Illegal Admin Store",
      address: "Test Address",
      ownerPhone: ADMIN_PHONE,
    }),
  });
  console.log("Attempt create store with Admin owner status:", createStoreRes.status);
  const createStoreData = await createStoreRes.json();
  console.log("Attempt create store with Admin owner body:", createStoreData);
  if (createStoreRes.status !== 400) {
    throw new Error(`Expected POST /admin/restaurants with admin phone to fail with 400, got ${createStoreRes.status}`);
  }
  console.log("✅ Guardrail passed: System rejected assigning Admin phone as restaurant owner!");

  // ─── STEP 3: Verify Browser UI & Navigation ───
  console.log("\n--- STEP 3: Verifying Admin Browser UI & Direct Navigation ---");
  const browser = await chromium.launch({ headless: true });
  const [cookieName, cookieValue] = cookiePair.split("=");

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies([
    {
      name: cookieName,
      value: cookieValue,
      domain: ".logixsoft.in",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "None",
    },
    {
      name: cookieName,
      value: cookieValue,
      domain: "dine.logixsoft.in",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "None",
    },
  ]);

  const page = await context.newPage();
  console.log("Navigating to https://dine.logixsoft.in/admin/system...");
  await page.goto(`${FRONTEND_BASE}/admin/system`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  console.log("Admin current page URL:", currentUrl);

  await page.screenshot({ path: `${ARTIFACTS_DIR}/admin_isolated_system.png` });
  console.log("Saved artifact: admin_isolated_system.png");

  // Verify top navbar contains Superadmin PLATFORM header and NO outlet/branch selector
  const superadminTitle = page.locator('text="Superadmin"');
  await superadminTitle.first().waitFor({ state: "visible", timeout: 10000 });
  const platformBadge = page.locator('text="PLATFORM"');
  await platformBadge.first().waitFor({ state: "visible", timeout: 10000 });
  console.log("✅ Superadmin [PLATFORM] control plane verified visible in UI.");

  // Verify branch selector is NOT present
  const branchSelector = page.locator('text="Main Branch"');
  const hasBranch = await branchSelector.isVisible();
  console.log("Has branch selector on admin screen:", hasBranch);
  if (hasBranch) {
    throw new Error("Found restaurant branch selector on Superadmin screen!");
  }
  console.log("✅ Zero restaurant branches shown in Superadmin control plane.");

  // Also check admin overview
  console.log("Navigating to https://dine.logixsoft.in/admin/overview...");
  await page.goto(`${FRONTEND_BASE}/admin/overview`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${ARTIFACTS_DIR}/admin_isolated_overview.png` });
  console.log("Saved artifact: admin_isolated_overview.png");

  await browser.close();
  await sql.end();
  console.log("\n=== ALL ADMIN ISOLATION VERIFICATIONS PASSED SUCCESSFULLY! ===");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
