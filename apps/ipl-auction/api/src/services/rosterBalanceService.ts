import { FranchiseState, AuctionLot } from "../types/auction";

export interface RoleLimits {
  min: number;
  max: number;
}

export interface RulesetRoleConstraints {
  WICKETKEEPER: RoleLimits;
  BATTER: RoleLimits;
  ALL_ROUNDER: RoleLimits;
  BOWLER: RoleLimits;
  maxOverseas: number;
  minSquad: number;
  maxSquad: number;
}

export const MEGA_CLASSIC_CONSTRAINTS: RulesetRoleConstraints = {
  WICKETKEEPER: { min: 1, max: 4 },
  BATTER: { min: 4, max: 9 },
  ALL_ROUNDER: { min: 2, max: 8 },
  BOWLER: { min: 5, max: 10 },
  maxOverseas: 8,
  minSquad: 18,
  maxSquad: 25,
};

export const SPRINT_XI_CONSTRAINTS: RulesetRoleConstraints = {
  WICKETKEEPER: { min: 1, max: 2 },
  BATTER: { min: 3, max: 5 },
  ALL_ROUNDER: { min: 1, max: 4 },
  BOWLER: { min: 3, max: 5 },
  maxOverseas: 4,
  minSquad: 11,
  maxSquad: 11,
};

export function getRoleConstraints(ruleset?: string): RulesetRoleConstraints {
  return ruleset === "SPRINT_XI" ? SPRINT_XI_CONSTRAINTS : MEGA_CLASSIC_CONSTRAINTS;
}

export function formatRoleName(role: string): string {
  switch (role) {
    case "WICKETKEEPER":
      return "Wicketkeeper";
    case "BATTER":
      return "Batter";
    case "BOWLER":
      return "Bowler";
    case "ALL_ROUNDER":
      return "All-Rounder";
    default:
      return role;
  }
}

export interface RosterBalanceCheck {
  allowed: boolean;
  reason?: string;
  roleBreakdown: {
    role: "BATTER" | "BOWLER" | "ALL_ROUNDER" | "WICKETKEEPER";
    current: number;
    min: number;
    max: number;
    deficit: number;
  }[];
  remainingSlots: number;
  totalDeficit: number;
}

export function evaluateRosterBalance(
  team: FranchiseState,
  lot: AuctionLot,
  ruleset?: string
): RosterBalanceCheck {
  const constraints = getRoleConstraints(ruleset);
  const maxSquad = team.maxSquad || constraints.maxSquad;
  const currentSquad = (team.purchasedPlayers || []).length;
  const remainingSlots = Math.max(0, maxSquad - currentSquad);

  // 1. Squad Capacity check
  if (currentSquad >= maxSquad) {
    return {
      allowed: false,
      reason: `Maximum squad capacity reached (${maxSquad} players).`,
      roleBreakdown: [],
      remainingSlots: 0,
      totalDeficit: 0,
    };
  }

  // 2. Overseas limit check
  if (lot.isOverseas && team.overseasCount >= team.maxOverseas) {
    return {
      allowed: false,
      reason: `Overseas player quota reached (${team.maxOverseas} max). You can only bid on Indian players.`,
      roleBreakdown: [],
      remainingSlots,
      totalDeficit: 0,
    };
  }

  // Count existing players per role
  const roleCounts: Record<string, number> = {
    WICKETKEEPER: 0,
    BATTER: 0,
    ALL_ROUNDER: 0,
    BOWLER: 0,
  };

  for (const p of team.purchasedPlayers || []) {
    if (roleCounts[p.role] !== undefined) {
      roleCounts[p.role]++;
    }
  }

  const currentRoleCount = roleCounts[lot.role] || 0;
  const roleLimit = constraints[lot.role];

  // 3. Maximum Role quota check
  if (currentRoleCount >= roleLimit.max) {
    return {
      allowed: false,
      reason: `Maximum ${formatRoleName(lot.role)}s quota reached (${roleLimit.max} max). Focus on other squad roles.`,
      roleBreakdown: [],
      remainingSlots,
      totalDeficit: 0,
    };
  }

  // 4. Mandatory Lookahead Reservation Check
  // If team wins this player, remaining slots will become (remainingSlots - 1).
  const slotsRemainingAfter = remainingSlots - 1;

  // Compute what each role's count would be after this purchase
  const afterCounts: Record<string, number> = {
    ...roleCounts,
    [lot.role]: currentRoleCount + 1,
  };

  const roleBreakdown: RosterBalanceCheck["roleBreakdown"] = [];
  let totalDeficit = 0;
  const criticalMissing: { role: string; needed: number }[] = [];

  const allRoles: ("WICKETKEEPER" | "BATTER" | "ALL_ROUNDER" | "BOWLER")[] = [
    "WICKETKEEPER",
    "BATTER",
    "ALL_ROUNDER",
    "BOWLER",
  ];

  for (const r of allRoles) {
    const minNeeded = constraints[r].min;
    const maxAllowed = constraints[r].max;
    const countAfter = afterCounts[r];
    const deficit = Math.max(0, minNeeded - countAfter);

    roleBreakdown.push({
      role: r,
      current: countAfter,
      min: minNeeded,
      max: maxAllowed,
      deficit,
    });

    totalDeficit += deficit;
    if (deficit > 0) {
      criticalMissing.push({ role: formatRoleName(r), needed: deficit });
    }
  }

  // If the total slots remaining after buying this player is less than the mandatory slots needed,
  // this purchase would make it mathematically impossible to satisfy minimum squad requirements!
  if (totalDeficit > slotsRemainingAfter) {
    // Check if there is an unfulfilled role directly blocked
    const directBlock = criticalMissing.find((m) => m.needed > slotsRemainingAfter);
    if (directBlock) {
      return {
        allowed: false,
        reason: `Cannot bid for ${formatRoleName(lot.role)}: You have only ${remainingSlots} squad slot(s) left and still need at least ${directBlock.needed} ${directBlock.role}(s). Please wait for a ${directBlock.role} lot.`,
        roleBreakdown,
        remainingSlots,
        totalDeficit,
      };
    }

    const missingStr = criticalMissing.map((m) => `${m.needed} ${m.role}`).join(", ");
    return {
      allowed: false,
      reason: `Cannot bid for ${formatRoleName(lot.role)}: Remaining ${remainingSlots} slots are reserved for mandatory squad quotas (need ${missingStr}).`,
      roleBreakdown,
      remainingSlots,
      totalDeficit,
    };
  }

  return {
    allowed: true,
    roleBreakdown,
    remainingSlots,
    totalDeficit,
  };
}
