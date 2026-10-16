import { chromium } from "playwright";
import * as path from "path";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Set name in localStorage before navigation
  await page.addInitScript(() => {
    localStorage.setItem("ipl_auction_user_name", "Auctioneer Pro");
  });

  // Navigate directly to room A1C2E3
  console.log("Navigating to http://localhost:3050/room/A1C2E3...");
  await page.goto("http://localhost:3050/room/A1C2E3", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Capture navbar with code pill
  console.log("Capturing room_code_navbar.png...");
  await page.screenshot({ path: path.join(ARTIFACT_DIR, "room_code_navbar.png") });

  await browser.close();
  console.log("Captured room_code_navbar.png successfully!");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
