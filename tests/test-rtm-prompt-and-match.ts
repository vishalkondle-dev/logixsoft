import { chromium } from "playwright";
import * as path from "path";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/screenshots";
const ROOM_ID = "room_1792048112220_mg0b";
const USER_ID = "usr_1792048112211_n39iipr";

async function run() {
  console.log("=== Reconnecting to Paused Room to Trigger RTM Decision ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // First load domain to establish storage context
  await page.goto("http://localhost:3050", { waitUntil: "networkidle" });
  await page.evaluate(
    ({ uid, rId }) => {
      localStorage.setItem("ipl_auction_user_id", uid);
      localStorage.setItem(`ipl_claimed_team_${rId}`, "CSK");
    },
    { uid: USER_ID, rId: ROOM_ID }
  );

  // Now navigate directly to the room
  console.log(`Navigating to http://localhost:3050/room/${ROOM_ID}...`);
  await page.goto(`http://localhost:3050/room/${ROOM_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // If paused, click Resume Auction button
  const resumeBtn = page.locator('button:has-text("Resume")');
  if (await resumeBtn.isVisible()) {
    console.log("Room is paused; clicking Resume button...");
    await resumeBtn.click();
  }

  console.log("Waiting for hammer countdown to reach 0 and trigger RTM Prompt...");

  let rtmPromptCaptured = false;
  for (let i = 0; i < 120; i++) {
    await page.waitForTimeout(500);

    const matchBtn = page.locator('button:has-text("Match & Retain")').first();
    const isModalVisible = await matchBtn.isVisible();

    if (isModalVisible) {
      console.log(`[RTM PROMPT DETECTED!]`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_11_interactive_decision_modal.png") });
      rtmPromptCaptured = true;

      // Click "Match & Retain" to exercise RTM card
      console.log("CSK owner clicking 'Match & Retain' button to match RCB bid!");
      await matchBtn.click();

      // Wait for sold resolution and updated squad
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_12_rtm_exercised_sold.png") });
      console.log("RTM exercised successfully and screenshot captured!");
      break;
    }
  }

  if (!rtmPromptCaptured) {
    console.log("RTM prompt not seen within timeout, taking debug shot");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_resume_debug.png") });
  }

  await browser.close();
  console.log("=== Test Complete ===");
}

run().catch((err) => {
  console.error("Error running test:", err);
  process.exit(1);
});
