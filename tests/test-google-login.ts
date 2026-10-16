import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/screenshots";

async function runGoogleLoginTests() {
  console.log("=== Testing Google Login & Authentication Workflow ===");

  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();

  try {
    // 1. Navigate to Homepage
    console.log("1. Navigating to homepage http://localhost:3050...");
    await page.goto("http://localhost:3050", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Verify Sign In button is present in header
    const signInBtn = page.locator('button:has-text("Sign In")').first();
    const isSignInVisible = await signInBtn.isVisible();
    console.log("   'Sign In' button visible:", isSignInVisible);
    if (!isSignInVisible) {
      throw new Error("Sign In button should be visible in header when unauthenticated");
    }

    // 2. Open Auth Modal
    console.log("2. Clicking 'Sign In' button...");
    await signInBtn.click();
    await page.waitForTimeout(500);

    const modalTitle = page.locator('text="Sign In to IPL Auction Simulator"').first();
    if (!(await modalTitle.isVisible())) {
      throw new Error("Auth modal failed to open");
    }

    const googleBtn = page.locator('button:has-text("Continue with Google")').first();
    if (!(await googleBtn.isVisible())) {
      throw new Error("Continue with Google button missing from modal");
    }

    const modalScreenshotPath = path.join(ARTIFACT_DIR, "google_01_auth_modal.png");
    await page.screenshot({ path: modalScreenshotPath, fullPage: false });
    console.log(`   Captured screenshot: ${modalScreenshotPath}`);

    // 3. Click Continue with Google
    console.log("3. Clicking 'Continue with Google' button...");
    await googleBtn.click();
    await page.waitForTimeout(1200);

    // Modal should close
    const isModalClosed = !(await modalTitle.isVisible());
    console.log("   Auth modal closed:", isModalClosed);
    if (!isModalClosed) {
      throw new Error("Auth modal should close after successful Google login");
    }

    // 4. Verify User Profile in Header
    console.log("4. Verifying signed-in user state in TopNavBar...");
    const userNameElement = page.locator('text="Vishal Kondle"').first();
    const isUserVisible = await userNameElement.isVisible();
    console.log("   User 'Vishal Kondle' displayed in header:", isUserVisible);
    if (!isUserVisible) {
      throw new Error("User 'Vishal Kondle' should be displayed in header");
    }

    const userRoleBadge = page.locator('span:has-text("USER")').first();
    const isBadgeVisible = await userRoleBadge.isVisible();
    console.log("   Role 'USER' badge displayed:", isBadgeVisible);

    // 5. Click User Profile to open dropdown
    console.log("5. Opening user menu dropdown...");
    await userNameElement.click();
    await page.waitForTimeout(500);

    const emailInMenu = page.locator('text="vishalkondle.dev@gmail.com"').first();
    const isEmailVisible = await emailInMenu.isVisible();
    console.log("   Email 'vishalkondle.dev@gmail.com' in dropdown:", isEmailVisible);
    if (!isEmailVisible) {
      throw new Error("User email should be displayed in user menu dropdown");
    }

    const dropdownScreenshotPath = path.join(ARTIFACT_DIR, "google_02_logged_in_dropdown.png");
    await page.screenshot({ path: dropdownScreenshotPath, fullPage: false });
    console.log(`   Captured screenshot: ${dropdownScreenshotPath}`);

    // 6. Test Sign Out
    console.log("6. Clicking Sign Out...");
    const signOutBtn = page.locator('button:has-text("Sign Out")').first();
    await signOutBtn.click();
    await page.waitForTimeout(800);

    const isSignedOut = await page.locator('button:has-text("Sign In")').first().isVisible();
    console.log("   Returned to unauthenticated state (Sign In button visible):", isSignedOut);
    if (!isSignedOut) {
      throw new Error("User should be signed out after clicking Sign Out");
    }

    // 7. Test custom Google email sign in
    console.log("7. Testing custom Google email login...");
    await page.locator('button:has-text("Sign In")').first().click();
    await page.waitForTimeout(500);

    const switchBtn = page.locator('button:has-text("Switch account")').first();
    await switchBtn.click();
    await page.waitForTimeout(300);

    const emailInput = page.locator('input[placeholder="e.g. name@gmail.com"]').first();
    await emailInput.fill("sachin.tendulkar@gmail.com");
    await page.locator('button[type="submit"]:has-text("Use")').click();
    await page.waitForTimeout(1200);

    const customUserVisible = await page.locator('text="Sachin Tendulkar"').first().isVisible();
    console.log("   Custom user 'Sachin Tendulkar' displayed:", customUserVisible);
    if (!customUserVisible) {
      throw new Error("Custom Google login for Sachin Tendulkar failed");
    }

    // Open dropdown to check custom email
    await page.locator('text="Sachin Tendulkar"').first().click();
    await page.waitForTimeout(500);

    const customEmailVisible = await page.locator('text="sachin.tendulkar@gmail.com"').first().isVisible();
    console.log("   Custom email 'sachin.tendulkar@gmail.com' verified in dropdown:", customEmailVisible);

    const customScreenshotPath = path.join(ARTIFACT_DIR, "google_03_custom_google_account.png");
    await page.screenshot({ path: customScreenshotPath, fullPage: false });
    console.log(`   Captured screenshot: ${customScreenshotPath}`);

    console.log("\n ALL GOOGLE AUTHENTICATION TESTS PASSED PERFECTLY!");
  } catch (err) {
    console.error("Test failed with error:", err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "google_error.png") });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runGoogleLoginTests();
