import { FranchiseState, AuctionLot } from "../types/auction";
import { calculateDetailedValuation } from "./valuation";
import { evaluateRosterBalance } from "../services/rosterBalanceService";

export interface AIDecisionResult {
  shouldBid: boolean;
  bidderFranchiseCode?: string;
  valuationCeiling?: number;
  reason: string;
}

interface CandidateBidder {
  code: string;
  ceiling: number;
  surplus: number;
  squadNeedFactor: number;
  roleNeedFactor: number;
  weight: number;
  team: FranchiseState;
}

export class FallbackAIEngine {
  /**
   * Evaluates all AI-controlled franchises and chooses the most motivated candidate.
   * Accurately factors in:
   * - Squad deficit vs room average (ensures all 10 franchises actively acquire players)
   * - Positional/role need
   * - Remaining purse capacity
   * - Realistic stochastic variation (jitter) so paddle raises are distributed dynamically
   */
  static evaluateBidding(
    lot: AuctionLot,
    teams: Record<string, FranchiseState>,
    nextLegalBid: number,
    difficulty: "easy" | "normal" | "hard" = "normal",
    lotsRemaining: number = 20,
    totalLots: number = 61,
    isHumanLeading: boolean = false
  ): AIDecisionResult {
    const candidates: CandidateBidder[] = [];

    for (const [code, team] of Object.entries(teams)) {
      if (team.controller !== "AI") continue;
      // Do not bid against oneself
      if (lot.highestBidderFranchise === code) continue;

      // Strict Roster balance and role reservation check
      const balanceCheck = evaluateRosterBalance(team, lot);
      if (!balanceCheck.allowed) continue;

      // Minimum squad completion reserve check
      const spotsRemaining = Math.max(0, team.minSquad - team.squadCount - 1);
      const minReserve = spotsRemaining * 3000000; // ₹30 Lakh base per remaining spot
      if (team.remainingPurse - nextLegalBid < minReserve) continue;

      // Detailed valuation check factoring in entire room state, scouting tier, and human rivalry
      const val = calculateDetailedValuation(lot, team, difficulty, lotsRemaining, totalLots, teams, isHumanLeading);
      if (!val.isDesirable || val.ceiling < nextLegalBid || val.roleNeedFactor <= 0.20) continue;

      const surplus = val.ceiling - nextLegalBid;
      const surplusRatio = Math.max(0.05, surplus / (val.ceiling + 1));

      // Weight calculation:
      // 1. Surplus ratio: how much headroom above the current price
      // 2. Squad Need Factor: quadratic scaling heavily elevates teams with fewer players!
      // 3. Purse Per Slot Factor: teams with healthy purse-to-slot ratio are confident
      const slotsRemaining = Math.max(1, team.maxSquad - team.squadCount);
      const pursePerSlot = team.remainingPurse / slotsRemaining;
      const purseFactor = Math.min(1.4, Math.max(0.7, pursePerSlot / 50000000));

      // Rivalry & Paddle war elasticity:
      // When a human participant holds the lead, teams targeting this player contest the human enthusiastically!
      let rivalryBoost = 1.0;
      if (isHumanLeading) {
        if (val.scoutingTier === "CORE_TARGET") {
          rivalryBoost = 1.85;
        } else if (val.scoutingTier === "SECONDARY_TARGET") {
          rivalryBoost = 1.40;
        } else {
          rivalryBoost = 0.85;
        }
      }

      // Stochastic jitter (0.80 to 1.20) represents varying paddle raise timing in an auction
      const jitter = 0.80 + Math.random() * 0.40;
      const weight = surplusRatio * Math.pow(val.squadNeedFactor, 2.0) * val.roleNeedFactor * purseFactor * jitter * rivalryBoost;

      candidates.push({
        code,
        ceiling: val.ceiling,
        surplus,
        squadNeedFactor: val.squadNeedFactor,
        roleNeedFactor: val.roleNeedFactor,
        weight,
        team,
      });
    }

    if (candidates.length === 0) {
      return {
        shouldBid: false,
        reason: "No eligible AI teams have a valuation ceiling above the next legal bid.",
      };
    }

    // Weighted roulette wheel selection among motivated candidates:
    // This creates authentic, unpredictable paddle wars where different teams react dynamically!
    let totalWeight = 0;
    for (const c of candidates) {
      totalWeight += c.weight;
    }
    let roll = Math.random() * totalWeight;
    let winner = candidates[0];
    for (const c of candidates) {
      roll -= c.weight;
      if (roll <= 0) {
        winner = c;
        break;
      }
    }

    return {
      shouldBid: true,
      bidderFranchiseCode: winner.code,
      valuationCeiling: winner.ceiling,
      reason: `AI franchise ${winner.code} placed bid (ceiling: ₹${winner.ceiling}, need: ${winner.squadNeedFactor.toFixed(2)}, next bid: ₹${nextLegalBid}).`,
    };
  }
}
