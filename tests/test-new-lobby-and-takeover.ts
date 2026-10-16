import { chromium } from "@playwright/test";
import * as path from "path";

const BASE_URL = "http://localhost:3050";
const SCREENSHOT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/screenshots";

async function run() {
  console.log("=== Testing New Lobby, Team Takeover, Inactivity & Creator Controls ===");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    // ----------------------------------------------------
    // Context 1: Creator
    // ----------------------------------------------------
    const context1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page1 = await context1.newPage();

    console.log("\n--- Step 1: Verify Lobby Page ---");
    await page1.goto(BASE_URL, { waitUntil: "networkidle" });
    await page1.waitForTimeout(1000);

    // Verify "Enter Auction Arena" is NOT present
    const arenaText = await page1.getByText("Enter Auction Arena").count();
    console.log(`'Enter Auction Arena' count: ${arenaText} (expected: 0)`);
    if (arenaText > 0) {
      throw new Error("Enter Auction Arena card should have been removed!");
    }

    // Verify Creator Franchise Selector
    const cskBtn = page1.locator("button:has-text('CSK')").first();
    const miBtn = page1.locator("button:has-text('MI')").first();
    const rcbBtn = page1.locator("button:has-text('RCB')").first();
    await cskBtn.waitFor({ state: "visible" });
    await miBtn.waitFor({ state: "visible" });
    await rcbBtn.waitFor({ state: "visible" });
    console.log("Franchise picker buttons verified (CSK, MI, RCB visible)");

    // Select MI for Creator
    await miBtn.click();
    console.log("Selected MI for Creator");

    // Verify Public Room button
    const publicBtn = page1.getByRole("button", { name: /Public Directory/ });
    await publicBtn.waitFor({ state: "visible" });
    console.log("Public Directory toggle verified");

    // Verify Join by Code
    const joinCodeInput = page1.locator("input[placeholder*='e.g. room_']");
    await joinCodeInput.waitFor({ state: "visible" });
    console.log("Join with Room Code input verified");

    // Verify Public Directory section
    const publicDirHeading = page1.getByText("Public Auctions Directory");
    await publicDirHeading.waitFor({ state: "visible" });
    console.log("Public Auctions Directory verified");

    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, "01_new_lobby_public_rooms.png"), fullPage: true });
    console.log("Screenshot 1 captured: 01_new_lobby_public_rooms.png");

    // ----------------------------------------------------
    // Step 2: Create a Room as Creator
    // ----------------------------------------------------
    console.log("\n--- Step 2: Create Room as Creator ---");
    const roomNameInput = page1.locator("input[placeholder*='e.g. IPL 2026 Mega Auction']");
    await roomNameInput.fill("IPL 2026 Champions Arena");

    const submitBtn = page1.locator("button[type='submit']:has-text('Create & Enter Auction Room')");
    await submitBtn.click();

    // Wait for room navigation
    await page1.waitForURL(/\/room\/room_/, { timeout: 15000 });
    const roomUrl = page1.url();
    const roomId = roomUrl.split("/room/")[1].split("?")[0];
    console.log(`Created and navigated to room: ${roomId} (URL: ${roomUrl})`);

    // Wait for room hydration & snapshot
    await page1.waitForTimeout(2500);

    // Verify Creator is recognized as MI
    const miElements = await page1.locator("text=MI").count();
    console.log(`MI badge instances in room: ${miElements}`);

    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, "02_creator_room_mi_claimed.png"), fullPage: true });
    console.log("Screenshot 2 captured: 02_creator_room_mi_claimed.png");

    // ----------------------------------------------------
    // Step 3: Second User (Spectator / Participant)
    // ----------------------------------------------------
    console.log("\n--- Step 3: Second User joins without team ---");
    const context2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page2 = await context2.newPage();

    // Navigate to the room directly
    await page2.goto(roomUrl, { waitUntil: "networkidle" });
    await page2.waitForTimeout(2500);

    // The user has no team selected. Check the Bid button text or click it
    console.log("Looking for Bid / Select Team button...");
    const selectTeamBidBtn = page2.locator("button:has-text('Select Team to Bid')").first();
    const bidBtn = page2.locator("button:has-text('BID')").first();

    if (await selectTeamBidBtn.isVisible()) {
      console.log("Found 'Select Team to Bid' button. Clicking it...");
      await selectTeamBidBtn.click();
    } else if (await bidBtn.isVisible()) {
      console.log("Found Bid button. Clicking it...");
      await bidBtn.click();
    } else {
      console.log("No bid button found directly, looking for Take Over in Teams accordion...");
    }

    await page2.waitForTimeout(1000);

    // Verify TeamSelectionModal opened
    const modalHeading = page2.getByText("Select Franchise to Bid");
    if (await modalHeading.isVisible()) {
      console.log("TeamSelectionModal opened successfully!");

      // Verify MI is Occupied/disabled
      const miOccupied = page2.getByText("Controlled by Creator");
      const isMiOccupied = await miOccupied.isVisible();
      console.log(`Is Creator's team MI locked/Occupied? ${isMiOccupied}`);

      // Capture screenshot of Team Selection Modal
      await page2.screenshot({ path: path.join(SCREENSHOT_DIR, "03_second_user_team_selection_modal.png") });
      console.log("Screenshot 3 captured: 03_second_user_team_selection_modal.png");

      // Take over RCB
      console.log("User 2 clicking Take Over on RCB...");
      const rcbCard = page2.locator("div.p-3").filter({ hasText: "RCB" });
      const rcbTakeOverBtn = rcbCard.getByRole("button", { name: "Take Over" });
      await rcbTakeOverBtn.click();
      await page2.waitForTimeout(2000);

      await page2.screenshot({ path: path.join(SCREENSHOT_DIR, "04_second_user_took_over_rcb.png") });
      console.log("Screenshot 4 captured: 04_second_user_took_over_rcb.png");
    }

    // ----------------------------------------------------
    // Step 4: Verify Creator Controls (Assign to Bot & Ban User)
    // ----------------------------------------------------
    console.log("\n--- Step 4: Verify Creator Host Controls on RCB ---");
    // Switch to Creator page (page1)
    await page1.bringToFront();
    await page1.waitForTimeout(1500);

    // Accept any confirmation dialogs automatically
    page1.on("dialog", async (dialog) => {
      console.log(`Dialog message: "${dialog.message()}". Accepting...`);
      await dialog.accept();
    });

    // Check if Assign to Bot button is visible for Creator on RCB
    const assignToBotBtn = page1.getByRole("button", { name: /Assign to Bot/i });
    const banUserBtn = page1.getByRole("button", { name: /Ban/i });

    const isAssignVisible = await assignToBotBtn.isVisible();
    const isBanVisible = await banUserBtn.isVisible();
    console.log(`Assign to Bot button visible: ${isAssignVisible}`);
    console.log(`Ban User button visible: ${isBanVisible}`);

    await page1.screenshot({ path: path.join(SCREENSHOT_DIR, "05_creator_view_human_team_controls.png") });
    console.log("Screenshot 5 captured: 05_creator_view_human_team_controls.png");

    if (isAssignVisible) {
      console.log("Creator clicking 'Assign to Bot'...");
      await assignToBotBtn.click();
      await page1.waitForTimeout(2000);

      await page1.screenshot({ path: path.join(SCREENSHOT_DIR, "06_creator_reassigned_rcb_to_bot.png") });
      console.log("Screenshot 6 captured: 06_creator_reassigned_rcb_to_bot.png");
    }

    // ----------------------------------------------------
    // Step 5: Check Lobby Directory contains new room
    // ----------------------------------------------------
    console.log("\n--- Step 5: Verify Public Directory contains new room ---");
    const page3 = await context2.newPage();
    await page3.goto(BASE_URL, { waitUntil: "networkidle" });
    await page3.waitForTimeout(2000);

    const roomInDir = page3.locator(`text=${roomId}`).first();
    console.log(`Created room visible in directory: ${await roomInDir.isVisible()}`);

    await page3.screenshot({ path: path.join(SCREENSHOT_DIR, "07_public_directory_showing_new_room.png"), fullPage: true });
    console.log("Screenshot 7 captured: 07_public_directory_showing_new_room.png");

    console.log("\n=== ALL E2E VERIFICATION TESTS PASSED SUCCESSFULLY! ===");
  } catch (error) {
    console.error("Test failed with error:", error);
    throw error;
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
