import { FranchiseState, AuctionLot } from "../types/auction";

export interface AIFranchiseProfile {
  franchiseCode: string;
  aggression: number; // 1.05 - 1.15
  rolePriority: Record<string, number>;
  maxPurseRatioPerPlayer: number; // e.g. 0.20 (max 20% of total purse on one star)
  paddleTenacity: number; // 1.18 - 1.28 (elasticity when challenged by human/rivals)
}

// Balanced, distinct personalities across all 10 IPL franchises
export const FRANCHISE_AI_PROFILES: Record<string, AIFranchiseProfile> = {
  CSK: { franchiseCode: "CSK", aggression: 1.09, rolePriority: { ALL_ROUNDER: 1.25, BATTER: 1.15, BOWLER: 1.05, WICKETKEEPER: 1.15 }, maxPurseRatioPerPlayer: 0.20, paddleTenacity: 1.22 },
  MI: { franchiseCode: "MI", aggression: 1.12, rolePriority: { BOWLER: 1.25, ALL_ROUNDER: 1.15, BATTER: 1.15, WICKETKEEPER: 1.05 }, maxPurseRatioPerPlayer: 0.22, paddleTenacity: 1.26 },
  RCB: { franchiseCode: "RCB", aggression: 1.12, rolePriority: { BATTER: 1.25, ALL_ROUNDER: 1.15, BOWLER: 1.15, WICKETKEEPER: 1.10 }, maxPurseRatioPerPlayer: 0.22, paddleTenacity: 1.26 },
  KKR: { franchiseCode: "KKR", aggression: 1.09, rolePriority: { ALL_ROUNDER: 1.25, BOWLER: 1.20, BATTER: 1.05, WICKETKEEPER: 1.05 }, maxPurseRatioPerPlayer: 0.20, paddleTenacity: 1.20 },
  SRH: { franchiseCode: "SRH", aggression: 1.11, rolePriority: { BATTER: 1.25, BOWLER: 1.15, ALL_ROUNDER: 1.10, WICKETKEEPER: 1.05 }, maxPurseRatioPerPlayer: 0.21, paddleTenacity: 1.23 },
  DC: { franchiseCode: "DC", aggression: 1.08, rolePriority: { BATTER: 1.15, BOWLER: 1.15, ALL_ROUNDER: 1.10, WICKETKEEPER: 1.15 }, maxPurseRatioPerPlayer: 0.19, paddleTenacity: 1.18 },
  RR: { franchiseCode: "RR", aggression: 1.08, rolePriority: { BOWLER: 1.20, BATTER: 1.15, ALL_ROUNDER: 1.05, WICKETKEEPER: 1.10 }, maxPurseRatioPerPlayer: 0.20, paddleTenacity: 1.18 },
  GT: { franchiseCode: "GT", aggression: 1.08, rolePriority: { BOWLER: 1.25, ALL_ROUNDER: 1.15, BATTER: 1.10, WICKETKEEPER: 1.05 }, maxPurseRatioPerPlayer: 0.20, paddleTenacity: 1.20 },
  LSG: { franchiseCode: "LSG", aggression: 1.09, rolePriority: { ALL_ROUNDER: 1.20, BATTER: 1.15, BOWLER: 1.10, WICKETKEEPER: 1.15 }, maxPurseRatioPerPlayer: 0.20, paddleTenacity: 1.20 },
  PBKS: { franchiseCode: "PBKS", aggression: 1.12, rolePriority: { ALL_ROUNDER: 1.20, BATTER: 1.15, BOWLER: 1.15, WICKETKEEPER: 1.10 }, maxPurseRatioPerPlayer: 0.22, paddleTenacity: 1.25 },
};

export type ScoutingPriority = "CORE_TARGET" | "SECONDARY_TARGET" | "OPPORTUNISTIC" | "PASS";

export interface ScoutingAssessment {
  tier: ScoutingPriority;
  multiplier: number;
}

/**
 * Deterministically computes a franchise's unique scouting affinity for any given player.
 * Ensures ceilings across all 10 franchises are realistically staggered rather than identical.
 */
export function getScoutingTargetTier(
  playerId: string,
  franchiseCode: string
): ScoutingAssessment {
  const key = `${playerId || "player"}_${franchiseCode}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash << 5) - hash + key.charCodeAt(i);
    hash |= 0;
  }
  const normalized = Math.abs(hash % 100);

  // Staggered Priority Distribution across all 10 franchises:
  // 0 - 24 (25%): CORE_TARGET (Franchise's primary scouted target: 1.25 - 1.48x)
  // 25 - 64 (40%): SECONDARY_TARGET (Solid squad fit at market price: 1.00 - 1.18x)
  // 65 - 89 (25%): OPPORTUNISTIC (Bargain hunter, drops out early: 0.78 - 0.95x)
  // 90 - 99 (10%): PASS (Tactical mismatch: 0.55 - 0.72x)
  if (normalized < 25) {
    const sub = (normalized / 25) * 0.23;
    return { tier: "CORE_TARGET", multiplier: 1.25 + sub };
  } else if (normalized < 65) {
    const sub = ((normalized - 25) / 40) * 0.18;
    return { tier: "SECONDARY_TARGET", multiplier: 1.00 + sub };
  } else if (normalized < 90) {
    const sub = ((normalized - 65) / 25) * 0.17;
    return { tier: "OPPORTUNISTIC", multiplier: 0.78 + sub };
  } else {
    const sub = ((normalized - 90) / 10) * 0.17;
    return { tier: "PASS", multiplier: 0.55 + sub };
  }
}

export interface ValuationResult {
  ceiling: number;
  squadNeedFactor: number;
  roleNeedFactor: number;
  isDesirable: boolean;
  scoutingTier?: ScoutingPriority;
}

/**
 * Calculates a detailed, realistic valuation ceiling (in Rupees) for an AI franchise.
 * Factors in:
 * 1. Player rating & base price
 * 2. Positional / Role need of the franchise
 * 3. Scouting target priority tier (diversifying valuation across teams)
 * 4. Human challenge paddle tenacity (preventing abrupt, predictable surrender against human bids)
 * 5. Minimum purse reserves for remaining slots
 */
export function calculateDetailedValuation(
  lot: AuctionLot,
  franchise: FranchiseState,
  difficulty: "easy" | "normal" | "hard" = "normal",
  lotsRemaining: number = 20,
  totalLots: number = 61,
  allTeams?: Record<string, FranchiseState>,
  isHumanLeading: boolean = false
): ValuationResult {
  const profile = FRANCHISE_AI_PROFILES[franchise.code] || {
    franchiseCode: franchise.code,
    aggression: 1.05,
    rolePriority: {},
    maxPurseRatioPerPlayer: 0.2,
    paddleTenacity: 1.20,
  };

  const rating = lot.hiddenRatingOverall || 70;
  const inRoleCount = (franchise.purchasedPlayers || []).filter((p) => p.role === lot.role).length;

  // Scouting Target Tier Assessment (Diversifies valuation across all 10 franchises)
  const scouting = getScoutingTargetTier(lot.playerId || lot.id, franchise.code);

  // If this franchise considers the player a tactical PASS and base price is significant, they pass
  if (scouting.tier === "PASS" && lot.matches > 5 && lot.basePrice >= 10000000 && rating < 88) {
    return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false, scoutingTier: "PASS" };
  }

  // B. Overseas quota discipline: Overseas slots (max 8) are precious.
  // Franchises never spend an overseas slot on a mediocre/unproven overseas player.
  if (lot.isOverseas) {
    if (franchise.overseasCount >= franchise.maxOverseas) {
      return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false, scoutingTier: scouting.tier };
    }
    if (rating < 76) {
      return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false, scoutingTier: scouting.tier };
    }
    if (franchise.overseasCount >= 7 && rating < 88) {
      // Final overseas spot strictly reserved for elite match-winners
      return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false, scoutingTier: scouting.tier };
    }
    if (franchise.overseasCount >= 5 && rating < 80) {
      return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false, scoutingTier: scouting.tier };
    }
  }

  // C. Cricket Stat Quality Gates: If a player's career numbers are uncompetitive for T20, pass!
  if (lot.matches >= 10) {
    if (lot.role === "BATTER" && (lot.strikeRate < 118 || (lot.battingAverage < 19 && lot.strikeRate < 128))) {
      return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false, scoutingTier: scouting.tier };
    }
    if (lot.role === "BOWLER" && (lot.economy > 9.3 || (lot.economy > 8.8 && (lot.wickets / lot.matches) < 0.60))) {
      return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false, scoutingTier: scouting.tier };
    }
    if (lot.role === "ALL_ROUNDER" && lot.strikeRate < 115 && lot.economy > 9.0) {
      return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false, scoutingTier: scouting.tier };
    }
  }

  // D. Role Saturation Hard Stops:
  if (lot.role === "WICKETKEEPER" && inRoleCount >= 2) {
    return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false, scoutingTier: scouting.tier };
  }
  if (lot.role === "BATTER" && inRoleCount >= 7 && rating < 88) {
    return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false, scoutingTier: scouting.tier };
  }
  if (lot.role === "BOWLER" && inRoleCount >= 8 && rating < 88) {
    return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false, scoutingTier: scouting.tier };
  }
  if (lot.role === "ALL_ROUNDER" && inRoleCount >= 6 && rating < 88) {
    return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false, scoutingTier: scouting.tier };
  }

  // Max squad hard stop
  if (franchise.squadCount >= franchise.maxSquad) {
    return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false, scoutingTier: scouting.tier };
  }

  // =========================================================================
  // 2. CRICKET STAT-BASED MULTIPLIER (SR, Eco, Avg, Experience)
  // =========================================================================
  let statMultiplier = 1.0;

  if (lot.role === "BATTER" || lot.role === "WICKETKEEPER") {
    // Strike Rate evaluation
    if (lot.strikeRate >= 165) statMultiplier += 0.22;
    else if (lot.strikeRate >= 150) statMultiplier += 0.12;
    else if (lot.strikeRate >= 135) statMultiplier += 0.04;
    else if (lot.strikeRate < 125 && lot.matches > 5) statMultiplier -= 0.16;
    else if (lot.strikeRate < 115 && lot.matches > 5) statMultiplier -= 0.30;

    // Batting Average evaluation
    if (lot.battingAverage >= 38) statMultiplier += 0.15;
    else if (lot.battingAverage >= 30) statMultiplier += 0.06;
    else if (lot.battingAverage < 20 && lot.matches > 5) statMultiplier -= 0.18;
  } else if (lot.role === "BOWLER") {
    // Economy evaluation (lower is better)
    if (lot.economy > 0 && lot.economy <= 7.2) statMultiplier += 0.22;
    else if (lot.economy > 0 && lot.economy <= 7.8) statMultiplier += 0.10;
    else if (lot.economy >= 8.8) statMultiplier -= 0.14;
    else if (lot.economy >= 9.3) statMultiplier -= 0.30;

    // Wickets per match
    const wpm = lot.matches > 0 ? lot.wickets / lot.matches : 0;
    if (wpm >= 1.25) statMultiplier += 0.14;
    else if (wpm < 0.65 && lot.matches > 5) statMultiplier -= 0.18;
  } else if (lot.role === "ALL_ROUNDER") {
    if (lot.strikeRate >= 140 && lot.economy > 0 && lot.economy <= 8.2) statMultiplier += 0.22;
    else if (lot.strikeRate < 120 && lot.economy >= 9.0) statMultiplier -= 0.25;
  }

  // Experience and Capped status
  if (!lot.isCapped && rating < 80) {
    statMultiplier *= 0.88; // Uncapped discount
  }
  if (lot.matches > 80) {
    statMultiplier *= 1.08; // High tournament experience premium
  }

  // =========================================================================
  // 3. REALISTIC TIERED VALUATION ANCHORS
  // =========================================================================
  // Tiers prevent average players from spiraling to 17-18 Cr:
  // Marquee stars (88+): 7.5 - 11.5 Cr base
  // Top starters (82-87): 3.5 - 5.5 Cr base
  // Key rotation (76-81): 1.6 - 3.0 Cr base
  // Squad depth (70-75): 60L - 1.4 Cr base
  // Uncapped / fringe (60-69): Base price - 50L
  let marketAnchor = lot.basePrice;
  if (rating >= 91) {
    marketAnchor = 110000000; // 11.0 Cr
  } else if (rating >= 88) {
    marketAnchor = 80000000;  // 8.0 Cr
  } else if (rating >= 84) {
    marketAnchor = 50000000;  // 5.0 Cr
  } else if (rating >= 80) {
    marketAnchor = 34000000;  // 3.4 Cr
  } else if (rating >= 76) {
    marketAnchor = 20000000;  // 2.0 Cr
  } else if (rating >= 72) {
    marketAnchor = 12000000;  // 1.2 Cr
  } else if (rating >= 68) {
    marketAnchor = 6000000;   // 60 Lakhs
  } else {
    marketAnchor = lot.basePrice;
  }

  // If official / last year sold price exists, blend it in (35% weight)
  if (lot.lastYearPrice && lot.lastYearPrice > 0) {
    marketAnchor = Math.round(marketAnchor * 0.65 + lot.lastYearPrice * 0.35);
  }

  // Apply stat multiplier
  const fairMarketValue = Math.round(marketAnchor * Math.max(0.40, Math.min(1.45, statMultiplier)));

  // OVERPRICED BASE PRICE CHECK: If base price is higher than realistic stat value, pass -> UNSOLD!
  if (lot.basePrice > fairMarketValue * 1.15 && rating < 84) {
    return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false };
  }

  // =========================================================================
  // 4. SQUAD NEED & ROLE PRIORITY MULTIPLIERS
  // =========================================================================
  const teamsList = allTeams ? Object.values(allTeams) : [franchise];
  const numTeams = Math.max(1, teamsList.length);
  const totalBought = teamsList.reduce((sum, t) => sum + t.squadCount, 0);
  const avgSquad = totalBought / numTeams;

  let squadNeedFactor = 1.0;
  if (franchise.squadCount < avgSquad) {
    squadNeedFactor += Math.min(0.40, (avgSquad - franchise.squadCount) * 0.12);
  } else if (franchise.squadCount > avgSquad) {
    squadNeedFactor = Math.max(0.45, 1.0 - (franchise.squadCount - avgSquad) * 0.16);
  }

  let roleNeedFactor = profile.rolePriority[lot.role] || 1.0;
  switch (lot.role) {
    case "WICKETKEEPER":
      if (inRoleCount === 0) roleNeedFactor *= 1.45;
      else if (inRoleCount === 1) roleNeedFactor *= 0.50;
      else roleNeedFactor = 0;
      break;
    case "BATTER":
      if (inRoleCount === 0) roleNeedFactor *= 1.35;
      else if (inRoleCount < 3) roleNeedFactor *= 1.15;
      else if (inRoleCount < 5) roleNeedFactor *= 0.90;
      else if (inRoleCount < 7) roleNeedFactor *= 0.50;
      else roleNeedFactor = 0;
      break;
    case "BOWLER":
      if (inRoleCount === 0) roleNeedFactor *= 1.35;
      else if (inRoleCount < 3) roleNeedFactor *= 1.15;
      else if (inRoleCount < 5) roleNeedFactor *= 0.95;
      else if (inRoleCount < 8) roleNeedFactor *= 0.55;
      else roleNeedFactor = 0;
      break;
    case "ALL_ROUNDER":
      if (inRoleCount === 0) roleNeedFactor *= 1.35;
      else if (inRoleCount < 2) roleNeedFactor *= 1.15;
      else if (inRoleCount < 4) roleNeedFactor *= 0.90;
      else if (inRoleCount < 6) roleNeedFactor *= 0.50;
      else roleNeedFactor = 0;
      break;
  }

  if (roleNeedFactor <= 0.10) {
    return { ceiling: 0, squadNeedFactor: 0, roleNeedFactor: 0, isDesirable: false, scoutingTier: scouting.tier };
  }

  // Difficulty adjustment
  let difficultyFactor = 1.0;
  if (difficulty === "easy") difficultyFactor = 0.92;
  if (difficulty === "hard") difficultyFactor = 1.08;

  // Raw calculated willingness multiplied by scouting target priority
  let calculatedCeiling = fairMarketValue * profile.aggression * roleNeedFactor * squadNeedFactor * scouting.multiplier * difficultyFactor;

  // HUMAN CHALLENGE & PADDLE ELASTICITY
  // When a human participant holds the lead, motivated AI franchises do NOT abruptly surrender at their exact baseline.
  // They apply paddle tenacity (up to 18% - 28% stretch) to challenge the human, creating authentic paddle wars!
  if (isHumanLeading && scouting.tier !== "PASS") {
    const tenacityMultiplier = scouting.tier === "CORE_TARGET"
      ? profile.paddleTenacity
      : 1.0 + (profile.paddleTenacity - 1.0) * 0.60;
    calculatedCeiling *= tenacityMultiplier;
  }

  // =========================================================================
  // 5. BUDGET PACING ACROSS ALL SETS (NEVER BLOW BUDGET EARLY)
  // =========================================================================
  const reserveNeeded = Math.max(0, franchise.minSquad - franchise.squadCount - 1) * 3000000;
  const maxAvailable = Math.max(0, franchise.remainingPurse - reserveNeeded);

  const spotsToFill = Math.max(1, franchise.minSquad - franchise.squadCount);
  const avgPursePerSpot = franchise.remainingPurse / spotsToFill;

  // Cap maximum bid based on tier and average purse per spot:
  // When human is leading and this is a core or secondary target, allow tierSpendCap to flex by 15%
  const capFlex = (isHumanLeading && scouting.tier !== "PASS") ? 1.15 : 1.0;
  let tierSpendCap = maxAvailable;
  if (rating >= 88) {
    tierSpendCap = Math.min(maxAvailable, avgPursePerSpot * 3.4 * capFlex, franchise.totalPurse * 0.24);
  } else if (rating >= 80) {
    tierSpendCap = Math.min(maxAvailable, avgPursePerSpot * 2.0 * capFlex, franchise.totalPurse * 0.14);
  } else if (rating >= 74) {
    tierSpendCap = Math.min(maxAvailable, avgPursePerSpot * 1.35 * capFlex, franchise.totalPurse * 0.09);
  } else {
    tierSpendCap = Math.min(maxAvailable, avgPursePerSpot * 0.90 * capFlex, 25000000);
  }

  const finalCeiling = Math.min(calculatedCeiling, tierSpendCap, maxAvailable);
  const roundedCeiling = Math.max(0, Math.floor(finalCeiling / 100000) * 100000);

  const isDesirable = roundedCeiling >= lot.basePrice && roleNeedFactor > 0.25 && squadNeedFactor > 0.20;

  return {
    ceiling: roundedCeiling,
    squadNeedFactor,
    roleNeedFactor,
    isDesirable,
    scoutingTier: scouting.tier,
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
  allTeams?: Record<string, FranchiseState>,
  isHumanLeading: boolean = false
): number {
  return calculateDetailedValuation(lot, franchise, difficulty, lotsRemaining, totalLots, allTeams, isHumanLeading).ceiling;
}
