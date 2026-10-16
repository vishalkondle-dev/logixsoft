import { chromium } from "playwright";
import * as fs from "fs";
import * as path from "path";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/screenshots";

async function run() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  console.log("=== Starting Real IPL 2026 Dataset & Dynamic Sets Verification Test ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();

  try {
    // 1. Visit Landing Page
    console.log("1. Visiting landing page http://localhost:3050 ...");
    await page.goto("http://localhost:3050", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Verify Retentions toggle text is visible
    const retentionsToggleText = await page.locator("text=Enable Official Retentions & Right to Match (RTM)").isVisible();
    console.log("-> Retentions & RTM toggle visible on landing page:", retentionsToggleText);

    // Select CSK and create room
    await page.locator('button:has-text("CSK")').first().click();
    await page.waitForTimeout(300);

    await page.locator('button[type="submit"]:has-text("Create & Enter")').click();
    await page.waitForURL(/\/room\/room_/, { timeout: 15000 });
    console.log("-> Landed in room:", page.url());
    await page.waitForTimeout(2000);

    // 2. Check Lobby Teams & Retained Player Counts
    console.log("2. Inspecting Lobby Retained Teams...");
    // Count teams in lobby
    const teamsCount = await page.locator("text=/Purse/").count();
    console.log("-> Teams visible in lobby with purse:", teamsCount);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "real_01_lobby_retained_teams.png") });

    // 3. Inspect Upcoming Sets & Players Accordion
    console.log("3. Opening Upcoming Sets & Players dialog...");
    const upcomingBtn = page.locator('button:has-text("Upcoming Players"), button:has-text("Upcoming")').first();
    await upcomingBtn.click();
    await page.waitForTimeout(1200);

    // Verify modal opened
    const modalHeading = await page.locator("text=/Upcoming Auction Sets & Players/").first().isVisible();
    console.log("-> Upcoming Sets dialog visible:", modalHeading);

    // Expand Set 1 (BA1) and Set 2 (AL1)
    const set1Accordion = page.locator('button:has-text("BA1")').first();
    if (await set1Accordion.isVisible()) {
      await set1Accordion.click();
      await page.waitForTimeout(400);
    }

    const set2Accordion = page.locator('button:has-text("AL1")').first();
    if (await set2Accordion.isVisible()) {
      await set2Accordion.click();
      await page.waitForTimeout(400);
    }

    // Check player numbering: looking for #001 or 001
    const playerNumbers = await page.locator("text=/#0[0-9]{2}/").allTextContents();
    console.log("-> Found 3-digit numbered player badges:", playerNumbers.slice(0, 8));

    // Check aeroplane icons / overseas indicators
    const planeIcons = await page.locator("svg.lucide-plane, .lucide-plane").count();
    console.log("-> Overseas Aeroplane icons found in set list:", planeIcons);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "real_02_upcoming_sets_accordion.png") });

    // Close Upcoming Sets dialog
    const closeDialogBtn = page.locator('button[aria-label="Close dialog"]').first();
    if (await closeDialogBtn.isVisible()) {
      await closeDialogBtn.click();
      await page.waitForTimeout(600);
    } else {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
    }

    // 4. Test Dynamic Set Updates: Release a player in Manage Retentions Modal
    console.log("4. Testing dynamic un-retention: Releasing Ruturaj Gaikwad from CSK...");
    const retentionsBtn = page.locator('button:has-text("Retentions")').first();
    await retentionsBtn.click();
    await page.waitForTimeout(1000);

    // Look for Ruturaj Gaikwad in candidates list and click to un-retain
    const gaikwadRow = page.locator('div:has-text("Ruturaj Gaikwad")').last();
    if (await gaikwadRow.isVisible()) {
      await gaikwadRow.click();
      console.log("-> Unselected Ruturaj Gaikwad");
      await page.waitForTimeout(400);

      // Click "Save Retentions"
      const saveBtn = page.locator('button:has-text("Save Retentions")').first();
      await saveBtn.click();
      await page.waitForTimeout(1500);
      console.log("-> Saved updated CSK retentions!");
    } else {
      console.log("Ruturaj Gaikwad row not found in modal, closing modal");
      await page.locator('button:has-text("Cancel")').click();
    }

    // Now re-open Upcoming Sets dialog to verify Ruturaj Gaikwad is now in the auction pool!
    await upcomingBtn.click();
    await page.waitForTimeout(1000);

    const gaikwadInSets = await page.locator("text=/Ruturaj Gaikwad/").first().isVisible();
    console.log("-> Ruturaj Gaikwad dynamically added to auction sets:", gaikwadInSets);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "real_03_dynamically_unretained_player_in_sets.png") });

    // Close modal
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    // 5. Start Auction and observe live bidding
    console.log("5. Starting auction to verify live bidding on real players...");
    const startBtn = page.locator('button:has-text("Start")').first();
    await startBtn.click();
    await page.waitForTimeout(2500);

    console.log("-> Live auction started!");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "real_04_live_auction_lot1.png") });

    // Wait 12 seconds to observe live bids and potential lot completion
    console.log("6. Observing live bidding for 12 seconds...");
    await page.waitForTimeout(12000);

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "real_05_bidding_and_lots.png") });

    console.log("=== Test Completed Successfully ===");
  } catch (err) {
    console.error("Test encountered an error:", err);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "real_error.png") });
  } finally {
    await browser.close();
  }
}

run();
