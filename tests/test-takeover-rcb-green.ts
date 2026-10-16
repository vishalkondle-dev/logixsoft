import { chromium } from "playwright";
import * as path from "path";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/screenshots";
const ROOM_ID = "room_1792048112220_mg0b";
const USER_ID = `usr_rcb_owner_${Date.now()}`;

async function run() {
  console.log("=== Testing Human Takeover of RCB & Exercising RTM for Cameron Green ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Visit landing page to set fresh user ID with no claimed team
  await page.goto("http://localhost:3050", { waitUntil: "networkidle" });
  await page.evaluate(
    ({ uid, rId }) => {
      localStorage.setItem("ipl_auction_user_id", uid);
      localStorage.removeItem(`ipl_claimed_team_${rId}`);
    },
    { uid: USER_ID, rId: ROOM_ID }
  );

  // 2. Open room
  console.log(`Navigating to http://localhost:3050/room/${ROOM_ID}...`);
  await page.goto(`http://localhost:3050/room/${ROOM_ID}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // 3. Click Take Over on Challengers (RCB)
  console.log("Looking for Challengers (RCB) Take Over button...");
  const rcbTakeOverBtn = page.locator('div:has-text("Challengers") button:has-text("Take Over")').first();
  if (await rcbTakeOverBtn.isVisible()) {
    console.log("Clicking 'Take Over' button for Royal Challengers Bengaluru (RCB)...");
    await rcbTakeOverBtn.click();
    await page.waitForTimeout(1500);
  } else {
    console.log("RCB Take Over button not immediately visible; trying alternate selector");
    await page.locator('button:has-text("Take Over")').nth(1).click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  // 4. Resume if paused
  const resumeBtn = page.locator('button:has-text("Resume")').first();
  if (await resumeBtn.isVisible()) {
    console.log("Room paused; clicking Resume button...");
    await resumeBtn.click();
    await page.waitForTimeout(1000);
  }

  console.log("Waiting for Cameron Green hammer countdown to hit 0 and trigger RCB RTM prompt...");

  let rtmCaptured = false;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);

    const matchBtn = page.locator('button:has-text("Match & Retain")').first();
    const isModalVisible = await matchBtn.isVisible();

    if (isModalVisible) {
      console.log(`[RTM PROMPT MODAL DETECTED FOR RCB AT INTERVAL ${i + 1}!]`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_11_interactive_decision_modal.png") });
      rtmCaptured = true;

      // Click "Match & Retain"
      console.log("RCB Human Owner: Clicking 'Match & Retain' to exercise RTM card!");
      await matchBtn.click();

      // Wait for sold resolution and updated squad
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_12_rtm_exercised_sold.png") });
      console.log("RTM exercised and resolution screenshot captured!");
      break;
    }
  }

  if (!rtmCaptured) {
    console.log("RTM modal did not appear; taking debug screenshot");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_rcb_debug.png") });
  }

  await browser.close();
  console.log("=== RCB RTM Test Finished ===");
}

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
