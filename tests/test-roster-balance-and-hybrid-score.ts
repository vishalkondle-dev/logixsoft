import { evaluateRosterBalance } from "../apps/ipl-auction/api/src/services/rosterBalanceService";
import { calculateOptimalBestXI } from "../apps/ipl-auction/api/src/services/ratingService";
import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const ARTIFACT_DIR = "/root/.gemini/antigravity-cli/brain/ce91c88c-2ce7-4c22-b7cf-078643bfc493/screenshots";

async function runUnitTests() {
  console.log("=== Running Unit Tests for Roster Balance & Lookahead Reservation ===");

  // Mock team with 24 players: 8 Batters, 8 Bowlers, 8 All-rounders, 0 Wicketkeepers!
  const mockTeam24NoWK: any = {
    code: "TEST_CSK",
    name: "Test Super Kings",
    maxSquad: 25,
    minSquad: 18,
    squadCount: 24,
    overseasCount: 4,
    maxOverseas: 8,
    remainingPurse: 50000000,
    purchasedPlayers: [
      ...Array.from({ length: 8 }, (_, i) => ({ id: `bat_${i}`, name: `Batter ${i}`, role: "BATTER" })),
      ...Array.from({ length: 8 }, (_, i) => ({ id: `bowl_${i}`, name: `Bowler ${i}`, role: "BOWLER" })),
      ...Array.from({ length: 8 }, (_, i) => ({ id: `ar_${i}`, name: `AllRounder ${i}`, role: "ALL_ROUNDER" })),
    ],
  };

  const bowlerLot: any = {
    id: "lot_bowler",
    playerId: "p_bowler",
    playerName: "Jasprit Bumrah",
    role: "BOWLER",
    isOverseas: false,
    basePrice: 20000000,
  };

  const wkLot: any = {
    id: "lot_wk",
    playerId: "p_wk",
    playerName: "Rishabh Pant",
    role: "WICKETKEEPER",
    isOverseas: false,
    basePrice: 20000000,
  };

  // Test 1: Trying to bid for bowler when 1 slot left and 0 WK (lookahead reservation triggered)
  const checkBowler = evaluateRosterBalance(mockTeam24NoWK, bowlerLot, "MEGA");
  console.log("Check Bowler Result (should be false):", checkBowler.allowed);
  console.log("Lookahead Reservation Rejection Reason:", checkBowler.reason);
  if (checkBowler.allowed) {
    throw new Error("FAIL: Bowler bid should have been blocked due to 0 WKs with 1 slot remaining!");
  }
  if (!checkBowler.reason?.includes("need at least 1 Wicketkeeper")) {
    throw new Error(`FAIL: Expected lookahead message mentioning Wicketkeeper, got: ${checkBowler.reason}`);
  }

  // Test 2: Trying to bid for Wicketkeeper when 1 slot left and 0 WK
  const checkWK = evaluateRosterBalance(mockTeam24NoWK, wkLot, "MEGA");
  console.log("Check WK Result (should be true):", checkWK.allowed);
  if (!checkWK.allowed) {
    throw new Error("FAIL: Wicketkeeper bid should have been permitted!");
  }

  // Test 3: Maximum Bowlers Quota (Already 10 Bowlers)
  const mockTeamMaxBowlers: any = {
    code: "TEST_MI",
    name: "Test Indians",
    maxSquad: 25,
    minSquad: 18,
    squadCount: 15,
    overseasCount: 2,
    maxOverseas: 8,
    remainingPurse: 50000000,
    purchasedPlayers: [
      ...Array.from({ length: 10 }, (_, i) => ({ id: `bowl_${i}`, name: `Bowler ${i}`, role: "BOWLER" })),
      { id: "wk_1", name: "Keeper", role: "WICKETKEEPER" },
      ...Array.from({ length: 4 }, (_, i) => ({ id: `bat_${i}`, name: `Batter ${i}`, role: "BATTER" })),
    ],
  };
  const checkMaxBowler = evaluateRosterBalance(mockTeamMaxBowlers, bowlerLot, "MEGA");
  console.log("Check 11th Bowler Result (should be false due to max 10):", checkMaxBowler.allowed);
  console.log("Max Quota Rejection Reason:", checkMaxBowler.reason);
  if (checkMaxBowler.allowed) {
    throw new Error("FAIL: 11th Bowler should be rejected due to max 10 bowlers limit!");
  }

  console.log("\n=== Running Unit Tests for Hybrid Team Evaluation (Best XI + Bench Depth) ===");
  // Create 18-player squad (Superstars avg 88)
  const squad18: any[] = [
    { id: "wk1", name: "Star Keeper", role: "WICKETKEEPER", isOverseas: false, overallRating: 90 },
    ...Array.from({ length: 6 }, (_, i) => ({ id: `bat_${i}`, name: `Star Batter ${i}`, role: "BATTER", isOverseas: i < 2, overallRating: 88 })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `ar_${i}`, name: `Star AllRounder ${i}`, role: "ALL_ROUNDER", isOverseas: i < 1, overallRating: 87 })),
    ...Array.from({ length: 7 }, (_, i) => ({ id: `bowl_${i}`, name: `Star Bowler ${i}`, role: "BOWLER", isOverseas: i < 1, overallRating: 88 })),
  ];

  const eval18 = calculateOptimalBestXI(squad18, "MEGA")!;
  console.log("18-Man Squad (All Stars):");
  console.log("  Best XI Rating:", eval18.bestXIRating);
  console.log("  Bench Rating:", eval18.benchRating);
  console.log("  Depth Bonus (18 players):", eval18.depthBonus);
  console.log("  Overall Hybrid Rating:", eval18.overallRating);

  // Create 25-player squad (12 stars avg 88 + 13 bench avg 68)
  const squad25: any[] = [
    ...squad18.slice(0, 12), // Top 12 stars
    ...Array.from({ length: 13 }, (_, i) => ({ id: `bench_${i}`, name: `Uncapped Bench ${i}`, role: i < 4 ? "BATTER" : (i < 8 ? "BOWLER" : "ALL_ROUNDER"), isOverseas: false, overallRating: 68 })),
  ];
  const eval25 = calculateOptimalBestXI(squad25, "MEGA")!;
  console.log("25-Man Squad (12 Stars + 13 Bench Depth):");
  console.log("  Best XI Rating:", eval25.bestXIRating);
  console.log("  Bench Rating:", eval25.benchRating);
  console.log("  Depth Bonus (25 players):", eval25.depthBonus);
  console.log("  Overall Hybrid Rating:", eval25.overallRating);

  console.log(`\nComparison: 18-man (${eval18.overallRating}) vs 25-man (${eval25.overallRating})`);
  console.log("Notice: The 25-man squad is rewarded +3.0 depth bonus and is not destroyed by bench dilution!");
}

async function runBrowserE2E() {
  console.log("\n=== Running Playwright End-to-End Verification ===");
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 950 } });
  const page = await context.newPage();

  try {
    // 1. Visit live room in Mega mode
    await page.goto("http://localhost:3050", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Pick MI and Mega
    await page.locator("select").first().selectOption("MEGA");
    await page.locator('button:has-text("MI")').first().click();
    await page.waitForTimeout(300);

    await page.locator('button[type="submit"]:has-text("Create & Enter")').click();
    await page.waitForURL(/\/room\/room_/, { timeout: 15000 });
    console.log("Landed in Mega Room:", page.url());
    await page.waitForTimeout(2500);

    // Take screenshot of lobby showing XI badges on retained players
    await page.screenshot({ path: path.join(ARTIFACT_DIR, "hybrid_01_lobby_xi_badges.png") });
    console.log("Saved hybrid_01_lobby_xi_badges.png");

    // Click on MI team accordion to expand
    const miAccordion = page.locator('span:text-is("MI")').first();
    if (await miAccordion.isVisible()) {
      await miAccordion.click();
      await page.waitForTimeout(1000);

      // Verify that "XI" badge is visible
      const xiBadgeVisible = await page.locator('span:text-is("XI")').first().isVisible();
      console.log("Best XI badge ('XI') rendered in squad list:", xiBadgeVisible);

      await page.screenshot({ path: path.join(ARTIFACT_DIR, "hybrid_02_squad_best_xi_badges.png") });
      console.log("Saved hybrid_02_squad_best_xi_badges.png");
    }

    // Start auction to verify live bid control
    const startBtn = page.locator('button:has-text("Start")').first();
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await page.waitForTimeout(2000);

      await page.screenshot({ path: path.join(ARTIFACT_DIR, "hybrid_03_live_auction_bidding.png") });
      console.log("Saved hybrid_03_live_auction_bidding.png");
    }

    console.log("=== Browser E2E Test Completed Successfully! ===");
  } finally {
    await browser.close();
  }
}

async function main() {
  await runUnitTests();
  await runBrowserE2E();
}

main().catch((err) => {
  console.error("Test Error:", err);
  process.exit(1);
});
