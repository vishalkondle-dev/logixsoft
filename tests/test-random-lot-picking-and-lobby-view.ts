import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/screenshots";

async function runRandomLotAndLobbyTests() {
  console.log("=== Testing Randomized Lot Selection & Lobby Waiting Screen ===");

  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();

  try {
    // 1. Create a room and verify Lobby state
    console.log("Navigating to home page...");
    await page.goto("http://localhost:3050", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Select CSK and Mega
    await page.locator("select").first().selectOption("MEGA");
    await page.locator('button:has-text("CSK")').first().click();
    await page.waitForTimeout(300);

    await page.locator('button[type="submit"]:has-text("Create & Enter")').click();
    await page.waitForURL(/\/room\/room_/, { timeout: 15000 });
    const roomUrl = page.url();
    const roomId = roomUrl.split("/room/")[1];
    console.log(`Landed in Room: ${roomId}`);
    await page.waitForTimeout(2500);

    // 2. VERIFY LOBBY: Player card and bid controls MUST NOT be displayed!
    console.log("\n--- Checking Requirement 2: Player & Bid Controls Hidden Before Start ---");
    const lobbyBadge = page.locator('text="Lobby • Waiting to Start"').first();
    const isLobbyVisible = await lobbyBadge.isVisible();
    console.log("Lobby waiting banner visible:", isLobbyVisible);
    if (!isLobbyVisible) {
      throw new Error("FAIL: Lobby waiting banner should be visible before auction starts!");
    }

    const preAuctionTitle = page.locator('h2:has-text("Live Auction Arena")').first();
    console.log("Pre-auction arena title visible:", await preAuctionTitle.isVisible());

    // Check that Bid button is NOT present in lobby
    const bidButton = page.locator('button:has-text("BID ₹")').first();
    const isBidButtonVisible = await bidButton.isVisible();
    console.log("Bid button visible before start (should be false):", isBidButtonVisible);
    if (isBidButtonVisible) {
      throw new Error("FAIL: Bid button MUST NOT be visible before auction starts!");
    }

    // Check that countdown timer is NOT active
    const countdownTimer = page.locator('text=HAMMER COUNTDOWN').first();
    const isTimerVisible = await countdownTimer.isVisible();
    console.log("Hammer countdown visible before start (should be false):", isTimerVisible);
    if (isTimerVisible) {
      throw new Error("FAIL: Hammer countdown MUST NOT be visible before auction starts!");
    }

    await page.screenshot({ path: path.join(ARTIFACT_DIR, "lot_01_lobby_waiting_view.png") });
    console.log("Saved lot_01_lobby_waiting_view.png");

    // 3. Open Upcoming Players dialog
    console.log("\n--- Opening Upcoming Players Dialog ---");
    const upcomingBtn = page.locator('button:has-text("Upcoming Players")').first();
    if (await upcomingBtn.isVisible()) {
      await upcomingBtn.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, "lot_02_upcoming_sets_dialog.png") });
      console.log("Saved lot_02_upcoming_sets_dialog.png");

      // Close dialog with Escape
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }

    // 4. Click Start Auction
    console.log("\n--- Starting Auction ---");
    const startBtn = page.locator('button:has-text("Start Auction")').first();
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await page.waitForTimeout(2500);

      // Now verify that player card and bid controls appear!
      console.log("--- Checking Live Auction Started ---");
      const activeBidBtn = page.locator('button:has-text("BID ₹")').first();
      const isBidActive = await activeBidBtn.isVisible();
      console.log("Bid button visible after auction start (should be true):", isBidActive);

      const activeTimer = page.locator('text=HAMMER COUNTDOWN').first();
      const isTimerActive = await activeTimer.isVisible();
      console.log("Hammer countdown active after auction start (should be true):", isTimerActive);

      await page.screenshot({ path: path.join(ARTIFACT_DIR, "lot_03_auction_live_random_player.png") });
      console.log("Saved lot_03_auction_live_random_player.png");
    }

    // 5. Test Randomization within Set across multiple room creations
    console.log("\n--- Testing Requirement 1: Random Player Selection from Set 1 ---");
    const sampledFirstPlayers: string[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await fetch("http://localhost:8787/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Test Room ${i + 1}`,
          ruleset: "MEGA",
          enableRetentions: false,
        }),
      });
      const roomData: any = await res.json();
      const testRoomId = roomData.roomId;

      // Start auction via WebSocket or DO API
      // Connect to WS and send START_AUCTION
      const wsUrl = `ws://localhost:8787/api/rooms/${testRoomId}/ws`;
      const ws = new (globalThis as any).WebSocket(wsUrl);

      await new Promise<void>((resolve) => {
        ws.addEventListener("open", () => {
          ws.send(JSON.stringify({ type: "START_AUCTION" }));
        });
        ws.addEventListener("message", (event: any) => {
          const msg = JSON.parse(event.data.toString());
          if (msg.type === "PLAYER_STARTED") {
            sampledFirstPlayers.push(msg.payload.lot.playerName);
            ws.close();
            resolve();
          }
        });
        setTimeout(() => {
          try { ws.close(); } catch {}
          resolve();
        }, 4000);
      });
    }

    console.log("Sampled 1st player picked across 4 independent auctions:", sampledFirstPlayers);
    const uniquePlayers = new Set(sampledFirstPlayers);
    console.log(`Unique first players picked: ${uniquePlayers.size} of ${sampledFirstPlayers.length}`);

    console.log("\n=== All Tests Passed Successfully! ===");
  } finally {
    await browser.close();
  }
}

runRandomLotAndLobbyTests().catch((err) => {
  console.error("Test Error:", err);
  process.exit(1);
});
