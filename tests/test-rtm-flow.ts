import { chromium } from "playwright";
import * as path from "path";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/screenshots";

async function run() {
  console.log("=== Testing Direct RTM Trigger and Interactive Decision ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Create room with Retentions enabled and CSK as creator franchise
  const createRes = await fetch("http://localhost:8787/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "RTM Validation Room",
      creatorTeam: "CSK",
      ruleset: "MEGA",
      aiDifficulty: "normal",
      enableRetentions: true,
      isPublic: true,
    }),
  });

  const roomData = await createRes.json() as any;
  const roomId = roomData.roomId;
  console.log("Created room:", roomId);

  // Connect to room in browser
  await page.goto(`http://localhost:3050/room/${roomId}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Screenshot of CSK lobby with retentions and RTM cards
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_07_csk_lobby_retained.png") });

  // Open Retentions modal to show interactive checklist
  const retentionsBtn = page.locator('button:has-text("Retentions")').first();
  await retentionsBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_08_retentions_modal_detail.png") });

  // Close modal
  await page.locator('button:has-text("Cancel")').click();
  await page.waitForTimeout(400);

  // Start the auction
  await page.locator('button:has-text("Start")').first().click();
  await page.waitForTimeout(1500);

  console.log("Waiting for player bidding and checking for RTM event...");
  // Let the lots progress. Since SEED_PLAYERS have previous franchises (Devon Conway -> CSK, Cameron Green -> RCB, David Miller -> GT, etc.),
  // whenever any of these lots are bid on by another team and hammer strikes 0, RTM triggers!
  let rtmCaptured = false;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(1000);

    const rtmModal = await page.locator("text=/Right to Match|RTM Opportunity|evaluating Right to Match|Match & Retain/").first().isVisible();
    if (rtmModal) {
      console.log(`-> RTM Prompt captured at interval ${i + 1}!`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_09_rtm_decision_prompt.png") });
      rtmCaptured = true;
      break;
    }
  }

  if (!rtmCaptured) {
    console.log("Taking final screenshot of live arena");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_10_arena_live.png") });
  }

  await browser.close();
  console.log("=== RTM Flow Test Finished ===");
}

run();
