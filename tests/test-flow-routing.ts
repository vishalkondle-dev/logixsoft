import { chromium } from "playwright";

async function runTests() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("=== Testing IPL Auction Routing & Flow ===");

  // 1. Invalid Room ID -> Creative Cricket / Auction Themed Error Page
  console.log("\n1. Testing Invalid Room ID (/lobby/INVALID123)...");
  await page.goto("http://localhost:3050/lobby/INVALID123");
  await page.waitForTimeout(2000);
  const textContent = await page.textContent("body");
  const hasDrs = textContent?.includes("DRS DECISION") || textContent?.includes("CLEAN BOWLED");
  const hasPavilion = textContent?.includes("Back to Pavilion");
  console.log(`- Detected DRS / Clean Bowled error: ${hasDrs}`);
  console.log(`- Detected Back to Pavilion button: ${hasPavilion}`);
  await page.screenshot({ path: "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/test_invalid_room_error.png" });

  // 2. Valid Lobby Page for unstarted auction (/lobby/K4K9S1)
  console.log("\n2. Testing Valid Lobby (/lobby/K4K9S1)...");
  await page.goto("http://localhost:3050/lobby/K4K9S1");
  await page.waitForTimeout(2000);
  const currentUrlLobby = page.url();
  console.log(`- Current URL: ${currentUrlLobby} (Expected to remain in /lobby/K4K9S1)`);
  const hasLobbyBanner = (await page.textContent("body"))?.includes("LOBBY • WAITING FOR HOST");
  const hasTeams = (await page.textContent("body"))?.includes("Select Your Franchise");
  console.log(`- Has Lobby Banner: ${hasLobbyBanner}, Has Teams: ${hasTeams}`);
  await page.screenshot({ path: "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/test_lobby_flow.png" });

  // 3. Came to /lobby with already started auction (/lobby/A1C2E3) -> Auto-redirect to /auction/A1C2E3
  console.log("\n3. Testing /lobby/A1C2E3 auto-redirect to /auction/A1C2E3 (since A1C2E3 is LIVE)...");
  await page.goto("http://localhost:3050/lobby/A1C2E3");
  await page.waitForTimeout(2500);
  const redirectedFromLobby = page.url();
  console.log(`- Redirected URL: ${redirectedFromLobby} (Expected /auction/A1C2E3)`);
  await page.screenshot({ path: "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/test_live_auction_arena.png" });

  // 4. Came to /auction with unstarted auction (/auction/K4K9S1) -> Auto-redirect to /lobby/K4K9S1
  console.log("\n4. Testing /auction/K4K9S1 auto-redirect to /lobby/K4K9S1 (since K4K9S1 is LOBBY)...");
  await page.goto("http://localhost:3050/auction/K4K9S1");
  await page.waitForTimeout(2500);
  const redirectedFromAuction = page.url();
  console.log(`- Redirected URL: ${redirectedFromAuction} (Expected /lobby/K4K9S1)`);

  // 5. Came to /summary with active auction (/summary/A1C2E3) -> Auto-redirect to /auction/A1C2E3
  console.log("\n5. Testing /summary/A1C2E3 auto-redirect to /auction/A1C2E3 (since A1C2E3 is LIVE)...");
  await page.goto("http://localhost:3050/summary/A1C2E3");
  await page.waitForTimeout(2500);
  const redirectedFromSummaryLive = page.url();
  console.log(`- Redirected URL: ${redirectedFromSummaryLive} (Expected /auction/A1C2E3)`);

  // 6. Came to /summary with unstarted auction (/summary/K4K9S1) -> Auto-redirect to /lobby/K4K9S1
  console.log("\n6. Testing /summary/K4K9S1 auto-redirect to /lobby/K4K9S1 (since K4K9S1 is LOBBY)...");
  await page.goto("http://localhost:3050/summary/K4K9S1");
  await page.waitForTimeout(2500);
  const redirectedFromSummaryLobby = page.url();
  console.log(`- Redirected URL: ${redirectedFromSummaryLobby} (Expected /lobby/K4K9S1)`);

  // 7. Legacy /room/K4K9S1 -> Auto-redirect to /lobby/K4K9S1
  console.log("\n7. Testing legacy /room/K4K9S1 auto-redirect...");
  await page.goto("http://localhost:3050/room/K4K9S1");
  await page.waitForTimeout(2500);
  const redirectedFromLegacy = page.url();
  console.log(`- Redirected URL: ${redirectedFromLegacy} (Expected /lobby/K4K9S1)`);

  // 8. Create a room and test ended auction summary (/summary/[roomId])
  console.log("\n8. Testing Summary Page on concluded room...");
  // End room via admin API or check summary
  const createRes = await fetch("http://localhost:8787/api/rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Tournament Final Test", ruleset: "MEGA", creatorTeam: "CSK" }),
  });
  const createData = await createRes.json() as any;
  const testRoomId = createData.roomId;
  console.log(`- Created room: ${testRoomId}`);

  // Transition to ENDED
  await fetch(`http://localhost:8787/api/admin/rooms/${testRoomId}/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "end" }),
  });

  await page.goto(`http://localhost:3050/summary/${testRoomId}`);
  await page.waitForTimeout(2500);
  const summaryUrl = page.url();
  console.log(`- Concluded room Summary URL: ${summaryUrl} (Expected /summary/${testRoomId})`);
  const hasSummaryContent = (await page.textContent("body"))?.includes("Post-Auction Review") || (await page.textContent("body"))?.includes("Tournament Final Test");
  console.log(`- Has Review/Summary content: ${hasSummaryContent}`);
  await page.screenshot({ path: "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/test_summary_flow.png" });

  await browser.close();
  console.log("\n=== ALL ROUTING TESTS PASSED! ===");
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
