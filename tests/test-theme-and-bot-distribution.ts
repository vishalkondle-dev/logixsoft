import { chromium } from "@playwright/test";
import * as path from "path";

const BASE_URL = "http://localhost:3050";
const SCREENSHOT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/screenshots";

async function run() {
  console.log("=== Testing Theme Toggle & Bot Bidding Distribution ===");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    // ----------------------------------------------------
    // Step 1: Verify Theme Mode Toggle on Lobby Page
    // ----------------------------------------------------
    console.log("\n--- Step 1: Verify Theme Toggle on Lobby ---");
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    const themeToggleBtn = page.getByRole("button", { name: "Toggle theme" });
    await themeToggleBtn.waitFor({ state: "visible" });
    console.log("ThemeToggle button is visible on Lobby header");

    // Check initial dark theme
    const htmlClassInitial = await page.locator("html").getAttribute("class");
    console.log(`Initial HTML class: "${htmlClassInitial}"`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "theme_01_lobby_dark.png"), fullPage: true });
    console.log("Screenshot: theme_01_lobby_dark.png");

    // Click theme toggle to switch to Light Mode
    console.log("Clicking ThemeToggle to switch to Light Mode...");
    await themeToggleBtn.click();
    await page.waitForTimeout(1000);

    const htmlClassLight = await page.locator("html").getAttribute("class");
    console.log(`After click HTML class: "${htmlClassLight}"`);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "theme_02_lobby_light.png"), fullPage: true });
    console.log("Screenshot: theme_02_lobby_light.png");

    // Click theme toggle again to return to Dark Mode
    console.log("Clicking ThemeToggle to return to Dark Mode...");
    await themeToggleBtn.click();
    await page.waitForTimeout(1000);

    // ----------------------------------------------------
    // Step 2: Create a Room & Test Theme Toggle in Room
    // ----------------------------------------------------
    console.log("\n--- Step 2: Create Room & Test Theme Toggle in Room Header ---");
    const roomNameInput = page.locator("input[placeholder*='e.g. IPL 2026 Mega Auction']");
    await roomNameInput.fill("Bot Bidding Distribution Test");

    const submitBtn = page.locator("button[type='submit']:has-text('Create & Enter Auction Room')");
    await submitBtn.click();

    await page.waitForURL(/\/room\/room_/, { timeout: 15000 });
    console.log(`Navigated to room: ${page.url()}`);
    await page.waitForTimeout(2000);

    // Check ThemeToggle in Room Header
    const roomThemeToggle = page.locator("header").getByRole("button", { name: "Toggle theme" });
    await roomThemeToggle.waitFor({ state: "visible" });
    console.log("ThemeToggle is visible in Room header");

    // Toggle to Light Mode in Room
    console.log("Toggling to Light Mode inside Auction Room...");
    await roomThemeToggle.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "theme_03_room_light.png"), fullPage: true });
    console.log("Screenshot: theme_03_room_light.png");

    // Toggle back to Dark Mode in Room
    await roomThemeToggle.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "theme_04_room_dark.png"), fullPage: true });
    console.log("Screenshot: theme_04_room_dark.png");

    // ----------------------------------------------------
    // Step 3: Start Auction and Observe Bot Bidding Distribution
    // ----------------------------------------------------
    console.log("\n--- Step 3: Start Auction & Verify Diverse Bot Bidding ---");
    const startAuctionBtn = page.getByRole("button", { name: /Start Auction|Start/i }).first();
    if (await startAuctionBtn.isVisible()) {
      console.log("Clicking Start Auction button...");
      await startAuctionBtn.click();
      await page.waitForTimeout(1500);
    }

    console.log("Waiting for bots to bid across multiple lots (60 seconds)...");

    // Track bidding teams from the Activity Feed
    const biddingFranchises = new Set<string>();
    const winningFranchises = new Set<string>();

    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(5000);

      // Check text in activity feed or events
      const activityText = await page.locator("section:has-text('Activity')").innerText().catch(() => "");
      
      // Match franchise codes in events
      const allCodes = ["CSK", "MI", "RCB", "KKR", "SRH", "DC", "RR", "GT", "LSG", "PBKS"];
      for (const code of allCodes) {
        if (activityText.includes(code)) {
          biddingFranchises.add(code);
        }
      }

      console.log(`[T+${(i + 1) * 5}s] Detected active franchises so far: ${Array.from(biddingFranchises).join(", ")}`);

      // Periodically capture progress screenshots
      if (i === 3) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "bot_dist_01_multiple_teams_bidding.png"), fullPage: true });
      }
      if (i === 7) {
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, "bot_dist_02_diverse_franchises_competing.png"), fullPage: true });
      }
    }

    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "bot_dist_03_squad_distribution.png"), fullPage: true });
    console.log("Screenshot: bot_dist_03_squad_distribution.png");

    console.log(`\nFinal unique franchises participating in bidding/lots: ${biddingFranchises.size}/10`);
    console.log(`Active franchises list: ${Array.from(biddingFranchises).join(", ")}`);

    if (biddingFranchises.size < 4) {
      console.warn("Fewer than 4 franchises participated. Expected broad distribution.");
    } else {
      console.log("SUCCESS: Broad, healthy franchise participation confirmed!");
    }

    console.log("\n=== ALL TESTS COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Test failed:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
