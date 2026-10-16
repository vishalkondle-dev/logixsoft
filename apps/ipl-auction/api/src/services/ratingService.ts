export interface PlayerStatsForRating {
  role: "BATTER" | "BOWLER" | "ALL_ROUNDER" | "WICKETKEEPER";
  matches: number;
  runs: number;
  battingAverage: number;
  strikeRate: number;
  wickets: number;
  economy: number;
  isCapped: boolean;
}

export interface CalculatedHiddenRatings {
  batting: number;
  bowling: number;
  keeping: number;
  overall: number;
}

/**
 * Calculates normalized hidden ratings based on cricket statistics.
 * Role-weighted so specialist bowlers aren't penalized for low runs.
 */
export function calculatePlayerHiddenRatings(stats: PlayerStatsForRating): CalculatedHiddenRatings {
  const capBonus = stats.isCapped ? 6 : 0;
  const expFactor = Math.min(10, Math.sqrt(stats.matches) * 1.2);

  // Normalized batting rating (0-100)
  const normAvg = Math.min(35, Math.max(0, stats.battingAverage));
  const normSr = Math.min(50, Math.max(0, (stats.strikeRate - 100) * 0.7));
  const rawBatting = 30 + normAvg + normSr + expFactor + capBonus;
  const batting = Math.round(Math.min(99, Math.max(45, rawBatting)));

  // Normalized bowling rating (0-100)
  const wpm = stats.matches > 0 ? stats.wickets / stats.matches : 0;
  const wpmScore = Math.min(30, wpm * 22);
  const econScore = stats.economy > 0 ? Math.max(0, (11 - stats.economy) * 8) : 15;
  const rawBowling = 30 + wpmScore + econScore + expFactor + capBonus;
  const bowling = Math.round(Math.min(99, Math.max(45, rawBowling)));

  // Keeping rating
  const keeping = stats.role === "WICKETKEEPER"
    ? Math.round(Math.min(98, 70 + expFactor + capBonus))
    : 30;

  // Role-weighted Overall Rating
  let overall = 50;
  switch (stats.role) {
    case "BATTER":
      overall = Math.round(batting * 0.85 + expFactor + capBonus);
      break;
    case "BOWLER":
      overall = Math.round(bowling * 0.85 + expFactor + capBonus);
      break;
    case "ALL_ROUNDER":
      overall = Math.round(batting * 0.48 + bowling * 0.48 + 5);
      break;
    case "WICKETKEEPER":
      overall = Math.round(batting * 0.65 + keeping * 0.35);
      break;
  }

  return {
    batting,
    bowling,
    keeping,
    overall: Math.min(99, Math.max(50, overall)),
  };
}

export interface PlayerForSquadEvaluation {
  id: string;
  name: string;
  role: "BATTER" | "BOWLER" | "ALL_ROUNDER" | "WICKETKEEPER";
  isOverseas: boolean;
  overallRating: number;
}

export interface ComprehensiveTeamRating {
  overallRating: number;
  playersRating: number;
  squadBalanceRating: number;
  purseBalanceRating: number;
  roleCounts: {
    batters: number;
    bowlers: number;
    allRounders: number;
    wicketkeepers: number;
    overseas: number;
    total: number;
  };
}

/**
 * Authoritative Team Overall Rating:
 * 1. Players Rating (60% weight): Mean quality of all acquired players based on individual cricket stats, with top match-winners impact.
 * 2. Squad Balance (25% weight): Tactical roster completeness across Batters, Bowlers, WKs, All-Rounders, Overseas, and squad size.
 * 3. Purse Balance (15% weight): Financial discipline, spending efficiency, and healthy budget reserves per remaining slot.
 *
 * NOTE: Best XI and artificial bench cuts are completely removed.
 */
export function calculateTeamOverallRating(
  squad: PlayerForSquadEvaluation[],
  remainingPurse: number = 1200000000,
  totalPurse: number = 1200000000,
  ruleset: "MEGA" | "CLASSIC" | "SPRINT_XI" = "MEGA"
): ComprehensiveTeamRating | null {
  if (squad.length < 2) return null;

  // --- PILLAR 1: PLAYERS RATING (60% Weight) ---
  // Evaluated directly from all purchased/retained players' stats-based ratings
  const ratings = squad.map((p) => p.overallRating).sort((a, b) => b - a);
  const meanAll = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  
  // In T20 cricket, top match-winners have a high impact, but every squad member counts
  let playersRating = meanAll;
  if (ratings.length >= 7) {
    const top7 = ratings.slice(0, 7);
    const meanTop7 = top7.reduce((sum, r) => sum + r, 0) / 7;
    playersRating = 0.70 * meanTop7 + 0.30 * meanAll;
  }
  playersRating = Math.round(Math.min(99, Math.max(50, playersRating)) * 10) / 10;

  // --- PILLAR 2: SQUAD BALANCE (25% Weight) ---
  // Evaluated across all 4 key cricket disciplines, overseas quotas, and squad completeness
  const wkCount = squad.filter((p) => p.role === "WICKETKEEPER").length;
  const batCount = squad.filter((p) => p.role === "BATTER").length;
  const bowlCount = squad.filter((p) => p.role === "BOWLER").length;
  const arCount = squad.filter((p) => p.role === "ALL_ROUNDER").length;
  const osCount = squad.filter((p) => p.isOverseas).length;
  const totalCount = squad.length;

  const minSquad = ruleset === "SPRINT_XI" ? 11 : 18;
  const maxOverseas = ruleset === "SPRINT_XI" ? 4 : 8;

  // 1. Wicketkeeping Coverage (20 pts)
  let wkScore = 0;
  if (wkCount === 1 || wkCount === 2) wkScore = 20;
  else if (wkCount === 3) wkScore = 16;
  else if (wkCount > 3) wkScore = 12;
  else wkScore = 0; // 0 keepers = severe balance deficiency

  // 2. Batting Depth (25 pts)
  let batScore = 0;
  if (ruleset === "SPRINT_XI") {
    if (batCount >= 4) batScore = 25;
    else if (batCount === 3) batScore = 20;
    else if (batCount === 2) batScore = 12;
    else batScore = 5;
  } else {
    if (batCount >= 5) batScore = 25;
    else if (batCount === 4) batScore = 22;
    else if (batCount === 3) batScore = 15;
    else if (batCount === 2) batScore = 8;
    else batScore = 2;
  }

  // 3. Bowling Arsenal (25 pts)
  let bowlScore = 0;
  if (ruleset === "SPRINT_XI") {
    if (bowlCount >= 4) bowlScore = 25;
    else if (bowlCount === 3) bowlScore = 20;
    else if (bowlCount === 2) bowlScore = 12;
    else bowlScore = 5;
  } else {
    if (bowlCount >= 6) bowlScore = 25;
    else if (bowlCount === 5) bowlScore = 22;
    else if (bowlCount === 4) bowlScore = 15;
    else if (bowlCount === 3) bowlScore = 8;
    else bowlScore = 2;
  }

  // 4. All-Rounder Balance (15 pts)
  let arScore = 0;
  if (arCount >= 2) arScore = 15;
  else if (arCount === 1) arScore = 10;
  else arScore = 3;

  // 5. Overseas & Squad Depth Progress (15 pts)
  let osScore = 0;
  if (osCount > maxOverseas) {
    osScore = 0; // Exceeded limit
  } else if (osCount >= (ruleset === "SPRINT_XI" ? 3 : 4)) {
    osScore = 10;
  } else if (osCount >= 1) {
    osScore = 7;
  } else {
    osScore = 2;
  }

  const squadSizeProgress = Math.min(5, Math.round((totalCount / minSquad) * 5));
  const squadBalanceRating = Math.round(Math.min(100, Math.max(20, wkScore + batScore + bowlScore + arScore + osScore + squadSizeProgress)) * 10) / 10;

  // --- PILLAR 3: PURSE BALANCE (15% Weight) ---
  // Evaluates financial management, spending curve, and budget buffer per required slot
  const spent = totalPurse - remainingPurse;
  const spendFraction = totalPurse > 0 ? spent / totalPurse : 0;
  const slotsNeeded = Math.max(0, minSquad - totalCount);

  // Capital Deployment (50 pts)
  let deploymentScore = 30;
  if (spendFraction >= 0.85 && spendFraction <= 0.98) deploymentScore = 50; // Ideal auction deployment
  else if (spendFraction >= 0.70 && spendFraction < 0.85) deploymentScore = 42;
  else if (spendFraction >= 0.50 && spendFraction < 0.70) deploymentScore = 32;
  else if (spendFraction > 0.98) deploymentScore = 40; // High spend
  else deploymentScore = 20; // Hoarded cash / underspending

  // Buffer per Required Slot (50 pts)
  let bufferScore = 50;
  if (slotsNeeded > 0) {
    const avgPerNeededSlot = remainingPurse / slotsNeeded;
    if (avgPerNeededSlot >= 15000000) bufferScore = 50; // >= 1.5 Cr per slot (very comfortable)
    else if (avgPerNeededSlot >= 5000000) bufferScore = 40; // >= 50 L per slot
    else if (avgPerNeededSlot >= 3000000) bufferScore = 25; // >= 30 L base price
    else bufferScore = 5; // Dangerously underfunded for remaining slots
  }
  const purseBalanceRating = Math.round(Math.min(100, Math.max(20, deploymentScore + bufferScore)) * 10) / 10;

  // --- COMBINED OVERALL TEAM RATING ---
  // 60% Player Quality + 25% Squad Balance + 15% Purse Health
  const rawOverall = 0.60 * playersRating + 0.25 * squadBalanceRating + 0.15 * purseBalanceRating;
  const overallRating = Math.round(rawOverall * 10) / 10;

  return {
    overallRating,
    playersRating,
    squadBalanceRating,
    purseBalanceRating,
    roleCounts: {
      batters: batCount,
      bowlers: bowlCount,
      allRounders: arCount,
      wicketkeepers: wkCount,
      overseas: osCount,
      total: totalCount,
    },
  };
}

/**
 * Backward compatibility wrapper.
 */
export function calculateOptimalBestXI(
  squad: PlayerForSquadEvaluation[],
  ruleset: "MEGA" | "CLASSIC" | "SPRINT_XI" = "MEGA",
  remainingPurse: number = 1200000000,
  totalPurse: number = 1200000000
) {
  const result = calculateTeamOverallRating(squad, remainingPurse, totalPurse, ruleset);
  if (!result) return null;
  return {
    overallRating: result.overallRating,
    playersRating: result.playersRating,
    squadBalanceRating: result.squadBalanceRating,
    purseBalanceRating: result.purseBalanceRating,
    bestXIRating: result.playersRating,
    benchRating: result.squadBalanceRating,
    depthBonus: 0,
    bestXIPlayerIds: [],
    impactSubPlayerId: null,
    benchPlayerIds: [],
  };
}

export function calculateTeamAverageRating(
  purchasedPlayerOverallRatings: number[]
): number | null {
  if (purchasedPlayerOverallRatings.length < 3) return null;
  const sum = purchasedPlayerOverallRatings.reduce((acc, r) => acc + r, 0);
  const avg = sum / purchasedPlayerOverallRatings.length;
  return Math.round(avg * 10) / 10;
}


