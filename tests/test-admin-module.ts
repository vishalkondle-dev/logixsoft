import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/screenshots";

async function runAdminModuleTests() {
  console.log("=== Testing Admin Module: Full Access & Functionalities ===");

  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();

  try {
    // 1. Authenticate as Admin
    console.log("1. Authenticating as Administrator...");
    await page.goto("http://localhost:3050", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Open Auth Modal and click IPL Commissioner (Admin)
    await page.locator('button:has-text("Sign In")').first().click();
    await page.waitForTimeout(500);

    const adminSignInBtn = page.locator('button:has-text("IPL Commissioner")').first();
    await adminSignInBtn.click();
    await page.waitForTimeout(1000);

    console.log("   Logged in as Administrator.");

    // 2. Test Admin Dashboard (/admin/dashboard)
    console.log("2. Navigating to /admin/dashboard...");
    await page.goto("http://localhost:3050/admin/dashboard", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const dashboardTitle = page.locator('text="IPL Auction Central Command"').first();
    if (!(await dashboardTitle.isVisible())) {
      throw new Error("Admin Dashboard title not visible");
    }

    const scrDashboard = path.join(ARTIFACT_DIR, "admin_01_dashboard.png");
    await page.screenshot({ path: scrDashboard, fullPage: false });
    console.log(`   Captured screenshot: ${scrDashboard}`);

    // 3. Test Live Rooms Management (/admin/rooms)
    console.log("3. Navigating to /admin/rooms...");
    await page.goto("http://localhost:3050/admin/rooms", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const roomsTitle = page.locator('text="Live Auction Room Management"').first();
    if (!(await roomsTitle.isVisible())) {
      throw new Error("Admin Rooms title not visible");
    }

    // Open Create Tournament Room Modal
    await page.locator('button:has-text("Create Tournament Room")').click();
    await page.waitForTimeout(500);

    const roomModal = page.locator('text="Launch Tournament Room"').first();
    if (!(await roomModal.isVisible())) {
      throw new Error("Create room modal failed to open");
    }

    // Create room
    await page.locator('button[type="submit"]:has-text("Initialize & Launch Room")').click();
    await page.waitForTimeout(1500);

    const scrRooms = path.join(ARTIFACT_DIR, "admin_02_rooms_management.png");
    await page.screenshot({ path: scrRooms, fullPage: false });
    console.log(`   Captured screenshot: ${scrRooms}`);

    // 4. Test Player Registry & Ingestion (/admin/players)
    console.log("4. Navigating to /admin/players...");
    await page.goto("http://localhost:3050/admin/players", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const playersTitle = page.locator('text="Player Master Registry & Ingestion"').first();
    if (!(await playersTitle.isVisible())) {
      throw new Error("Admin Players title not visible");
    }

    // Click "Add Player" button
    await page.locator('button:has-text("Add Player")').click();
    await page.waitForTimeout(500);

    // Fill form
    await page.locator('input[type="text"]').first().fill("Rohan Deshmukh");
    await page.locator('input[type="number"]').first().fill("55"); // matches
    await page.locator('button[type="submit"]:has-text("Create Player")').click();
    await page.waitForTimeout(1200);

    const scrPlayers = path.join(ARTIFACT_DIR, "admin_03_players_management.png");
    await page.screenshot({ path: scrPlayers, fullPage: false });
    console.log(`   Captured screenshot: ${scrPlayers}`);

    // 5. Test Franchise Configuration & Tactical Profiles (/admin/teams)
    console.log("5. Navigating to /admin/teams...");
    await page.goto("http://localhost:3050/admin/teams", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const teamsTitle = page.locator('h1:has-text("Franchise Configurations")').first();
    if (!(await teamsTitle.isVisible())) {
      throw new Error("Admin Teams title not visible");
    }

    // Open Edit Configuration on CSK
    await page.locator('button:has-text("Edit Configuration")').first().click();
    await page.waitForTimeout(500);

    const editTeamModal = page.locator('h2:has-text("Edit Franchise")').first();
    if (!(await editTeamModal.isVisible())) {
      throw new Error("Edit team modal failed to open");
    }

    const scrTeams = path.join(ARTIFACT_DIR, "admin_04_teams_configuration.png");
    await page.screenshot({ path: scrTeams, fullPage: false });
    console.log(`   Captured screenshot: ${scrTeams}`);

    // Close modal
    await page.locator('button:has-text("Cancel")').click();
    await page.waitForTimeout(300);

    // 6. Test Rulesets Management (/admin/rulesets)
    console.log("6. Navigating to /admin/rulesets...");
    await page.goto("http://localhost:3050/admin/rulesets", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const rulesTitle = page.locator('h1:has-text("Ruleset Definitions")').first();
    if (!(await rulesTitle.isVisible())) {
      throw new Error("Admin Rulesets title not visible");
    }

    const scrRulesets = path.join(ARTIFACT_DIR, "admin_05_rulesets_management.png");
    await page.screenshot({ path: scrRulesets, fullPage: false });
    console.log(`   Captured screenshot: ${scrRulesets}`);

    // 7. Test Sets Management (/admin/sets)
    console.log("7. Navigating to /admin/sets...");
    await page.goto("http://localhost:3050/admin/sets", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const scrSets = path.join(ARTIFACT_DIR, "admin_06_sets_management.png");
    await page.screenshot({ path: scrSets, fullPage: false });
    console.log(`   Captured screenshot: ${scrSets}`);

    // 8. Test Clef-Flash AI & Simulation (/admin/ai)
    console.log("8. Navigating to /admin/ai...");
    await page.goto("http://localhost:3050/admin/ai", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Click Simulate Valuation Decision
    const simBtn = page.locator('button:has-text("Simulate Valuation Decision")').first();
    await simBtn.click();
    await page.waitForTimeout(1500);

    const simOutcome = page.locator('text="Outcome:"').first();
    const isSimVisible = await simOutcome.isVisible();
    console.log("   AI Valuation Simulation outcome visible:", isSimVisible);

    const scrAI = path.join(ARTIFACT_DIR, "admin_07_ai_simulation.png");
    await page.screenshot({ path: scrAI, fullPage: false });
    console.log(`   Captured screenshot: ${scrAI}`);

    // 9. Test Live Chat Moderation & Broadcast (/admin/chat)
    console.log("9. Navigating to /admin/chat...");
    await page.goto("http://localhost:3050/admin/chat", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Broadcast an announcement
    const announceInput = page.locator('input[placeholder*="Official Notice"]').first();
    if (await announceInput.isVisible()) {
      await announceInput.fill("OFFICIAL ADMIN NOTICE: Tournament round starting in 2 minutes.");
      await page.locator('button:has-text("Broadcast")').first().click();
      await page.waitForTimeout(1200);
      console.log("   Admin announcement broadcasted.");
    }

    const scrChat = path.join(ARTIFACT_DIR, "admin_08_chat_moderation.png");
    await page.screenshot({ path: scrChat, fullPage: false });
    console.log(`   Captured screenshot: ${scrChat}`);

    // 10. Test Users & Roles (/admin/users)
    console.log("10. Navigating to /admin/users...");
    await page.goto("http://localhost:3050/admin/users", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const scrUsers = path.join(ARTIFACT_DIR, "admin_09_users_rbac.png");
    await page.screenshot({ path: scrUsers, fullPage: false });
    console.log(`   Captured screenshot: ${scrUsers}`);

    // 11. Test Audit Logs (/admin/audit-logs)
    console.log("11. Navigating to /admin/audit-logs...");
    await page.goto("http://localhost:3050/admin/audit-logs", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const scrAudit = path.join(ARTIFACT_DIR, "admin_10_audit_logs.png");
    await page.screenshot({ path: scrAudit, fullPage: false });
    console.log(`   Captured screenshot: ${scrAudit}`);

    console.log("\n ALL ADMIN MODULE TESTS COMPLETED SUCCESSFULLY!");
  } catch (err) {
    console.error("Test failed with error:", err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "admin_error.png") });
    process.exit(1);
  } finally {
    await browser.close();
  }
}

runAdminModuleTests();
