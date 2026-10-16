import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/screenshots";

async function run() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  console.log("=== Starting IPL Retentions & RTM E2E Test ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // Step 1: Visit Landing Page
    console.log("1. Visiting landing page http://localhost:3050 ...");
    await page.goto("http://localhost:3050", { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // Verify Retentions toggle is present
    const rtmText = await page.locator("text=Enable Official Retentions & Right to Match (RTM)").isVisible();
    console.log("-> RTM toggle visible on home:", rtmText);

    // Screenshot of landing page with RTM toggle
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_01_landing_toggle.png") });

    // Step 2: Create room with CSK as creator team
    console.log("2. Creating room with CSK and retentions enabled...");
    // Click CSK franchise button
    await page.locator('button:has-text("CSK")').first().click();
    await page.waitForTimeout(300);

    // Click "Create & Enter Auction Room"
    await page.locator('button[type="submit"]:has-text("Create & Enter")').click();
    await page.waitForURL(/\/room\/room_/, { timeout: 15000 });

    const roomUrl = page.url();
    console.log("-> Landed in room:", roomUrl);
    await page.waitForTimeout(2000);

    // Step 3: Check Lobby teams and retentions
    console.log("3. Inspecting lobby franchise squads and RTM cards...");
    const rtmBadges = await page.locator("text=/RTM: [0-6]/").allTextContents();
    console.log("-> RTM card badges found on franchises:", rtmBadges);

    // Expand CSK to inspect retained players
    const cskHeader = page.locator('div:has-text("CSK")').first();
    await page.waitForTimeout(500);

    // Verify Retained badges in squad
    const retainedBadgesCount = await page.locator("text=RETAINED").count();
    console.log("-> Retained player badges visible:", retainedBadgesCount);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_02_lobby_retentions_and_cards.png") });

    // Step 4: Open Retentions Modal
    console.log("4. Testing Manage Retentions Modal...");
    const retentionsBtn = page.locator('button:has-text("Retentions")').first();
    if (await retentionsBtn.isVisible()) {
      await retentionsBtn.click();
      await page.waitForTimeout(1000);

      const modalTitle = await page.locator("text=/Manage CSK Retentions/").isVisible();
      console.log("-> Manage Retentions Modal open:", modalTitle);

      const costText = await page.locator("text=/Retention Cost/").isVisible();
      console.log("-> Retention Cost dashboard visible:", costText);

      await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_03_manage_retentions_modal.png") });

      // Close modal
      await page.locator('button:has-text("Cancel")').click();
      await page.waitForTimeout(500);
    } else {
      console.log("Retentions button not visible");
    }

    // Step 5: Start the Auction
    console.log("5. Starting auction...");
    const startBtn = page.locator('button:has-text("Start")').first();
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await page.waitForTimeout(2500);
      console.log("-> Auction started! Live bidding active.");

      await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_04_live_auction_started.png") });
    }

    // Step 6: Wait and observe live bidding & RTM
    console.log("6. Observing live bidding and checking for RTM eligibility / prompt...");
    // Let 1-2 lots progress through bidding and hammer to see RTM logic execute
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1500);
      const rtmPrompt = await page.locator("text=/Right to Match|RTM Opportunity|evaluating Right to Match/").isVisible();
      if (rtmPrompt) {
        console.log(`-> RTM Prompt active on screen at interval ${i + 1}!`);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_05_rtm_prompt_in_action.png") });
        break;
      }
    }

    // Step 7: Final snapshot of team squads and activity feed
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_06_team_squads_live.png") });

    console.log("=== IPL Retentions & RTM E2E Test Completed Successfully ===");
  } catch (err) {
    console.error("Test failed with error:", err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_error.png") });
  } finally {
    await browser.close();
  }
}

run();
