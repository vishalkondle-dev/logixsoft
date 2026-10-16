import { chromium } from "playwright";
import * as path from "path";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493";

async function capture() {
  const browser = await chromium.launch({ headless: true });

  // 1. Setup a live auction room
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Navigating to http://localhost:3050...");
  await page.goto("http://localhost:3050", { waitUntil: "networkidle" });
  const nameInput = page.locator('input[placeholder*="Enter your name"]');
  if (await nameInput.isVisible()) {
    await nameInput.fill("Dhoni Captain");
  }
  await page.locator('button:has-text("CSK")').first().click();
  await page.locator('button[type="submit"]:has-text("Create & Enter")').click();
  await page.waitForURL(/\/room\/room_/, { timeout: 15000 });

  const roomUrl = page.url();
  console.log("Landed in room:", roomUrl);

  // Click start auction
  await page.waitForTimeout(1000);
  const startBtn = page.locator('button:has-text("Start")').first();
  if (await startBtn.isVisible()) {
    await startBtn.click();
    console.log("Clicked Start Auction!");
  }

  // Wait 4 seconds for bot bidding to activate
  await page.waitForTimeout(4000);

  // 1. Capture Computer Viewport (1440 x 900)
  console.log("Capturing Computer view (1440x900)...");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "screen_computer.png") });

  // 2. Capture Tablet Viewport (768 x 1024) - Standard iPad
  console.log("Capturing Tablet view (768x1024)...");
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "screen_tablet.png") });

  // 3. Capture Mobile Viewport (390 x 750) - Realistic average mobile viewport with browser chrome
  console.log("Capturing Mobile view (390x750)...");
  await page.setViewportSize({ width: 390, height: 750 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "screen_mobile.png") });

  await browser.close();
  console.log("Done capturing all 3 devices!");
}

capture().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
