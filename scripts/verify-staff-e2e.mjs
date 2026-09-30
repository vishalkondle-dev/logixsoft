import { chromium } from "../node_modules/.pnpm/playwright@1.63.0/node_modules/playwright/index.mjs";
import postgres from "../apps/logix-dine/api/node_modules/postgres/src/index.js";

const FRONTEND_BASE = "https://dine.logixsoft.in";
const API_BASE = "https://dine-api.logixsoft.in";
const OWNER_PHONE = "+917276718848";
const STAFF_PHONE_RAW = "9876543210";
const STAFF_PHONE_E164 = "+919876543210";
const STAFF_NAME = "Ramesh Waiter";
const OTP = "123456";
const ARTIFACTS_DIR = "/root/.gemini/antigravity-cli/brain/55f57a55-95f7-4878-83aa-64f13c31892e";
const DATABASE_URL = "postgresql://payment_user:payment_pass_logixsoft_2026@127.0.0.1:5432/payment";

const sql = postgres(DATABASE_URL);

async function getAuthCookie(phone) {
  await fetch(`${API_BASE}/auth/phone/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: phone }),
  });
  const res = await fetch(`${API_BASE}/auth/phone/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber: phone, otp: OTP }),
  });
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) throw new Error(`No cookie returned for ${phone}`);
  const [cookiePair] = setCookie.split(";");
  const [name, value] = cookiePair.split("=");
  return { name, value };
}

async function run() {
  console.log("=== Direct Staff Provisioning E2E Verification ===");

  // 0. Clean any previous test staff for STAFF_PHONE
  await sql`DELETE FROM "outletStaff" WHERE phone = ${STAFF_PHONE_E164}`;
  await sql`DELETE FROM "user" WHERE "phoneNumber" = ${STAFF_PHONE_E164}`;
  console.log("Cleaned previous test staff data from DB.");

  // 1. Get authenticated session for Owner
  const ownerCookie = await getAuthCookie(OWNER_PHONE);
  console.log("Obtained authenticated session cookie for Owner.");

  const browser = await chromium.launch({ headless: true });

  // ─── STEP 1: Owner opens Staff Management in Settings ───
  console.log("\n--- STEP 1: Owner navigates to Settings -> Staff ---");
  const ownerContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ownerContext.addCookies([
    {
      name: ownerCookie.name,
      value: ownerCookie.value,
      domain: ".logixsoft.in",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "None",
    },
    {
      name: ownerCookie.name,
      value: ownerCookie.value,
      domain: "dine.logixsoft.in",
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "None",
    },
  ]);

  const ownerPage = await ownerContext.newPage();
  await ownerPage.goto(`${FRONTEND_BASE}/settings/staff`, { waitUntil: "networkidle" });
  await ownerPage.waitForTimeout(2000);

  await ownerPage.screenshot({ path: `${ARTIFACTS_DIR}/staff_tab_initial.png` });
  console.log("Saved artifact: staff_tab_initial.png");

  // ─── STEP 2: Owner clicks 'Add Staff' and fills form ───
  console.log("\n--- STEP 2: Adding Staff Member directly ---");
  const addStaffBtn = ownerPage.locator('button:has-text("Add Staff")').first();
  await addStaffBtn.waitFor({ state: "visible", timeout: 10000 });
  await addStaffBtn.click();
  await ownerPage.waitForTimeout(1000);

  console.log("Filling staff form: Name, Phone, Role (WAITER), Branch...");
  const modal = ownerPage.locator('.mantine-Modal-content');
  await modal.waitFor({ state: "visible", timeout: 5000 });

  const nameInput = modal.locator('input[placeholder="e.g. Ramesh Kumar"]');
  await nameInput.waitFor({ state: "visible", timeout: 5000 });
  await nameInput.fill(STAFF_NAME);

  const staffPhoneInput = modal.locator('input[placeholder="10-digit mobile number"]');
  await staffPhoneInput.fill(STAFF_PHONE_RAW);

  await ownerPage.screenshot({ path: `${ARTIFACTS_DIR}/staff_add_modal.png` });
  console.log("Saved artifact: staff_add_modal.png");

  console.log("Submitting 'Add Staff Member'...");
  const submitBtn = modal.locator('button:has-text("Add Staff Member")');
  await submitBtn.click();
  await ownerPage.waitForTimeout(3000);

  // Wait for Ramesh to appear in the staff list
  const staffCard = ownerPage.locator(`text="${STAFF_NAME}"`).first();
  await staffCard.waitFor({ state: "visible", timeout: 10000 });
  console.log("Staff member rendered in team list successfully.");

  await ownerPage.screenshot({ path: `${ARTIFACTS_DIR}/staff_added_active.png` });
  console.log("Saved artifact: staff_added_active.png");

  // ─── STEP 3: Verify DB record in outletStaff ───
  console.log("\n--- STEP 3: Verifying PostgreSQL outletStaff ---");
  const staffRows = await sql`SELECT * FROM "outletStaff" WHERE phone = ${STAFF_PHONE_E164}`;
  console.log("outletStaff records found in DB:", staffRows);
  if (!staffRows.length) {
    throw new Error("Staff row not found in outletStaff table!");
  }
  const staffRecord = staffRows[0];
  console.log(`✅ Staff row created with ID: ${staffRecord.id}`);
  console.log(`✅ Status is immediately: ${staffRecord.status} (no pending invite!)`);
  console.log(`✅ Role: ${staffRecord.role}`);
  console.log(`✅ Outlet: ${staffRecord.outletId}`);

  if (staffRecord.status !== "ACTIVE") {
    throw new Error(`Expected status to be ACTIVE, but got ${staffRecord.status}`);
  }

  // ─── STEP 4: Direct Staff OTP Login (Incognito Context) ───
  console.log("\n--- STEP 4: Staff direct login via OTP ---");
  const staffContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const staffPage = await staffContext.newPage();

  console.log(`Navigating to ${FRONTEND_BASE}/?login=true...`);
  await staffPage.goto(`${FRONTEND_BASE}/?login=true`, { waitUntil: "networkidle" });
  await staffPage.waitForTimeout(1500);

  const phoneInput = staffPage.locator('input[placeholder="e.g. 9876543210"]');
  await phoneInput.waitFor({ state: "visible", timeout: 10000 });
  await phoneInput.fill(STAFF_PHONE_RAW);

  const continueBtn = staffPage.locator('button:has-text("Continue")');
  await continueBtn.click();
  await staffPage.waitForTimeout(2000);

  // If new user name input appears
  const newUserNameInput = staffPage.locator('input[placeholder="Enter your name"]');
  if (await newUserNameInput.isVisible()) {
    console.log("Entering new user name for registration...");
    await newUserNameInput.fill(STAFF_NAME);
  }

  // Fill OTP PinInput
  console.log("Entering OTP...");
  const pinInputs = staffPage.locator('.mantine-PinInput-input');
  await pinInputs.first().waitFor({ state: "visible", timeout: 10000 });
  for (let i = 0; i < OTP.length; i++) {
    await pinInputs.nth(i).fill(OTP[i]);
  }

  const verifyBtn = staffPage.locator('button:has-text("Verify & Continue")');
  await verifyBtn.click();
  console.log("Submitted OTP verification. Waiting for role auto-routing...");

  // Wait up to 15 seconds for redirection to /waiter
  await staffPage.waitForURL((url) => url.pathname.startsWith("/waiter"), { timeout: 15000 });
  await staffPage.waitForTimeout(3000);

  const staffUrl = staffPage.url();
  console.log("✅ Staff successfully auto-routed to URL:", staffUrl);

  await staffPage.screenshot({ path: `${ARTIFACTS_DIR}/staff_waiter_screen.png` });
  console.log("Saved artifact: staff_waiter_screen.png");

  // ─── STEP 5: Verify DB Auto-Linking of userId ───
  console.log("\n--- STEP 5: Verifying DB Auto-linking of userId ---");
  const updatedStaffRows = await sql`SELECT * FROM "outletStaff" WHERE phone = ${STAFF_PHONE_E164}`;
  console.log("Updated outletStaff row after login:", updatedStaffRows);
  if (!updatedStaffRows[0].userId) {
    throw new Error("Staff userId was not auto-linked after login!");
  }
  console.log(`✅ Staff userId successfully auto-linked to: ${updatedStaffRows[0].userId}`);

  // Check roles count in DB
  const roleCounts = await sql`
    SELECT role, COUNT(DISTINCT phone) as count 
    FROM "outletStaff" 
    WHERE "restaurantId" = ${staffRecord.restaurantId} 
    GROUP BY role;
  `;
  console.log("Staff counts per role in DB:", roleCounts);

  await browser.close();
  await sql.end();
  console.log("\n=== ALL E2E VERIFICATIONS PASSED SUCCESSFULLY! ===");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
