import { FranchiseState, AuctionLot } from "../types/auction";

export interface AIFranchiseProfile {
  franchiseCode: string;
  aggression: number; // 1.02 - 1.10
  rolePriority: Record<string, number>;
  maxPurseRatioPerPlayer: number; // e.g. 0.20 (max 20% of total purse on one star)
}

// Balanced, realistic aggression across all 10 IPL franchises
export const FRANCHISE_AI_PROFILES: Record<string, AIFranchiseProfile> = {
  CSK: { franchiseCode: "CSK", aggression: 1.06, rolePriority: { ALL_ROUNDER: 1.25, BATTER: 1.1, BOWLER: 1.05, WICKETKEEPER: 1.1 }, maxPurseRatioPerPlayer: 0.20 },
  MI: { franchiseCode: "MI", aggression: 1.08, rolePriority: { BOWLER: 1.25, ALL_ROUNDER: 1.15, BATTER: 1.1, WICKETKEEPER: 1.0 }, maxPurseRatioPerPlayer: 0.22 },
  RCB: { franchiseCode: "RCB", aggression: 1.08, rolePriority: { BATTER: 1.25, ALL_ROUNDER: 1.1, BOWLER: 1.15, WICKETKEEPER: 1.05 }, maxPurseRatioPerPlayer: 0.22 },
  KKR: { franchiseCode: "KKR", aggression: 1.07, rolePriority: { ALL_ROUNDER: 1.25, BOWLER: 1.2, BATTER: 1.05, WICKETKEEPER: 1.0 }, maxPurseRatioPerPlayer: 0.20 },
  SRH: { franchiseCode: "SRH", aggression: 1.07, rolePriority: { BATTER: 1.25, BOWLER: 1.15, ALL_ROUNDER: 1.05, WICKETKEEPER: 1.05 }, maxPurseRatioPerPlayer: 0.21 },
  DC: { franchiseCode: "DC", aggression: 1.05, rolePriority: { BATTER: 1.15, BOWLER: 1.15, ALL_ROUNDER: 1.1, WICKETKEEPER: 1.1 }, maxPurseRatioPerPlayer: 0.19 },
  RR: { franchiseCode: "RR", aggression: 1.06, rolePriority: { BOWLER: 1.2, BATTER: 1.15, ALL_ROUNDER: 1.05, WICKETKEEPER: 1.05 }, maxPurseRatioPerPlayer: 0.20 },
  GT: { franchiseCode: "GT", aggression: 1.06, rolePriority: { BOWLER: 1.25, ALL_ROUNDER: 1.15, BATTER: 1.05, WICKETKEEPER: 1.0 }, maxPurseRatioPerPlayer: 0.20 },
  LSG: { franchiseCode: "LSG", aggression: 1.05, rolePriority: { ALL_ROUNDER: 1.2, BATTER: 1.1, BOWLER: 1.1, WICKETKEEPER: 1.1 }, maxPurseRatioPerPlayer: 0.20 },
  PBKS: { franchiseCode: "PBKS", aggression: 1.08, rolePriority: { ALL_ROUNDER: 1.15, BATTER: 1.15, BOWLER: 1.15, WICKETKEEPER: 1.05 }, maxPurseRatioPerPlayer: 0.22 },
};

export interface ValuationResult {
  ceiling: number;
  squadNeedFactor: number;
  roleNeedFactor: number;
  isDesirable: boolean;
}

/**
 * Calculates a detailed, realistic valuation ceiling (in Rupees) for an AI franchise.
 * Factors in:
 * 1. Player rating & base price
 * 2. Positional / Role need of the franchise
 * 3. Relative squad deficit across the room (ensuring all 10 franchises acquire balanced rosters)
 * 4. Squad size saturation cooling (preventing any franchise from hoarding 25 players while others have few)
 * 5. Minimum purse reserves for remaining slots
 */
export function calculateDetailedValuation(
  lot: AuctionLot,
  franchise: FranchiseState,
  difficulty: "easy" | "normal" | "hard" = "normal",
  lotsRemaining: number = 20,
  totalLots: number = 61,
  allTeams?: Record<string, FranchiseState>
): ValuationResult {
  const profile = FRANCHISE_AI_PROFILES[franchise.code] || {
    franchiseCode: franchise.code,
    aggression: 1.05,
    rolePriority: {},
    maxPurseRatioPerPlayer: 0.2,
  };

  const teamsList = allTeams ? Object.values(allTeams) : [franchise];
  const numTeams = Math.max(1, teamsList.length);
  const totalBought = teamsList.reduce((sum, t) => sum + t.squadCount, 0);
  const avgSquad = totalBought / numTeams;

  // Fair target squad size for this auction:
  // In a 61-lot auction across 10 teams, fair target is ~6-7 players per team.
  // In a 200-lot auction, fair target is 18-20 players per team.
  const fairTargetSquad = Math.min(
    franchise.maxSquad,
    Math.max(franchise.minSquad, Math.ceil(totalLots / numTeams))
  );

  // 1. Squad Count Saturation & Deficit Multiplier
  let squadNeedFactor = 1.0;
  if (franchise.squadCount < avgSquad) {
    // Eager to catch up with other franchises
    squadNeedFactor += Math.min(0.65, (avgSquad - franchise.squadCount) * 0.2);
  } else if (franchise.squadCount > avgSquad) {
    // Already has more players than average -> cool down
    squadNeedFactor = Math.max(0.3, 1.0 - (franchise.squadCount - avgSquad) * 0.22);
  }

  // Hard stop / aggressive cooldown if this team has already reached its fair share
  // or is hoarding players while other teams have few:
  if (franchise.squadCount >= fairTargetSquad) {
    squadNeedFactor *= 0.45;
  }
  if (franchise.squadCount >= fairTargetSquad + 2) {
    squadNeedFactor *= 0.25;
  }
  if (franchise.squadCount >= franchise.maxSquad) {
    return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false };
  }

  // 2. Role Need Multiplier
  const inRoleCount = (franchise.purchasedPlayers || []).filter((p) => p.role === lot.role).length;
  let roleNeedFactor = profile.rolePriority[lot.role] || 1.0;

  switch (lot.role) {
    case "WICKETKEEPER":
      if (inRoleCount === 0) roleNeedFactor *= 1.45;
      else if (inRoleCount === 1) roleNeedFactor *= 0.9;
      else if (inRoleCount >= 2) roleNeedFactor *= 0.25; // Already have 2+ keepers
      break;
    case "BATTER":
      if (inRoleCount === 0) roleNeedFactor *= 1.35;
      else if (inRoleCount < 3) roleNeedFactor *= 1.15;
      else if (inRoleCount >= 7) roleNeedFactor *= 0.35;
      break;
    case "BOWLER":
      if (inRoleCount === 0) roleNeedFactor *= 1.35;
      else if (inRoleCount < 3) roleNeedFactor *= 1.15;
      else if (inRoleCount >= 8) roleNeedFactor *= 0.35;
      break;
    case "ALL_ROUNDER":
      if (inRoleCount === 0) roleNeedFactor *= 1.4;
      else if (inRoleCount < 2) roleNeedFactor *= 1.15;
      else if (inRoleCount >= 6) roleNeedFactor *= 0.35;
      break;
  }

  // 3. Overseas Constraint
  if (lot.isOverseas) {
    if (franchise.overseasCount >= franchise.maxOverseas) {
      return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false };
    }
    if (franchise.overseasCount >= 7) {
      // Only 1 overseas slot remaining: reserve only for stars
      if ((lot.hiddenRatingOverall || 70) < 82) {
        return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false };
      }
    }
  }

  // 4. Base Price & Rating Valuation Scalar
  const rating = lot.hiddenRatingOverall || 70;
  let valuation = lot.basePrice;
  if (rating >= 88) {
    valuation = Math.max(lot.basePrice, 100000000); // 10 Cr+ for marquee
  } else if (rating >= 80) {
    valuation = Math.max(lot.basePrice, 60000000); // 6 Cr+
  } else if (rating >= 72) {
    valuation = Math.max(lot.basePrice, 35000000); // 3.5 Cr+
  } else {
    valuation = Math.max(lot.basePrice, 15000000); // 1.5 Cr+
  }

  // 5. Difficulty Multiplier
  let difficultyFactor = 1.0;
  if (difficulty === "easy") difficultyFactor = 0.9;
  if (difficulty === "hard") difficultyFactor = 1.12;

  // 6. Urgency as auction winds down
  const scarcityFactor = lotsRemaining < 8 ? 1.08 : 1.0;

  let calculatedCeiling =
    valuation *
    profile.aggression *
    roleNeedFactor *
    squadNeedFactor *
    difficultyFactor *
    scarcityFactor;

  // Absolute limit: cannot exceed max purse ratio or reserve constraint
  const maxSpend = franchise.totalPurse * profile.maxPurseRatioPerPlayer;
  const reserveNeeded = Math.max(0, franchise.minSquad - franchise.squadCount - 1) * 3000000;
  const maxAvailable = Math.max(0, franchise.remainingPurse - reserveNeeded);

  const finalCeiling = Math.min(calculatedCeiling, maxSpend, maxAvailable);
  const roundedCeiling = Math.max(0, Math.floor(finalCeiling / 100000) * 100000);

  const isDesirable = roundedCeiling >= lot.basePrice && squadNeedFactor > 0.15;

  return {
    ceiling: roundedCeiling,
    squadNeedFactor,
    roleNeedFactor,
    isDesirable,
  };
}

/**
 * Backward compatible helper returning the ceiling amount in Rupees.
 */
export function calculatePlayerValuation(
  lot: AuctionLot,
  franchise: FranchiseState,
  difficulty: "easy" | "normal" | "hard" = "normal",
  lotsRemaining: number = 20,
  totalLots: number = 61,
  allTeams?: Record<string, FranchiseState>
): number {
  return calculateDetailedValuation(lot, franchise, difficulty, lotsRemaining, totalLots, allTeams).ceiling;
}
