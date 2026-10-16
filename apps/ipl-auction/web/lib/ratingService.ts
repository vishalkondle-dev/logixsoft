import { PlayerRole } from "./types";

export interface PlayerForSquadEvaluation {
  id: string;
  name: string;
  role: PlayerRole;
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
 * Team Overall Rating:
 * 1. Players Rating (60% weight): Pure cricket stats quality of all acquired players.
 * 2. Squad Balance (25% weight): Positional coverage across Batters, Bowlers, WKs, All-Rounders, and Overseas.
 * 3. Purse Balance (15% weight): Financial discipline and spending curve efficiency.
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
  const ratings = squad.map((p) => p.overallRating).sort((a, b) => b - a);
  const meanAll = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;

  let playersRating = meanAll;
  if (ratings.length >= 7) {
    const top7 = ratings.slice(0, 7);
    const meanTop7 = top7.reduce((sum, r) => sum + r, 0) / 7;
    playersRating = 0.70 * meanTop7 + 0.30 * meanAll;
  }
  playersRating = Math.round(Math.min(99, Math.max(50, playersRating)) * 10) / 10;

  // --- PILLAR 2: SQUAD BALANCE (25% Weight) ---
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
  else wkScore = 0;

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
    osScore = 0;
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
  const spent = totalPurse - remainingPurse;
  const spendFraction = totalPurse > 0 ? spent / totalPurse : 0;
  const slotsNeeded = Math.max(0, minSquad - totalCount);

  let deploymentScore = 30;
  if (spendFraction >= 0.85 && spendFraction <= 0.98) deploymentScore = 50;
  else if (spendFraction >= 0.70 && spendFraction < 0.85) deploymentScore = 42;
  else if (spendFraction >= 0.50 && spendFraction < 0.70) deploymentScore = 32;
  else if (spendFraction > 0.98) deploymentScore = 40;
  else deploymentScore = 20;

  let bufferScore = 50;
  if (slotsNeeded > 0) {
    const avgPerNeededSlot = remainingPurse / slotsNeeded;
    if (avgPerNeededSlot >= 15000000) bufferScore = 50;
    else if (avgPerNeededSlot >= 5000000) bufferScore = 40;
    else if (avgPerNeededSlot >= 3000000) bufferScore = 25;
    else bufferScore = 5;
  }
  const purseBalanceRating = Math.round(Math.min(100, Math.max(20, deploymentScore + bufferScore)) * 10) / 10;

  // --- COMBINED OVERALL TEAM RATING ---
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
