import { chromium } from "playwright";
import * as path from "path";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/screenshots";

async function run() {
  console.log("=== Capturing Live RTM Prompt and Decision ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Create a room through the UI with CSK
  await page.goto("http://localhost:3050", { waitUntil: "networkidle" });
  await page.locator('button:has-text("CSK")').first().click();
  await page.locator('button[type="submit"]:has-text("Create & Enter")').click();
  await page.waitForURL(/\/room\/room_/, { timeout: 15000 });

  console.log("In room:", page.url());
  await page.waitForTimeout(1500);

  // 2. Start the auction
  await page.locator('button:has-text("Start")').first().click();
  console.log("Auction started, waiting for bidding and hammer zero...");

  // 3. Monitor for RTM prompt (up to 90 seconds to allow bidding to calm down and hammer to fall)
  let captured = false;
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(1000);

    const isRtmActive = await page.locator("text=/Right to Match|Match & Retain|evaluating Right to Match/").first().isVisible();
    if (isRtmActive) {
      console.log(`-> RTM Prompt detected at ${i + 1}s!`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_11_interactive_decision_modal.png") });
      captured = true;

      // Check if human decision prompt is open (Match & Retain button)
      const matchBtn = page.locator('button:has-text("Match & Retain")');
      if (await matchBtn.isVisible()) {
        console.log("CSK Human Owner: Clicking 'Match & Retain' to exercise RTM card!");
        await matchBtn.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_12_rtm_exercised_sold.png") });
      }
      break;
    }
  }

  if (!captured) {
    console.log("RTM prompt not triggered within 60s, taking fallback live arena screenshot");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_11_arena_timeout.png") });
  }

  await browser.close();
  console.log("=== Capture Complete ===");
}

run();
