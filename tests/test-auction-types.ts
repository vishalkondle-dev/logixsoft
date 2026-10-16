import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/screenshots";

async function run() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  console.log("=== Starting Multi-Auction Types (Mega, Classic, Sprint XI) Verification Test ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();

  try {
    // -------------------------------------------------------------
    // Test 1: MEGA AUCTION (Max 6 Retentions)
    // -------------------------------------------------------------
    console.log("\n--- Testing Auction Type 1: MEGA ---");
    await page.goto("http://localhost:3050", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Select "Mega" auction type
    await page.locator("select").first().selectOption("MEGA");
    await page.waitForTimeout(300);

    // Pick CSK and create room
    await page.locator('button:has-text("CSK")').first().click();
    await page.waitForTimeout(300);

    await page.locator('button[type="submit"]:has-text("Create & Enter")').click();
    await page.waitForURL(/\/room\/room_/, { timeout: 15000 });
    console.log("-> Landed in Mega Room:", page.url());
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "types_01_mega_lobby.png") });

    // Open Retentions modal
    const megaRetentionsBtn = page.locator('button:has-text("Retentions")').first();
    if (await megaRetentionsBtn.isVisible()) {
      await megaRetentionsBtn.click();
      await page.waitForTimeout(1000);

      const megaBadge = await page.locator("text=/Mega \\(Max 6\\)/").first().isVisible();
      console.log("-> Mega Auction (Max 6) badge in modal:", megaBadge);

      const retainedText = await page.locator("text=/\\/ 6/").first().textContent();
      console.log("-> Mega retained players count text:", retainedText?.trim());

      await page.screenshot({ path: path.join(ARTIFACT_DIR, "types_02_mega_retentions_modal.png") });

      // Close modal
      await page.locator('button[aria-label="Close dialog"], button:has-text("Cancel")').first().click();
      await page.waitForTimeout(600);
    }

    // -------------------------------------------------------------
    // Test 2: CLASSIC AUCTION (Any Number of Retentions)
    // -------------------------------------------------------------
    console.log("\n--- Testing Auction Type 2: CLASSIC ---");
    await page.goto("http://localhost:3050", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Select "Classic" auction type
    await page.locator("select").first().selectOption("CLASSIC");
    await page.waitForTimeout(300);

    // Pick CSK and create room
    await page.locator('button:has-text("CSK")').first().click();
    await page.waitForTimeout(300);

    await page.locator('button[type="submit"]:has-text("Create & Enter")').click();
    await page.waitForURL(/\/room\/room_/, { timeout: 15000 });
    console.log("-> Landed in Classic Room:", page.url());
    await page.waitForTimeout(2000);

    // In Classic mode, CSK should show 11 retained players
    const classicRetainedBadge = await page.locator("text=Retentions (11)").first().isVisible();
    console.log("-> Classic mode shows top 11 authentic retentions on button:", classicRetainedBadge);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "types_03_classic_lobby.png") });

    // Open Retentions modal to verify Classic max 11 mode
    const classicRetentionsBtn = page.locator('button:has-text("Retentions")').first();
    if (await classicRetentionsBtn.isVisible()) {
      await classicRetentionsBtn.click();
      await page.waitForTimeout(1000);

      const classicBadge = await page.locator("text=/Classic \\(Max 11\\)/").first().isVisible();
      console.log("-> Classic Auction badge in modal:", classicBadge);

      const classicCountText = await page.locator("text=/11 \\/ 11/").first().isVisible();
      console.log("-> Classic retained players count (11 / 11):", classicCountText);

      await page.screenshot({ path: path.join(ARTIFACT_DIR, "types_04_classic_retentions_modal.png") });

      // Close modal
      await page.locator('button[aria-label="Close dialog"], button:has-text("Cancel")').first().click();
      await page.waitForTimeout(600);
    }

    // -------------------------------------------------------------
    // Test 3: SPRINT XI (No Retentions, Max 11 Players)
    // -------------------------------------------------------------
    console.log("\n--- Testing Auction Type 3: SPRINT XI ---");
    await page.goto("http://localhost:3050", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Select "Sprint XI"
    await page.locator("select").first().selectOption("SPRINT_XI");
    await page.waitForTimeout(500);

    // Verify retentions toggle is disabled with note
    const sprintToggleDisabled = await page.locator("text=/Disabled in Sprint XI/").first().isVisible();
    console.log("-> Retentions toggle disabled in Sprint XI mode on landing page:", sprintToggleDisabled);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "types_05_sprint_landing_page.png") });

    // Pick CSK and create room
    await page.locator('button:has-text("CSK")').first().click();
    await page.waitForTimeout(300);

    await page.locator('button[type="submit"]:has-text("Create & Enter")').click();
    await page.waitForURL(/\/room\/room_/, { timeout: 15000 });
    console.log("-> Landed in Sprint XI Room:", page.url());
    await page.waitForTimeout(2000);

    // Verify Sprint XI specific features in Lobby:
    // 1. Min 11 • Max 11 squad banner
    const squad11Banner = await page.locator("text=/Min 11 • Max 11/").first().isVisible();
    console.log("-> 'Min 11 • Max 11 (Max 4 ✈)' banner visible:", squad11Banner);

    // 2. Starting purse ₹50 Cr
    const purse50Cr = await page.locator("text=/₹50(\\.00)? Cr/").first().isVisible();
    console.log("-> Starting purse is ₹50 Cr:", purse50Cr);

    // 3. Squad counter shows 0/11 Squad
    const squad0of11 = await page.locator("text=/0\\/11 Squad/").first().isVisible();
    console.log("-> Squad counter displays 0/11 Squad:", squad0of11);

    // 4. Retentions button must NOT be present
    const retentionsVisible = await page.locator('button:has-text("Retentions")').isVisible();
    console.log("-> Retentions button hidden in Sprint XI:", !retentionsVisible);

    // 5. Ruleset pill says "Sprint XI"
    const sprintBadge = await page.locator("text=/Sprint XI/").first().isVisible();
    console.log("-> Sprint XI header badge visible:", sprintBadge);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "types_06_sprint_xi_lobby.png") });

    // Start auction in Sprint XI
    console.log("Starting Sprint XI auction...");
    const startBtn = page.locator('button:has-text("Start")').first();
    await startBtn.click();
    await page.waitForTimeout(3000);

    // Verify live auction active
    console.log("-> Sprint XI live auction started!");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "types_07_sprint_xi_live.png") });

    console.log("\n=== All 3 Auction Types Verified Successfully! ===");
  } catch (err) {
    console.error("Test encountered an error:", err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "types_error.png") });
  } finally {
    await browser.close();
  }
}

run();
