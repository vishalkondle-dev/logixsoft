import { chromium } from "playwright";
import * as path from "path";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/screenshots";
const ROOM_ID = "room_1792048112220_mg0b";
const USER_ID = `usr_test_dc_${Date.now()}`;

async function run() {
  console.log("=== Testing Human Takeover of DC & Live RTM Exercise ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Establish storage credentials
  await page.goto("http://localhost:3050", { waitUntil: "networkidle" });
  await page.evaluate(
    ({ uid, rId }) => {
      localStorage.setItem("ipl_auction_user_id", uid);
      localStorage.setItem(`ipl_claimed_team_${rId}`, "DC");
    },
    { uid: USER_ID, rId: ROOM_ID }
  );

  // 2. Open room
  console.log(`Navigating to http://localhost:3050/room/${ROOM_ID}...`);
  await page.goto(`http://localhost:3050/room/${ROOM_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Check if we need to take over DC explicitly
  const dcTakeOverBtn = page.locator('div:has-text("Capitals") button:has-text("Take Over")').first();
  if (await dcTakeOverBtn.isVisible()) {
    console.log("Clicking 'Take Over' button for Delhi Capitals (DC)...");
    await dcTakeOverBtn.click();
    await page.waitForTimeout(1000);
  }

  // Resume room if paused
  const resumeBtn = page.locator('button:has-text("Resume")').first();
  if (await resumeBtn.isVisible()) {
    console.log("Clicking Resume button...");
    await resumeBtn.click();
  }

  console.log("Monitoring for Prithvi Shaw hammer fall & DC RTM Decision Modal...");

  let rtmCaptured = false;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(500);

    const matchBtn = page.locator('button:has-text("Match & Retain")').first();
    const isModalVisible = await matchBtn.isVisible();

    if (isModalVisible) {
      console.log(`[RTM PROMPT MODAL DETECTED FOR DC AT INTERVAL ${i + 1}!]`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_11_interactive_decision_modal.png") });
      rtmCaptured = true;

      // Click "Match & Retain"
      console.log("DC Human Owner: Clicking 'Match & Retain' to exercise RTM card!");
      await matchBtn.click();

      // Wait for sold resolution and updated squad
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_12_rtm_exercised_sold.png") });
      console.log("RTM exercised and resolution screenshot captured!");
      break;
    }
  }

  if (!rtmCaptured) {
    console.log("Taking debug screenshot if modal did not appear");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_dc_debug.png") });
  }

  await browser.close();
  console.log("=== DC RTM Test Completed ===");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
