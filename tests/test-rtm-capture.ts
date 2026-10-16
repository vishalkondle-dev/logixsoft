import { chromium } from "playwright";
import * as path from "path";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/screenshots";

async function run() {
  console.log("=== Testing RTM Flow and Capturing Screens ===");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Visit landing page
  await page.goto("http://localhost:3050", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  // Select CSK
  await page.locator('button:has-text("CSK")').first().click();
  await page.waitForTimeout(300);

  // Set AI difficulty to easy so bots don't engage in endless bid wars
  const easyBtn = page.locator('button:has-text("Easy")');
  if (await easyBtn.isVisible()) {
    await easyBtn.click();
    console.log("Selected AI Difficulty: Easy");
  }

  // Click Create & Enter
  await page.locator('button[type="submit"]:has-text("Create & Enter")').click();
  await page.waitForURL(/\/room\/room_/, { timeout: 15000 });
  const roomUrl = page.url();
  console.log("Entered room:", roomUrl);
  await page.waitForTimeout(1500);

  // Start Auction
  const startBtn = page.locator('button:has-text("Start")').first();
  await startBtn.click();
  console.log("Auction started! Monitoring lots and RTM events...");

  let rtmTriggered = false;
  const maxWaitSeconds = 120;

  for (let s = 0; s < maxWaitSeconds; s++) {
    await page.waitForTimeout(1000);

    // Check if RTM modal or banner is visible
    const matchBtn = page.locator('button:has-text("Match & Retain")');
    const rtmBanner = page.locator("text=/Right to Match|RTM Opportunity|evaluating Right to Match/").first();

    const isMatchVisible = await matchBtn.isVisible();
    const isBannerVisible = await rtmBanner.isVisible();

    if (isMatchVisible || isBannerVisible) {
      console.log(`[RTM Event Detected at ${s + 1}s]`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_11_interactive_decision_modal.png") });
      rtmTriggered = true;

      if (isMatchVisible) {
        console.log("Human CSK decision available! Clicking 'Match & Retain'...");
        await matchBtn.click();
        await page.waitForTimeout(2500);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_12_rtm_exercised_sold.png") });
      } else {
        console.log("Bot RTM evaluation active, waiting for resolution...");
        await page.waitForTimeout(3000);
        await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_12_rtm_exercised_sold.png") });
      }
      break;
    }

    if (s % 10 === 0 && s > 0) {
      const lotInfo = await page.locator("div.text-2xl.font-black, div.text-3xl.font-black").first().textContent().catch(() => "");
      console.log(`Still running at ${s}s... Current player: ${lotInfo?.trim()}`);
    }
  }

  if (!rtmTriggered) {
    console.log("RTM did not trigger within timeout; taking debug screenshot");
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "rtm_debug_current_state.png") });
  }

  await browser.close();
  console.log("=== Run Finished ===");
}

run().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
